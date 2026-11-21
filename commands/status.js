const { SlashCommandBuilder } = require("discord.js");
const os = require("os");
const { getQueue, queues } = require("../utils/player");
const { cacheStats } = require("../utils/audio");
const { startedAt } = require("../utils/web");

module.exports = {
  name: "status",
  alias: ["stats", "health"],
  description: "Menampilkan status bot (uptime, RAM, guild, cache musik)",
  slashData: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Menampilkan status bot (uptime, RAM, guild, cache musik)"),
  execute: async ({ message, interaction }) => {
    const isInteraction = !!interaction;

    const mem = process.memoryUsage();
    const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);
    const d = Math.floor(uptimeSec / 86400);
    const h = Math.floor((uptimeSec % 86400) / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);
    const s = uptimeSec % 60;
    const uptimeStr = `${d ? d + "d " : ""}${h}j ${m}m ${s}d`;

    const cs = cacheStats();
    const activeQueues = [...queues.values()].filter((q) => !q.destroyed);
    const playing = activeQueues.filter((q) => q.isPlaying).length;

    const yt = message?.client?.yt || interaction?.client?.yt;
    const ytStatus = yt ? "✅ OK" : "⏳ Memuat";

    const lines = [
      "🤖 **RyzuBotz — Status Sistem**",
      "",
      `⏱️ Uptime: **${uptimeStr}**`,
      `📦 Node.js: **${process.version}**`,
      `💾 RAM: **${Math.round(mem.rss / 1048576)} MB** (heap ${Math.round(mem.heapUsed / 1048576)} MB)`,
      `🖥️ Platform: **${os.type()} ${os.arch()}**`,
      "",
      `🏠 Guild: **${(message?.client || interaction?.client)?.guilds?.cache?.size ?? "?"}**`,
      `🎵 Queue aktif: **${activeQueues.length}** (${playing} memutar)`,
      `🎧 YouTube engine: ${ytStatus}`,
      `🗄️ Cache musik: **${cs.files} file / ${Math.round(cs.bytes / 1048576)} MB** (maks ${Math.round(cs.maxBytes / 1048576)} MB)`,
      "",
      `🌐 Web server: port **${process.env.PORT || 3000}** → \`/health\`, \`/status\``,
    ];

    const text = lines.join("\n");
    if (isInteraction) {
      await interaction.reply(text);
    } else {
      await message.reply(text);
    }
  }
};
