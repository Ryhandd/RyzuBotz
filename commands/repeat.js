const { SlashCommandBuilder } = require("discord.js");
const { getQueue } = require("../utils/player");

module.exports = {
  name: "repeat",
  alias: ["loop"],
  description: "Mode pengulangan musik (off/one/queue)",
  slashData: new SlashCommandBuilder()
    .setName("repeat")
    .setDescription("Mode pengulangan musik")
    .addStringOption((opt) =>
      opt.setName("mode").setDescription("off | one | queue").setRequired(true)
        .addChoices({ name: "off", value: "off" }, { name: "one", value: "one" }, { name: "queue", value: "queue" })
    ),
  execute: async ({ message, interaction, args }) => {
    const isInteraction = !!interaction;
    const guild = isInteraction ? interaction.guild : message.guild;
    const queue = getQueue(guild.id);

    const reply = (t) => (isInteraction ? interaction.reply(t) : message.reply(t));

    if (!queue) return reply("❌ Tidak ada musik yang sedang diputar!");
    const mode = String(isInteraction ? interaction.options.getString("mode") : args[0] || "off").toLowerCase();
    if (!queue.setRepeat(mode)) return reply("❌ Mode tidak valid. Pilih `off`, `one`, atau `queue`.");

    const label = { off: "⏹️ Off", one: "🔂 Ulang lagu ini", queue: "🔁 Ulang antrean" }[mode];
    return reply(`Mode repeat: **${label}**`);
  }
};
