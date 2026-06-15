const axios = require("axios");
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "vtuber",
  description: "Kirim gambar vtuber random dari Nekosia",
  slashData: new SlashCommandBuilder()
    .setName("vtuber")
    .setDescription("Kirim gambar vtuber random dari Nekosia"),
  execute: async ({ message, interaction }) => {
    const isInteraction = !!interaction;

    if (isInteraction) {
      await interaction.deferReply();
    } else {
      await message.channel.send("🔍 Mengambil gambar vtuber...");
    }

    try {
      const res = await axios.get("https://api.nekosia.cat/api/v1/images/vtuber");
      const imageUrl = res.data.image.original.url;

      const embed = new EmbedBuilder()
        .setTitle("🎥 VTuber Random")
        .setImage(imageUrl)
        .setColor("#00ced1")
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
