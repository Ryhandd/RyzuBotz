require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const log = require("./utils/logger");
const { startWebServer } = require("./utils/web");
const { cacheStats } = require("./utils/audio");

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

// Status realtime untuk /health (diperbarui oleh event Discord & YouTube engine)
const health = { discord: "unknown", yt: "unknown", audio: "unknown" };
let ytReady = false;

// Initialize YouTube Engine
Innertube.create().then(yt => {
  client.yt = yt;
  ytReady = true;
  health.yt = "ok";
  log.info("bot", "✅ YouTube Engine (YouTube.js) initialized!");
}).catch(err => {
  health.yt = "error";
  log.error("bot", "❌ Failed to initialize YouTube Engine:", err.message);
});

// Load commands
const commandsFolder = path.join(__dirname, "commands");
if (!fs.existsSync(commandsFolder)) {
  fs.mkdirSync(commandsFolder, { recursive: true });
}

const commandFiles = fs.readdirSync(commandsFolder).filter(file => file.endsWith(".js"));

log.info("bot", "📂 Loading commands...");
for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsFolder, file));
    if (command.name) {
      client.commands.set(command.name.toLowerCase(), command);
      log.debug("bot", `✅ Loaded: ${command.name}`);
    }
  } catch (err) {
    log.error("bot", `❌ Gagal load command ${file}:`, err.message);
  }
}
log.info("bot", `📂 ${client.commands.size} command dimuat.`);

// Ready event
client.once("clientReady", () => {
  health.discord = "ok";
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
      log.info("bot", "🔄 Deploying application (/) commands globally...");
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: slashCommands }
      );
      log.info("bot", "✅ Successfully reloaded global application (/) commands.");
    } catch (error) {
      log.error("bot", "❌ Failed to deploy application (/) commands:", error.message);
    }
  })();
});

client.on("disconnected", () => {
  health.discord = "error";
});
client.on("reconnecting", () => {
  health.discord = "unknown";
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
    log.error("bot", `Error executing command ${commandName}:`, error.message);
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
    log.error("bot", `Error executing slash command ${interaction.commandName}:`, error.message);
    const replyPayload = { content: "❌ Terjadi kesalahan saat menjalankan perintah tersebut!", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(replyPayload).catch(() => {});
    } else {
      await interaction.reply(replyPayload).catch(() => {});
    }
  }
});

// Error handling to prevent crash
process.on("unhandledRejection", (reason) => {
  log.error("bot", "⚠️ Unhandled Rejection:", reason instanceof Error ? reason.stack : reason);
});

process.on("uncaughtException", (error) => {
  log.error("bot", "⚠️ Uncaught Exception:", error.stack || error.message);
});

// ===== Web server (port 3000 / PORT) untuk health check UptimeRobot =====
function getHealthStatus() {
  const cs = cacheStats();
  health.audio = health.yt === "ok" ? "ok" : health.yt;
  return {
    discord: health.discord,
    yt: health.yt,
    audio: health.audio,
    cache: { files: cs.files, mb: Math.round(cs.bytes / 1048576) },
  };
}

let webServer = null;
startWebServer(getHealthStatus).then((srv) => { webServer = srv; });

// ===== Graceful shutdown =====
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("bot", `📴 ${signal} diterima — mematikan bot dengan rapi...`);

  try { client.destroy(); } catch (e) {}
  try { if (webServer) webServer.close(); } catch (e) {}

  // Beri waktu flush log, lalu keluar.
  setTimeout(() => process.exit(0), 1500);
  // Jangan gantung selamanya.
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Login using DISCORD_TOKEN
const token = process.env.DISCORD_TOKEN;
if (!token || token === "MASUKKAN_TOKEN_DISCORD_BOT_DISINI") {
  log.error("bot", "❌ ERROR: Harap masukkan DISCORD_TOKEN Anda di file .env terlebih dahulu!");
  log.error("bot", "Web server tetap berjalan agar health check tidak gagal.");
} else {
  client.login(token).catch(err => {
    health.discord = "error";
    log.error("bot", "❌ Gagal login ke Discord:", err.message);
  });
}
