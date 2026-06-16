require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();
const prefix = process.env.PREFIX || ".";

const { Innertube, Platform } = require("youtubei.js");

Platform.shim.eval = async (data, env) => {
  const func = new Function(...Object.keys(env), data.output);
  return func(...Object.values(env));
};

// Initialize YouTube Engine
Innertube.create().then(yt => {
  client.yt = yt;
  console.log("✅ YouTube Engine (YouTube.js) initialized!");
}).catch(err => {
  console.error("❌ Failed to initialize YouTube Engine:", err);
});

// Load commands
const commandsFolder = path.join(__dirname, "commands");
if (!fs.existsSync(commandsFolder)) {
  fs.mkdirSync(commandsFolder, { recursive: true });
}

const commandFiles = fs.readdirSync(commandsFolder).filter(file => file.endsWith(".js"));

console.log("📂 Loading commands...");
for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsFolder, file));
    if (command.name) {
      client.commands.set(command.name.toLowerCase(), command);
      console.log(`✅ Loaded: ${command.name}`);
    }
  } catch (err) {
    console.error(`❌ Gagal load command ${file}:`, err);
  }
}

// Ready event
client.once("clientReady", () => {
  console.log(`\n========================================`);
  console.log(`🤖 Ryzu Discord Bot online!`);
  console.log(`📱 Logged in as: ${client.user.tag}`);
  console.log(`⏰ Waktu: ${new Date().toLocaleString("id-ID")}`);
  console.log(`👉 Prefix: ${prefix}`);
  console.log(`========================================\n`);

  // Set activity status
  client.user.setActivity(`${prefix}help | Play Music`, { type: 2 }); // Listening to ...

  // Deploy slash (application) commands dynamically
  const { REST, Routes } = require("discord.js");
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  const slashCommands = [];
  client.commands.forEach(cmd => {
    if (cmd.slashData) {
      slashCommands.push(cmd.slashData.toJSON());
    }
  });

  (async () => {
    try {
      console.log("🔄 Deploying application (/) commands globally...");
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: slashCommands }
      );
      console.log("✅ Successfully reloaded global application (/) commands.");

      // Clean up guild-specific commands to prevent duplication
      console.log("🔄 Cleaning up guild-specific commands to prevent duplication...");
      for (const guild of client.guilds.cache.values()) {
        try {
          await rest.put(
            Routes.applicationGuildCommands(client.user.id, guild.id),
            { body: [] }
          );
          console.log(`🧹 Cleared guild-specific commands for server: ${guild.name} (${guild.id})`);
        } catch (guildError) {
          console.error(`❌ Failed to clear guild-specific commands for server ${guild.name}:`, guildError.message);
        }
      }
    } catch (error) {
      console.error("❌ Failed to deploy application (/) commands:", error);
    }
  })();
});

// Message handler
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  if (!content.startsWith(prefix)) return;

  const args = content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName) || 
                  client.commands.find(cmd => cmd.alias && cmd.alias.includes(commandName));

  if (!command) return;

  try {
    await command.execute({
      client,
      message,
      args,
      prefix,
      command: commandName
    });
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);
    message.reply("❌ Terjadi kesalahan saat menjalankan perintah tersebut!").catch(() => {});
  }
});

// Interaction (Slash Command) handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute({
      client,
      interaction,
      args: [],
      prefix: "/",
      command: interaction.commandName
    });
  } catch (error) {
    console.error(`Error executing slash command ${interaction.commandName}:`, error);
    const replyPayload = { content: "❌ Terjadi kesalahan saat menjalankan perintah tersebut!", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(replyPayload).catch(() => {});
    } else {
      await interaction.reply(replyPayload).catch(() => {});
    }
  }
});

// Error handling to prevent crash
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("⚠️ Uncaught Exception:", error);
});

// Login using DISCORD_TOKEN
const token = process.env.DISCORD_TOKEN;
if (!token || token === "MASUKKAN_TOKEN_DISCORD_BOT_DISINI") {
  console.error("❌ ERROR: Harap masukkan DISCORD_TOKEN Anda di file .env terlebih dahulu!");
} else {
  client.login(token).catch(err => {
    console.error("❌ Gagal login ke Discord:", err.message);
  });
}
