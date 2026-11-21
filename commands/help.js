const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

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

    // Cache daftar command saat runtime; jangan re-require tiap kali .help dipanggil
    // (dulu `delete require.cache` + require ulang = sumber kebocoran & lambat).
    if (!client._helpMediaCmds) {
      const mediaCmds = ["neko", "waifu", "pinterest", "awoo", "foxgirl", "maid", "vtuber", "headphones", "bluearchive", "hoodie"];
      client._helpMediaCmds = new Set(mediaCmds);
    }

    const embed = new EmbedBuilder()
      .setTitle("🤖 Ryzu Discord Bot Menu")
      .setDescription(`Gunakan prefix \`${prefix}\` sebelum perintah atau pakai Slash Command \`/\`.\nContoh: \`${prefix}play kokoronashi\` atau \`/play query: kokoronashi\``)
      .setColor("#8a2be2")
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp();

    let musicList = "";
    let mediaList = "";
    let utilityList = "";
    const mediaCmds = client._helpMediaCmds;

    for (const cmd of client.commands.values()) {
      const aliasStr = cmd.alias && cmd.alias.length > 0 ? ` (Alias: ${cmd.alias.map(a => `\`${a}\``).join(", ")})` : "";
      const line = `• **${prefix}${cmd.name}**${aliasStr} - _${cmd.description || "No description"}_\n`;

      if (mediaCmds.has(cmd.name.toLowerCase())) {
        mediaList += line;
      } else if (["status", "cache", "help"].includes(cmd.name.toLowerCase())) {
        utilityList += line;
      } else {
        musicList += line;
      }
    }

    if (musicList) {
      embed.addFields({ name: "🎵 Musik & Voice Perintah", value: musicList });
    }
    if (mediaList) {
      embed.addFields({ name: "🌸 Media & Anime Perintah", value: mediaList });
    }
    if (utilityList) {
      embed.addFields({ name: "🛠️ Utility & Monitoring", value: utilityList });
    }

    if (isInteraction) {
      await interaction.reply({ embeds: [embed] });
    } else {
      await message.reply({ embeds: [embed] });
    }
  }
};
