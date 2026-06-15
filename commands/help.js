const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "help",
  alias: ["h", "menu"],
  description: "Menampilkan semua daftar perintah bot",
  slashData: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Menampilkan semua daftar perintah bot"),
  execute: async ({ message, interaction, prefix }) => {
    const isInteraction = !!interaction;
    const client = isInteraction ? interaction.client : message.client;

    const embed = new EmbedBuilder()
      .setTitle("🤖 Ryzu Discord Bot Menu")
      .setDescription(`Gunakan prefix \`${prefix}\` sebelum perintah atau pakai Slash Command \`/\`.\nContoh: \`${prefix}play kokoronashi\` atau \`/play query: kokoronashi\``)
      .setColor("#8a2be2")
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp();

    const cmdFolder = path.join(__dirname);
    const files = fs.readdirSync(cmdFolder).filter(f => f.endsWith(".js"));

    let musicList = "";
    let mediaList = "";

    const mediaCmds = ["neko", "waifu", "pinterest", "awoo", "foxgirl", "maid", "vtuber", "headphones", "bluearchive", "hoodie"];

    for (const file of files) {
      const fullPath = path.join(cmdFolder, file);
      delete require.cache[fullPath];
      const cmd = require(fullPath);
      if (cmd.name) {
        const aliasStr = cmd.alias && cmd.alias.length > 0 ? ` (Alias: ${cmd.alias.map(a => `\`${a}\``).join(", ")})` : "";
        const line = `• **${prefix}${cmd.name}**${aliasStr} - _${cmd.description || "No description"}_\n`;

        if (mediaCmds.includes(cmd.name.toLowerCase())) {
          mediaList += line;
        } else {
          musicList += line;
        }
      }
    }

    if (musicList) {
      embed.addFields({ name: "🎵 Musik & Voice Perintah", value: musicList });
    }
    if (mediaList) {
      embed.addFields({ name: "🌸 Media & Anime Perintah", value: mediaList });
    }

    if (isInteraction) {
      await interaction.reply({ embeds: [embed] });
    } else {
      await message.reply({ embeds: [embed] });
    }
  }
};
