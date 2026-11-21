// Web server ringan (http bawaan Node) untuk health check & monitoring.
// Instabox/hosting meming PORT 3000 via UptimeRobot tiap 15 menit.
// Endpoint:
//   GET /        -> teks sederhana "RyzuBotz Online!"
//   GET /health  -> JSON { status, checks } (HTTP 200 bila sehat, 503 bila bermasalah)
//   GET /status  -> JSON uptime, memory, guild, dsb (tanpa data sensitif)
// Ping rutin UptimeRobot tidak memicu write DB/playback — hanya read-only.

const http = require("http");
const os = require("os");
const log = require("./logger");

const startedAt = Date.now();

/** status: { discord:'ok'|'error'|'unknown', yt:'ok'|'error'|'unknown', audio:'ok'|'error'|'unknown' } */
function createServer(statusFn) {
  return http.createServer((req, res) => {
    const url = (req.url || "/").split("?")[0];
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (url === "/health" || url === "/healthz") {
      let s = { discord: "unknown", yt: "unknown", audio: "unknown" };
      try { s = statusFn() || s; } catch {}
      const ok =
        (s.discord === "ok" || s.discord === "unknown") &&
        (s.yt === "ok" || s.yt === "unknown") &&
        (s.audio === "ok" || s.audio === "unknown");
      const body = JSON.stringify({
        status: ok ? "ok" : "degraded",
        service: "RyzuBotz",
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        timestamp: new Date().toISOString(),
        checks: s,
      });
      res.writeHead(ok ? 200 : 503, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(body);
    }

    if (url === "/status") {
      const mem = process.memoryUsage();
      const body = JSON.stringify({
        service: "RyzuBotz",
        node: process.version,
        uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
        memory: { rssMB: Math.round(mem.rss / 1048576), heapUsedMB: Math.round(mem.heapUsed / 1048576) },
        platform: `${os.type()} ${os.arch()}`,
        loadavg: os.loadavg().map((n) => Number(n.toFixed(2))),
        timestamp: new Date().toISOString(),
      });
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(body);
    }

    // Root & fallback
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("🤖 RyzuBotz Online!");
  });
}

function startWebServer(statusFn) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";
  const server = createServer(statusFn);
  return new Promise((resolve) => {
    server.once("error", (err) => {
      log.error("web", `Web server gagal di port ${port}: ${err.message}`);
      resolve(null); // Jangan crash bot karena port dipakai proses lain.
    });
    server.listen(port, host, () => {
      log.info("web", `Web server berjalan di http://${host}:${port} (health: /health)`);
      resolve(server);
    });
  });
}

module.exports = { createServer, startWebServer, startedAt };
