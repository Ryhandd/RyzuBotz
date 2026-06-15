const { getQueue } = require("../utils/player");
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "resume",
  alias: ["unpause"],
  description: "Melanjutkan pemutaran musik yang dijeda",
  slashData: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Melanjutkan pemutaran musik yang dijeda"),
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
    if (!queue) {
      const errMsg = "❌ Tidak ada musik di antrean!";
      return isInteraction ? interaction.reply({ content: errMsg, ephemeral: true }) : message.reply(errMsg);
    }

    const success = queue.audioPlayer.unpause();
    if (success) {
      const msgStr = "▶️ **Melanjutkan pemutaran musik!**";
      if (isInteraction) {
        await interaction.reply(msgStr);
      } else {
        await message.reply(msgStr);
      }
    } else {
      const errMsg = "❌ Gagal melanjutkan pemutaran musik.";
      if (isInteraction) {
        await interaction.reply({ content: errMsg, ephemeral: true });
      } else {
        await message.reply(errMsg);
      }
    }
  }
};
