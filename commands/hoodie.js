const axios = require("axios");
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "hoodie",
  description: "Kirim gambar anime hoodie random dari Nekosia",
  slashData: new SlashCommandBuilder()
    .setName("hoodie")
    .setDescription("Kirim gambar anime hoodie random dari Nekosia"),
  execute: async ({ message, interaction }) => {
    const isInteraction = !!interaction;

    if (isInteraction) {
      await interaction.deferReply();
    } else {
      await message.channel.send("🔍 Mengambil gambar hoodie...");
    }

    try {
      const res = await axios.get("https://api.nekosia.cat/api/v1/images/hoodie");
      const imageUrl = res.data.image.original.url;

      const embed = new EmbedBuilder()
        .setTitle("🧥 Anime Hoodie Random")
        .setImage(imageUrl)
        .setColor("#32cd32")
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
