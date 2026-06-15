const { getQueue } = require("../utils/player");
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "stop",
  alias: ["clear"],
  description: "Menghentikan pemutaran musik dan mengosongkan antrean",
  slashData: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Menghentikan pemutaran musik dan mengosongkan antrean"),
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
      const errMsg = "❌ Tidak ada musik yang sedang diputar!";
      return isInteraction ? interaction.reply({ content: errMsg, ephemeral: true }) : message.reply(errMsg);
    }

    queue.stop();
    const msgStr = "⏹️ **Musik dihentikan dan antrean dikosongkan!**";
    if (isInteraction) {
      await interaction.reply(msgStr);
    } else {
      await message.reply(msgStr);
    }
  }
};
