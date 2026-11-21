const yts = require("yt-search");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getOrCreateQueue } = require("../utils/player");

const MAX_QUEUE_SIZE = Number(process.env.MAX_QUEUE_SIZE || 100);

function getYouTubeID(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = String(url).match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

module.exports = {
  name: "play",
  alias: ["p"],
  description: "Memutar musik dari YouTube di voice channel",
  slashData: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Memutar musik dari YouTube di voice channel")
    .addStringOption(option =>
      option.setName("query")
        .setDescription("Link YouTube atau judul musik yang dicari")
        .setRequired(true)
    ),
  execute: async ({ message, args, interaction, prefix }) => {
    const isInteraction = !!interaction;
    const member = isInteraction ? interaction.member : message.member;
    const guild = isInteraction ? interaction.guild : message.guild;
    const channel = isInteraction ? interaction.channel : message.channel;

    const sendErr = (errMsg) => isInteraction
      ? interaction.reply({ content: errMsg, ephemeral: true })
      : message.reply(errMsg);

    // Voice channel check
    const voiceChannel = member.voice?.channel;
    if (!voiceChannel) {
      return sendErr("❌ Kamu harus berada di voice channel terlebih dahulu!");
    }

    // Permission check
    const permissions = voiceChannel.permissionsFor(guild.members.me);
    if (!permissions.has("Connect") || !permissions.has("Speak")) {
      return sendErr("❌ Aku tidak memiliki izin untuk bergabung dan berbicara di voice channel-mu!");
    }

    const query = String(isInteraction ? interaction.options.getString("query") : args.join(" ")).trim();
    if (!query) {
      return sendErr(`Kirim link atau judul videonya!\nContoh: \`/play kokoronashi\``);
    }

    if (isInteraction && !interaction.deferred) await interaction.deferReply();

    const status = await (async () => {
      if (isInteraction) {
        return channel.send("🔎 Mencari & menyiapkan audio...").catch(() => null);
      }
      return channel.send("🔎 Mencari & menyiapkan audio...").catch(() => null);
    })();

    try {
      let videoUrl = query;
      let videoTitle = "Musik";
      let videoThumbnail = "";
      let videoDuration = "Unknown";
      let videoId = "";

      const isLink = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)/.test(query);

      if (isLink) {
        videoId = getYouTubeID(query);
        if (!videoId) {
          throw new Error("Link YouTube tidak valid. Pastikan format video-nya benar.");
        }
        videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        try {
          const r = await yts({ videoId });
          if (r) {
            videoTitle = r.title || videoTitle;
            videoThumbnail = r.thumbnail || "";
            videoDuration = r.timestamp || r.duration?.toString?.() || "Unknown";
          }
        } catch (_) { /* metadata opsional */ }
      } else {
        const search = await yts(query);
        const vid = search.videos?.[0];
        if (!vid) {
          if (status) await status.edit("❌ Video tidak ditemukan.").catch(() => {});
          else await sendErr("❌ Video tidak ditemukan.");
          return;
        }
        videoUrl = vid.url;
        videoId = vid.videoId;
        videoTitle = vid.title;
        videoThumbnail = vid.thumbnail || vid.image || "";
        videoDuration = vid.timestamp || vid.duration?.toString() || "Unknown";
      }

      // Join / reconnect voice channel (hindari double connection)
      const existing = getVoiceConnection(guild.id);
      let connection = existing;
      if (!existing || existing.joinConfig.channelId !== voiceChannel.id) {
        if (existing) { try { existing.destroy(); } catch (_) {} }
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: true,
        });
      }

      const queue = getOrCreateQueue(guild.id, connection, channel);
      if (queue.voiceConnection !== connection) {
        queue.voiceConnection = connection;
        connection.subscribe(queue.audioPlayer);
      }
      // Pastikan channel tujuan pesan terbaru dipakai.
      queue.textChannel = channel;

      const song = {
        title: videoTitle || "Judul tidak diketahui",
        videoUrl,
        videoId,
        thumbnail: videoThumbnail,
        duration: videoDuration || "Unknown",
        requestedBy: member.id,
      };

      if (queue.isPlaying || queue.currentSong) {
        if (queue.songs.length >= MAX_QUEUE_SIZE) {
          const msg = `❌ Antrean penuh (maks **${MAX_QUEUE_SIZE}** lagu). Tunggu atau gunakan \`.stop\`.`;
          if (status) await status.edit(msg).catch(() => {});
          else await sendErr(msg);
          return;
        }
        queue.songs.push(song);
        const embed = new EmbedBuilder()
          .setTitle("📝 Ditambahkan ke Antrean")
          .setDescription(`**[${song.title}](${song.videoUrl})**`)
          .addFields(
            { name: "Duration", value: song.duration, inline: true },
            { name: "Posisi", value: `${queue.songs.length}`, inline: true }
          )
          .setColor("#ffd700")
          .setThumbnail(song.thumbnail || null)
          .setTimestamp();

        if (status) await status.edit({ content: null, embeds: [embed] }).catch(() => {});
        else if (isInteraction) await interaction.editReply({ embeds: [embed] }).catch(() => {});
        else await message.reply({ embeds: [embed] }).catch(() => {});
      } else {
        queue.play(song);
        const msgStr = `🎵 **Memulai pemutaran:** [${song.title}](${song.videoUrl})`;
        if (status) await status.edit(msgStr).catch(() => {});
        else if (isInteraction) await interaction.editReply(msgStr).catch(() => {});
      }
    } catch (err) {
      const errMsg = `❌ ${err.message || "Terjadi kesalahan saat memproses musik."}`;
      if (status) await status.edit(errMsg).catch(() => {});
      else if (isInteraction) await interaction.editReply(errMsg).catch(() => {});
      else await message.reply(errMsg).catch(() => {});
    }
  }
};
