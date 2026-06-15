const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getQueue } = require("../utils/player");

module.exports = {
  name: "queue",
  alias: ["q", "list"],
  description: "Menampilkan daftar antrean lagu saat ini",
  slashData: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Menampilkan daftar antrean lagu saat ini"),
  execute: async ({ message, interaction }) => {
    const isInteraction = !!interaction;
    const guild = isInteraction ? interaction.guild : message.guild;

    const queue = getQueue(guild.id);
    if (!queue || !queue.currentSong) {
      const errMsg = "❌ Tidak ada lagu yang sedang diputar!";
      return isInteraction ? interaction.reply({ content: errMsg, ephemeral: true }) : message.reply(errMsg);
    }

    const embed = new EmbedBuilder()
      .setTitle("🎶 Antrean Musik")
      .setColor("#8a2be2")
      .setTimestamp();

    let desc = `**Sedang Diputar:**\n» [${queue.currentSong.title}](${queue.currentSong.videoUrl}) | \`${queue.currentSong.duration || "Unknown"}\` (Diminta oleh: <@${queue.currentSong.requestedBy}>)\n\n`;

    if (queue.songs.length === 0) {
      desc += "*Tidak ada lagu lain di antrean.*";
    } else {
      desc += "**Selanjutnya di Antrean:**\n";
      queue.songs.slice(0, 10).forEach((song, index) => {
        desc += `\`${index + 1}.\` [${song.title}](${song.videoUrl}) | \`${song.duration || "Unknown"}\` (Diminta oleh: <@${song.requestedBy}>)\n`;
      });

      if (queue.songs.length > 10) {
        desc += `\n*Dan ${queue.songs.length - 10} lagu lainnya...*`;
      }
    }

    embed.setDescription(desc);

    if (isInteraction) {
      await interaction.reply({ embeds: [embed] });
    } else {
      await message.reply({ embeds: [embed] });
    }
  }
};
