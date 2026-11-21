// Logger sederhana dengan level. LOG_LEVEL=error|warn|info|debug (default: info)
// Tidak pernah menulis token/secret — pemanggil tidak boleh mengirim secret ke sini.
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[(process.env.LOG_LEVEL || "info").toLowerCase()] ?? LEVELS.info;

function format(args) {
  return args
    .map((a) => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === "string") return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(" ");
}

function write(lvl, tag, args) {
  if (LEVELS[lvl] > currentLevel) return;
  const line = `[${new Date().toISOString()}] [${lvl.toUpperCase()}]${tag ? ` [${tag}]` : ""} ${format(args)}`;
  if (lvl === "error") console.error(line);
  else if (lvl === "warn") console.warn(line);
  else console.log(line);
}

module.exports = {
  error: (tag, ...args) => write("error", tag, args),
  warn: (tag, ...args) => write("warn", tag, args),
  info: (tag, ...args) => write("info", tag, args),
  debug: (tag, ...args) => write("debug", tag, args),
};
