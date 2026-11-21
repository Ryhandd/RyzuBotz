const { SlashCommandBuilder } = require("discord.js");
const { cacheStats, clearCache, enforceCacheLimit } = require("../utils/audio");
const { getQueue } = require("../utils/player");

module.exports = {
  name: "cache",
  alias: ["mem"],
  description: "Mengelola cache musik (info/clear/trim)",
  slashData: new SlashCommandBuilder()
    .setName("cache")
    .setDescription("Mengelola cache musik")
    .addStringOption((opt) =>
      opt.setName("aksi")
        .setDescription("info | clear | trim")
        .setRequired(false)
        .addChoices(
          { name: "info", value: "info" },
          { name: "clear", value: "clear" },
          { name: "trim", value: "trim" }
        )
    ),
  execute: async ({ message, interaction, args }) => {
    const isInteraction = !!interaction;
    const guild = isInteraction ? interaction.guild : message.guild;
    const aksi = (isInteraction ? interaction.options.getString("aksi") : args[0]) || "info";
    const act = String(aksi).toLowerCase();

    const reply = async (text) => {
      if (isInteraction) {
        if (interaction.deferred || interaction.replied) return interaction.editReply(text);
        return interaction.reply(text);
      }
      return message.reply(text);
    };

    if (act === "clear") {
      const queue = getQueue(guild.id);
      if (queue?.isPlaying) {
        return reply("⚠️ Cache tidak bisa dibersihkan saat musik sedang diputar. Hentikan dulu dengan `.stop`.");
      }
      const res = clearCache();
      return reply(`🧹 Cache dibersihkan: **${res.removed} file** (${(res.bytes / 1048576).toFixed(1)} MB).`);
    }

    if (act === "trim") {
      enforceCacheLimit();
      const cs = cacheStats();
      return reply(`♻️ Cache dirapikan. Sekarang **${cs.files} file / ${Math.round(cs.bytes / 1048576)} MB** (maks ${Math.round(cs.maxBytes / 1048576)} MB).`);
    }

    const cs = cacheStats();
    return reply(
      [
        "🗄️ **Cache Musik**",
        `• File: **${cs.files}**`,
        `• Ukuran: **${Math.round(cs.bytes / 1048576)} MB** / ${Math.round(cs.maxBytes / 1048576)} MB`,
        `• Lokasi: \`${cs.dir}\``,
        "",
        "Gunakan `.cache clear` untuk menghapus, `.cache trim` untuk memangkas ke batas.",
      ].join("\n")
    );
  }
};
