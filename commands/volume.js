const { SlashCommandBuilder } = require("discord.js");
const { getQueue } = require("../utils/player");

module.exports = {
  name: "volume",
  alias: ["vol", "v"],
  description: "Mengatur volume musik (10-200)",
  slashData: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Mengatur volume musik (10-200)")
    .addIntegerOption((opt) =>
      opt.setName("level").setDescription("Volume 10-200").setRequired(true).setMinValue(10).setMaxValue(200)
    ),
  execute: async ({ message, interaction, args }) => {
    const isInteraction = !!interaction;
    const guild = isInteraction ? interaction.guild : message.guild;
    const queue = getQueue(guild.id);

    const reply = (t) => (isInteraction ? interaction.reply(t) : message.reply(t));

    if (!queue) return reply("❌ Tidak ada musik yang sedang diputar!");

    const raw = isInteraction ? interaction.options.getInteger("level") : args[0];
    const level = Number(raw);
    if (!Number.isFinite(level) || level < 10 || level > 200) {
      return reply("❌ Volume harus angka **10-200**. Contoh: `.volume 120`");
    }

    queue.setVolume(level / 100);
    return reply(`🔊 Volume diset ke **${level}%**.`);
  }
};
