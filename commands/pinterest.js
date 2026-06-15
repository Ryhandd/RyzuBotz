const axios = require("axios");
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "pinterest",
  alias: ["pin"],
  description: "Cari gambar dari Pinterest",
  slashData: new SlashCommandBuilder()
    .setName("pinterest")
    .setDescription("Cari gambar dari Pinterest")
    .addStringOption(option =>
      option.setName("query")
        .setDescription("Kata kunci pencarian gambar")
        .setRequired(true)
    ),
  execute: async ({ message, args, interaction }) => {
    const isInteraction = !!interaction;
    const q = isInteraction ? interaction.options.getString("query") : args.join(" ");

    if (!q) {
      if (isInteraction) {
        return interaction.reply({ content: "❌ Mau cari gambar apa? Contoh: `/pinterest anime aesthetic`", ephemeral: true });
      } else {
        return message.reply("❌ Mau cari gambar apa?\nContoh: `.pinterest anime aesthetic`");
      }
    }

    if (isInteraction) {
      await interaction.deferReply();
    } else {
      await message.channel.send("🔍 Sedang mencari gambar...");
    }

    try {
      const url = `https://www.bing.com/images/search?q=${encodeURIComponent(q + " site:pinterest.com")}&form=HDRSC2&first=1&tsc=ImageBasicHover`;

      const res = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      const matches = [...res.data.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)];
      if (!matches.length) {
        const errMsg = "❌ Gambar tidak ditemukan.";
        if (isInteraction) {
          return interaction.editReply(errMsg);
        } else {
          return message.reply(errMsg);
        }
      }

      const images = matches.map(v => v[1]);
      const random = images[Math.floor(Math.random() * images.length)];

      const embed = new EmbedBuilder()
        .setTitle(`📌 Pinterest Result: ${q}`)
        .setImage(random)
        .setColor("#bd081c")
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
