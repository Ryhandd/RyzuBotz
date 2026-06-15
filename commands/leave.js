const { getQueue } = require("../utils/player");
const { SlashCommandBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");

module.exports = {
  name: "leave",
  alias: ["dc", "disconnect", "out"],
  description: "Keluar dari voice channel dan menghapus antrean",
  slashData: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Keluar dari voice channel dan menghapus antrean"),
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
      const meVoice = guild.members.me.voice.channel;
      if (meVoice) {
        const connection = getVoiceConnection(guild.id);
        if (connection) connection.destroy();
        const msgStr = "👋 **Berhasil keluar dari voice channel!**";
        return isInteraction ? interaction.reply(msgStr) : message.reply(msgStr);
      }
      const errMsg = "❌ Aku tidak sedang berada di voice channel mana pun!";
      return isInteraction ? interaction.reply({ content: errMsg, ephemeral: true }) : message.reply(errMsg);
    }

    queue.destroy();
    const msgStr = "👋 **Keluar dari voice channel dan mengosongkan antrean!**";
    if (isInteraction) {
      await interaction.reply(msgStr);
    } else {
      await message.reply(msgStr);
    }
  }
};
