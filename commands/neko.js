const axios = require("axios");
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "neko",
  description: "Kirim gambar neko random",
  slashData: new SlashCommandBuilder()
    .setName("neko")
    .setDescription("Kirim gambar neko random"),
  execute: async ({ message, interaction }) => {
    const isInteraction = !!interaction;

    if (isInteraction) {
      await interaction.deferReply();
    } else {
      await message.channel.send("🔍 Mengambil gambar neko...");
    }

    try {
      const res = await axios.get("https://api.nekosia.cat/api/v1/images/catgirl");
      const imageUrl = res.data.image.original.url;

      const embed = new EmbedBuilder()
        .setTitle("🐱 Neko Random")
        .setImage(imageUrl)
        .setColor("#ff69b4")
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
