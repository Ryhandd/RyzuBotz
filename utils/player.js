// Guild music player. Satu instance GuildQueue per guild.
// Perbaikan utama vs versi lama:
//  - Sumber audio via utils/audio.js (format terbaik + remux opus + cache disk)
//  - Resource dari file ogg (StreamType.OggOpus) -> tanpa "suara telepon"
//  - Fallback stream mentah bila download/remux gagal
//  - auto-leave bila bot sendirian di voice channel
//  - volume/repeat/loop/shuffle tersedia untuk command baru

const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const { Readable } = require("stream");
const { resolveAudioSource, CACHE_DIR, MAX_CACHE_BYTES } = require("./audio");
const log = require("./logger");

const queues = new Map();

// Hapus queue bila guild terlalu banyak (proteksi memory).
const MAX_GUILD_QUEUES = Number(process.env.MAX_GUILD_QUEUES || 200);

class GuildQueue {
  constructor(guildId, voiceConnection, textChannel) {
    this.guildId = guildId;
    this.voiceConnection = voiceConnection;
    this.textChannel = textChannel;
    this.audioPlayer = createAudioPlayer();
    this.songs = [];
    this.currentSong = null;
    this.isPlaying = false;
    this.paused = false;
    this.volume = 1.0;          // 0.1 .. 2.0
    this.repeatMode = "off";    // off | queue | one
    this.leaveTimeout = null;
    this.destroyed = false;

    this.voiceConnection.subscribe(this.audioPlayer);

    this.audioPlayer.on("stateChange", (oldState, newState) => {
      log.debug("player", `[${this.guildId}] ${oldState.status} -> ${newState.status}`);
    });

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      if (this.destroyed) return;
      // Lagu selesai: handle repeat.
      if (this.repeatMode === "one" && this.currentSong) {
        this.play(this.currentSong);
        return;
      }
      const finished = this.currentSong;
      this.currentSong = null;
      if (this.repeatMode === "queue" && finished) {
        this.songs.push(finished);
      }
      this.playNext();
    });

    this.audioPlayer.on("error", (error) => {
      log.error("player", `[${this.guildId}] audio error:`, error.message);
      this.textChannel.send(`⚠️ **Audio Player Error:** ${error.message}`).catch(() => {});
      this.currentSong = null;
      this.playNext();
    });

    this.setupAutoLeave();
    this.setupConnectionWatchdog();
  }

  /** Bot auto-leave bila sendirian >= 5 menit. */
  setupAutoLeave() {
    const check = () => {
      if (this.destroyed) return;
      try {
        const ch = this.voiceConnection.joinConfig?.channelId;
        const guild = this.textChannel.guild;
        const vc = guild.channels.cache.get(ch);
        if (!vc) return;
        const humans = vc.members.filter((m) => !m.user.bot).size;
        if (humans === 0 && this.songs.length === 0) {
          log.info("player", `Auto-leave guild ${this.guildId} (sendirian, antrean kosong)`);
          this.textChannel.send("👋 Tidak ada yang mendengarkan — aku keluar dulu ya.").catch(() => {});
          this.destroy();
        }
      } catch (e) {
        log.debug("player", `autoLeave check error: ${e.message}`);
      }
    };
    this.leaveTimeout = setInterval(check, 60_000);
    this.leaveTimeout.unref?.();
  }

  /** Reconnect otomatis bila koneksi voice terputus. */
  setupConnectionWatchdog() {
    this.voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (this.destroyed) return;
      try {
        await Promise.race([
          entersState(this.voiceConnection, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch {
        log.warn("player", `[${this.guildId}] voice disconnected, membersihkan queue`);
        this.destroy();
      }
    });
  }

  async play(song) {
    if (this.destroyed) return;
    this.currentSong = song;
    this.paused = false;
    try {
      const yt = this.textChannel.client?.yt;
      if (!yt) throw new Error("YouTube Engine belum siap. Silakan coba sesaat lagi!");

      const source = await resolveAudioSource(yt, song.videoId);
      const isOggFile = source.type === "file";

      const resource = createAudioResource(
        isOggFile ? fs.createReadStream(source.path) : source.stream,
        {
          inputType: isOggFile ? StreamType.OggOpus : StreamType.Arbitrary,
          inlineVolume: true,
        }
      );
      if (resource.volume) resource.volume.setVolume(this.volume);

      this.audioPlayer.play(resource);
      this.isPlaying = true;

      const fmt = source.format;
      const kbps = fmt ? Math.round(fmt.bitrate / 1000) : null;
      const embed = new EmbedBuilder()
        .setTitle("🎶 Now Playing")
        .setDescription(`**[${song.title}](${song.videoUrl})**`)
        .addFields(
          { name: "Duration", value: song.duration || "Unknown", inline: true },
          { name: "Requested By", value: `<@${song.requestedBy}>`, inline: true },
          { name: "Quality", value: kbps ? `${kbps} kbps${source.cached ? " • cache" : ""}` : "auto", inline: true },
          { name: "Repeat", value: this.repeatMode === "off" ? "off" : this.repeatMode, inline: true }
        )
        .setColor("#8a2be2")
        .setThumbnail(song.thumbnail)
        .setTimestamp();

      this.textChannel?.send?.({ embeds: [embed] })?.catch?.(() => {});
    } catch (err) {
      log.error("player", `play gagal (${song.videoId}):`, err.message);
      this.textChannel?.send?.(`❌ Gagal memutar lagu: **${song.title}** — ${err.message}`)?.catch?.(() => {});
      this.currentSong = null;
      this.playNext();
    }
  }

  playNext() {
    if (this.destroyed) return;
    if (this.songs.length > 0) {
      const nextSong = this.songs.shift();
      this.play(nextSong);
    } else {
      this.isPlaying = false;
      this.currentSong = null;
      this.textChannel.send("🎵 Antrean lagu telah selesai. Gunakan `.play` untuk memutar lagu baru!").catch(() => {});
    }
  }

  skip() {
    if (!this.isPlaying) return false;
    this.audioPlayer.stop();
    return true;
  }

  pause() {
    if (!this.isPlaying) return false;
    // Sumber kebenaran = status AudioPlayer, bukan flag internal (bisa drift).
    const st = this.audioPlayer.state?.status;
    if (st !== "playing") return false;
    const ok = this.audioPlayer.pause();
    if (ok === false) return false;
    this.paused = true;
    return true;
  }

  resume() {
    const st = this.audioPlayer.state?.status;
    if (st !== "paused") {
      this.paused = false;
      return false;
    }
    const ok = this.audioPlayer.unpause();
    if (ok === false) return false;
    this.paused = false;
    return true;
  }

  setVolume(v) {
    if (typeof v !== "number" || Number.isNaN(v)) return false;
    this.volume = Math.min(2, Math.max(0.1, v));
    const res = this.audioPlayer.state.resource;
    if (res?.volume) res.volume.setVolume(this.volume);
    return true;
  }

  shuffle() {
    if (this.songs.length < 2) return false;
    for (let i = this.songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.songs[i], this.songs[j]] = [this.songs[j], this.songs[i]];
    }
    return true;
  }

  setRepeat(mode) {
    if (!["off", "one", "queue"].includes(mode)) return false;
    this.repeatMode = mode;
    return true;
  }

  stop() {
    this.songs = [];
    this.audioPlayer.stop();
    this.isPlaying = false;
    this.currentSong = null;
    this.paused = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
    if (this.leaveTimeout) clearInterval(this.leaveTimeout);
    this.audioPlayer.stop();
    try { this.voiceConnection.destroy(); } catch (e) {}
    queues.delete(this.guildId);
  }
}

function getOrCreateQueue(guildId, voiceConnection, textChannel) {
  let queue = queues.get(guildId);
  if (!queue && voiceConnection && textChannel) {
    if (queues.size >= MAX_GUILD_QUEUES) {
      // Buang guild yang tidak lagi punya koneksi aktif.
      for (const [gid, q] of queues) {
        if (getVoiceConnection(gid) == null || q.destroyed) {
          q.destroy();
          break;
        }
      }
    }
    queue = new GuildQueue(guildId, voiceConnection, textChannel);
    queues.set(guildId, queue);
  }
  return queue;
}

function getQueue(guildId) {
  return queues.get(guildId);
}

module.exports = {
  getOrCreateQueue,
  getQueue,
  queues,
  CACHE_DIR,
  MAX_CACHE_BYTES,
};
