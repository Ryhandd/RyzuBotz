const { SlashCommandBuilder } = require("discord.js");
const { getQueue } = require("../utils/player");

module.exports = {
  name: "shuffle",
  alias: ["acak"],
  description: "Mengacak urutan antrean lagu",
  slashData: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Mengacak urutan antrean lagu"),
  execute: async ({ message, interaction }) => {
    const isInteraction = !!interaction;
    const guild = isInteraction ? interaction.guild : message.guild;
    const queue = getQueue(guild.id);
    const reply = (t) => (isInteraction ? interaction.reply(t) : message.reply(t));

    if (!queue || queue.songs.length < 2) return reply("❌ Antrean minimal harus berisi 2 lagu untuk diacak.");
    queue.shuffle();
    return reply(`🔀 Antrean diacak (**${queue.songs.length} lagu**).`);
  }
};
