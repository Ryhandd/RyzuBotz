const axios = require("axios");
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "bluearchive",
  description: "Kirim gambar Blue Archive random dari Nekosia",
  slashData: new SlashCommandBuilder()
    .setName("bluearchive")
    .setDescription("Kirim gambar Blue Archive random dari Nekosia"),
  execute: async ({ message, interaction }) => {
    const isInteraction = !!interaction;

    if (isInteraction) {
      await interaction.deferReply();
    } else {
      await message.channel.send("🔍 Mengambil gambar Blue Archive...");
    }

    try {
      const res = await axios.get("https://api.nekosia.cat/api/v1/images/blue-archive");
      const imageUrl = res.data.image.original.url;

      const embed = new EmbedBuilder()
        .setTitle("💙 Blue Archive Random")
        .setImage(imageUrl)
        .setColor("#1e90ff")
        .setTimestamp();

      if (isInteraction) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await message.reply({ embeds: [embed] });
      }
    } catch (err) {
      console.error(err);
      const errMsg = "❌ Gagal mengambil gambar.";
      if (isInteraction) {
        await interaction.editReply(errMsg);
      } else {
        await message.reply(errMsg);
      }
    }
  }
};
