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
    const botChannel = guild.members.me.voice.channel;

    const queue = getQueue(guild.id);
    if (!queue && !botChannel) {
      const errMsg = "❌ Aku tidak sedang berada di voice channel mana pun!";
      return isInteraction ? interaction.reply({ content: errMsg, ephemeral: true }) : message.reply(errMsg);
    }

    if (queue) {
      queue.destroy();
    } else {
      const connection = getVoiceConnection(guild.id);
      if (connection) {
        try { connection.destroy(); } catch (_) {}
      }
    }

    const msgStr = "👋 **Keluar dari voice channel dan mengosongkan antrean!**";
    if (isInteraction) {
      await interaction.reply(msgStr);
    } else {
      await message.reply(msgStr);
    }
  }
};
