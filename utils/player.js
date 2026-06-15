const { createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const { Readable } = require('stream');

const queues = new Map();

class GuildQueue {
  constructor(guildId, voiceConnection, textChannel) {
    this.guildId = guildId;
    this.voiceConnection = voiceConnection;
    this.textChannel = textChannel;
    this.audioPlayer = createAudioPlayer();
    this.songs = [];
    this.currentSong = null;
    this.isPlaying = false;

    this.voiceConnection.subscribe(this.audioPlayer);

    this.audioPlayer.on('stateChange', (oldState, newState) => {
      console.log(`[Player State] ${oldState.status} -> ${newState.status}`);
    });

    this.voiceConnection.on('stateChange', (oldState, newState) => {
      console.log(`[Voice Connection State] ${oldState.status} -> ${newState.status}`);
    });

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.playNext();
    });

    this.audioPlayer.on('error', error => {
      console.error(`[Player Error] Guild ${this.guildId}:`, error);
      this.textChannel.send(`⚠️ **Audio Player Error:** ${error.message}`).catch(() => {});
      this.playNext();
    });
  }

  async play(song) {
    this.currentSong = song;
    try {
      const yt = this.textChannel.client.yt;
      if (!yt) {
        throw new Error("YouTube Engine belum siap. Silakan coba sesaat lagi!");
      }

      // Download the audio stream
      const stream = await yt.download(song.videoId, { type: 'audio', client: 'ANDROID' });

      // Convert Web ReadableStream to Node.js Readable stream
      const nodeStream = Readable.fromWeb(stream);

      const resource = createAudioResource(nodeStream);

      this.audioPlayer.play(resource);
      this.isPlaying = true;

      const embed = new EmbedBuilder()
        .setTitle('🎶 Now Playing')
        .setDescription(`**[${song.title}](${song.videoUrl})**`)
        .addFields(
          { name: 'Duration', value: song.duration || 'Unknown', inline: true },
          { name: 'Requested By', value: `<@${song.requestedBy}>`, inline: true }
        )
        .setColor('#8a2be2')
        .setThumbnail(song.thumbnail)
        .setTimestamp();

      this.textChannel.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error(err);
      this.textChannel.send(`❌ Gagal memutar lagu: **${song.title}**`).catch(() => {});
      this.playNext();
    }
  }

  playNext() {
    if (this.songs.length > 0) {
      const nextSong = this.songs.shift();
      this.play(nextSong);
    } else {
      this.isPlaying = false;
      this.currentSong = null;
      this.textChannel.send('🎵 Antrean lagu telah selesai. Gunakan `.play` untuk memutar lagu baru!').catch(() => {});
    }
  }

  skip() {
    if (!this.isPlaying) return false;
    this.audioPlayer.stop();
    return true;
  }

  stop() {
    this.songs = [];
    this.audioPlayer.stop();
    this.isPlaying = false;
    this.currentSong = null;
  }

  destroy() {
    this.stop();
    try {
      this.voiceConnection.destroy();
    } catch (e) {}
    queues.delete(this.guildId);
  }
}

function getOrCreateQueue(guildId, voiceConnection, textChannel) {
  let queue = queues.get(guildId);
  if (!queue && voiceConnection && textChannel) {
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
  queues
};
