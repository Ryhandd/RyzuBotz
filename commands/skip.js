const { getQueue } = require("../utils/player");
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "skip",
  alias: ["s"],
  description: "Melewati lagu yang sedang diputar",
  slashData: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Melewati lagu yang sedang diputar"),
  execute: async ({ message, interaction }) => {
    const isInteraction = !!interaction;
    const member = isInteraction ? interaction.member : message.member;
    const guild = isInteraction ? interaction.guild : message.guild;

    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      const errMsg = "❌ Kamu harus berada di voice channel terlebih dahulu!";
      return isInteraction ? interaction.reply({ content: errMsg, ephemeral: true }) : message.reply(errMsg);
    }

    const queue = getQueue(guild.id);
    if (!queue || !queue.isPlaying) {
      const errMsg = "❌ Tidak ada musik yang sedang diputar!";
      return isInteraction ? interaction.reply({ content: errMsg, ephemeral: true }) : message.reply(errMsg);
    }

    const success = queue.skip();
    if (success) {
      const msgStr = "⏭️ **Musik dilewati!**";
      if (isInteraction) {
        await interaction.reply(msgStr);
      } else {
        await message.reply(msgStr);
      }
    } else {
      const errMsg = "❌ Gagal melewati musik.";
      if (isInteraction) {
        await interaction.reply({ content: errMsg, ephemeral: true });
      } else {
        await message.reply(errMsg);
      }
    }
  }
};
