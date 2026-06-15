const yts = require("yt-search");
const { joinVoiceChannel } = require("@discordjs/voice");
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getOrCreateQueue } = require("../utils/player");

function getYouTubeID(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
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

    // Check if user is in a voice channel
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      const errMsg = "❌ Kamu harus berada di voice channel terlebih dahulu!";
      return isInteraction ? interaction.reply({ content: errMsg, ephemeral: true }) : message.reply(errMsg);
    }

    // Check permissions
    const permissions = voiceChannel.permissionsFor(guild.members.me);
    if (!permissions.has("Connect") || !permissions.has("Speak")) {
      const errMsg = "❌ Aku tidak memiliki izin untuk bergabung dan berbicara di voice channel-mu!";
      return isInteraction ? interaction.reply({ content: errMsg, ephemeral: true }) : message.reply(errMsg);
    }

    const query = isInteraction ? interaction.options.getString("query") : args.join(" ");
    if (!query) {
      const errMsg = `Kirim link atau judul videonya!\nContoh: \`/play kokoronashi\``;
      return isInteraction ? interaction.reply({ content: errMsg, ephemeral: true }) : message.reply(errMsg);
    }

    if (isInteraction) {
      await interaction.deferReply();
    }

    try {
      let videoUrl = query;
      let videoTitle = "Musik";
      let videoThumbnail = "";
      let videoDuration = "Unknown";
      let videoId = "";

      const isLink = query.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^\s&]+)/);

      if (!isLink) {
        const search = await yts(query);
        const vid = search.videos[0];
        if (!vid) {
          const errMsg = "❌ Video tidak ditemukan.";
          return isInteraction ? interaction.editReply(errMsg) : message.reply(errMsg);
        }
        videoUrl = vid.url;
        videoId = vid.videoId;
        videoTitle = vid.title;
        videoThumbnail = vid.thumbnail || vid.image;
        videoDuration = vid.timestamp || vid.duration?.toString();
      } else {
        videoId = getYouTubeID(videoUrl);
        // If it's a link, search it to get metadata
        try {
          const search = await yts(videoUrl);
          const vid = search.videos[0];
          if (vid) {
            videoTitle = vid.title;
            videoThumbnail = vid.thumbnail || vid.image;
            videoDuration = vid.timestamp || vid.duration?.toString();
          }
        } catch (_) {}
      }

      // Join Voice Channel
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
      });

      // Get or create queue
      const queue = getOrCreateQueue(guild.id, connection, channel);

      const song = {
        title: videoTitle,
        videoUrl: videoUrl,
        videoId: videoId,
        thumbnail: videoThumbnail,
        duration: videoDuration,
        requestedBy: member.id
      };

      if (queue.isPlaying) {
        queue.songs.push(song);
        const embed = new EmbedBuilder()
          .setTitle("📝 Ditambahkan ke Antrean")
          .setDescription(`**[${song.title}](${song.videoUrl})**`)
          .addFields(
            { name: "Duration", value: song.duration || "Unknown", inline: true },
            { name: "Posisi", value: `${queue.songs.length}`, inline: true }
          )
          .setColor("#ffd700")
          .setThumbnail(song.thumbnail)
          .setTimestamp();

        if (isInteraction) {
          await interaction.editReply({ embeds: [embed] });
        } else {
          await message.reply({ embeds: [embed] });
        }
      } else {
        queue.play(song);
        const msgStr = `🎵 **Memulai pemutaran:** [${song.title}](${song.videoUrl})`;
        if (isInteraction) {
          await interaction.editReply(msgStr);
        } else {
          // If message command, queue.play already posts Now Playing embed, so we don't need double notifications.
          // But we can notify briefly or just let queue.play post.
        }
      }

    } catch (err) {
      console.error("PLAY ERROR:", err);
      const errMsg = "❌ Terjadi kesalahan sistem saat memproses musik.";
      if (isInteraction) {
        await interaction.editReply(errMsg);
      } else {
        await message.reply(errMsg);
      }
    }
  }
};
