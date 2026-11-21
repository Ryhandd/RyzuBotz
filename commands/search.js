const yts = require("yt-search");
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "search",
  alias: ["cari"],
  description: "Mencari lagu di YouTube tanpa langsung memutar",
  slashData: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Mencari lagu di YouTube tanpa langsung memutar")
    .addStringOption((opt) => opt.setName("query").setDescription("Kata kunci").setRequired(true)),
  execute: async ({ message, interaction, args }) => {
    const isInteraction = !!interaction;
    const q = String(isInteraction ? interaction.options.getString("query") : args.join(" ")).trim();

    const reply = async (payload) => {
      if (isInteraction) {
        if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
        return interaction.reply(payload);
      }
      return message.reply(payload);
    };

    if (!q) return reply("❌ Mau cari apa? Contoh: `.search kokoronashi`");
    if (isInteraction) await interaction.deferReply();

    try {
      const res = await yts(q);
      const vids = (res.videos || []).slice(0, 8);
      if (!vids.length) return reply("❌ Tidak ada hasil ditemukan.");

      const desc = vids
        .map((v, i) => `\`${i + 1}.\` [${v.title}](${v.url}) — \`${v.timestamp || "?"}\` • ${v.author?.name || "?"}`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setTitle(`🔎 Hasil pencarian: ${q}`)
        .setDescription(desc)
        .setFooter({ text: "Gunakan .play <link> untuk memutar" })
        .setColor("#8a2be2")
        .setTimestamp();

      return reply({ embeds: [embed] });
    } catch (e) {
      return reply(`❌ Gagal mencari: ${e.message}`);
    }
  }
};
