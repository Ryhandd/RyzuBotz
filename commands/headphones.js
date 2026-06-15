const axios = require("axios");
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "headphones",
  description: "Kirim gambar headphones random dari Nekosia",
  slashData: new SlashCommandBuilder()
    .setName("headphones")
    .setDescription("Kirim gambar headphones random dari Nekosia"),
  execute: async ({ message, interaction }) => {
    const isInteraction = !!interaction;

    if (isInteraction) {
      await interaction.deferReply();
    } else {
      await message.channel.send("🔍 Mengambil gambar headphones...");
    }

    try {
      const res = await axios.get("https://api.nekosia.cat/api/v1/images/headphones");
      const imageUrl = res.data.image.original.url;

      const embed = new EmbedBuilder()
        .setTitle("🎧 Headphones Anime Random")
        .setImage(imageUrl)
        .setColor("#ff1493")
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
