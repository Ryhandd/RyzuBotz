const { getQueue } = require("../utils/player");
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "pause",
  alias: [],
  description: "Jeda pemutaran musik",
  slashData: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Jeda pemutaran musik"),
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

    const success = queue.audioPlayer.pause();
    if (success) {
      const msgStr = "⏸️ **Musik dijeda!** Ketik `/resume` atau `.resume` untuk melanjutkan.";
      if (isInteraction) {
        await interaction.reply(msgStr);
      } else {
        await message.reply(msgStr);
      }
    } else {
      const errMsg = "❌ Gagal menjeda musik.";
      if (isInteraction) {
        await interaction.reply({ content: errMsg, ephemeral: true });
      } else {
        await message.reply(errMsg);
      }
    }
  }
};
