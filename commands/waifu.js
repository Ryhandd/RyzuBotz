const axios = require("axios");
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "waifu",
  description: "Kirim gambar waifu random",
  slashData: new SlashCommandBuilder()
    .setName("waifu")
    .setDescription("Kirim gambar waifu random"),
  execute: async ({ message, interaction }) => {
    const isInteraction = !!interaction;

    if (isInteraction) {
      await interaction.deferReply();
    } else {
      await message.channel.send("🔍 Mengambil gambar waifu...");
    }

    try {
      const res = await axios.get("https://api.nekosia.cat/api/v1/images/cute?additionalTags=girl");
      const imageUrl = res.data.image.original.url;

      const embed = new EmbedBuilder()
        .setTitle("🌸 Waifu Random")
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
