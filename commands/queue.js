const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getQueue } = require("../utils/player");

const PAGE_SIZE = 10;

module.exports = {
  name: "queue",
  alias: ["q", "list"],
  description: "Menampilkan daftar antrean lagu saat ini",
  slashData: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Menampilkan daftar antrean lagu saat ini")
    .addIntegerOption(opt =>
      opt.setName("halaman").setDescription("Nomor halaman (default 1)").setRequired(false).setMinValue(1)
    ),
  execute: async ({ message, interaction, args }) => {
    const isInteraction = !!interaction;
    const guild = isInteraction ? interaction.guild : message.guild;

    const queue = getQueue(guild.id);
    if (!queue || !queue.currentSong) {
      const errMsg = "❌ Tidak ada lagu yang sedang diputar!";
      return isInteraction ? interaction.reply({ content: errMsg, ephemeral: true }) : message.reply(errMsg);
    }

    const totalPages = Math.max(1, Math.ceil(queue.songs.length / PAGE_SIZE));
    const rawPage = isInteraction ? interaction.options.getInteger("halaman") : Number(args[0]);
    const page = Math.min(totalPages, Math.max(1, Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1));

    const cur = queue.currentSong;
    const repeatLabel = { off: "Off", one: "🔂 Lagu ini", queue: "🔁 Antrean" }[queue.repeatMode || "off"];

    let desc = `**Sedang Diputar:**\n» [${cur.title}](${cur.videoUrl}) | \`${cur.duration || "Unknown"}\` (Diminta oleh: <@${cur.requestedBy}>)\n`;
    desc += `\n🔊 Volume: **${Math.round((queue.volume ?? 1) * 100)}%** • Repeat: **${repeatLabel}**`;
    desc += `\n📜 Total antrean: **${queue.songs.length}** lagu\n\n`;

    if (queue.songs.length === 0) {
      desc += "*Tidak ada lagu lain di antrean.*";
    } else {
      const start = (page - 1) * PAGE_SIZE;
      desc += `**Selanjutnya (halaman ${page}/${totalPages}):**\n`;
      queue.songs.slice(start, start + PAGE_SIZE).forEach((song, i) => {
        desc += `\`${start + i + 1}.\` [${song.title}](${song.videoUrl}) | \`${song.duration || "Unknown"}\` (<@${song.requestedBy}>)\n`;
      });
      if (totalPages > 1) {
        desc += `\n*Halaman lain: \`.queue ${page < totalPages ? page + 1 : 1}\`*`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("🎶 Antrean Musik")
      .setDescription(desc.slice(0, 4000))
      .setColor("#8a2be2")
      .setFooter({ text: `Halaman ${page}/${totalPages}` })
      .setTimestamp();

    if (isInteraction) {
      await interaction.reply({ embeds: [embed] });
    } else {
      await message.reply({ embeds: [embed] });
    }
  }
};
