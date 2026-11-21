// Resolver audio YouTube dengan cache file (disk) + kualitas terbaik yang bisa diputar Discord.
//
// Kenapa dulu suaranya seperti "suara telepon":
//   player lama memakai yt.download(..., client: 'ANDROID'). Klien ANDROID kini tidak lagi
//   memberi URL audio valid (gagal decipher), dan jalur download bersifat re-encode/stream
//   progresif. Sekarang kita:
//     1) getInfo via klien WEB/YTMUSIC/IOS,
//     2) pilih format audio bitrate tertinggi (prioritas opus itag 251 = 137 kbps 48kHz stereo),
//     3) remux WEBM/Opus -> OGG/Opus dengan `-c:a copy` (tanpa re-encode, tanpa kehilangan kualitas),
//     4) simpan hasil OGG ke cache disk, lalu putar dari file (streaming stabil, tanpa dropout).
//   Fallback: jika remux gagal, tetap putar stream webm mentah (discord.js akan transcode).

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { spawn } = require("child_process");
const { Readable, pipeline } = require("stream");
const ffmpegPath = require("ffmpeg-static");
const log = require("./logger");

// --- Konfigurasi -----------------------------------------------------------
const CACHE_DIR = path.resolve(process.env.MUSIC_CACHE_DIR || path.join(__dirname, "..", "cache", "music"));
const MAX_CACHE_BYTES = Number(process.env.MUSIC_CACHE_MAX_MB || 1500) * 1024 * 1024;
const CACHE_ENABLED = process.env.MUSIC_CACHE !== "0";
const RESOLVE_TIMEOUT_MS = Number(process.env.MUSIC_RESOLVE_TIMEOUT_MS || 20000);
const DOWNLOAD_TIMEOUT_MS = Number(process.env.MUSIC_DOWNLOAD_TIMEOUT_MS || 120000);
const CLIENTS = (process.env.YT_CLIENT || "YTMUSIC,WEB,IOS").split(",").map((s) => s.trim()).filter(Boolean);
const MAX_FORMAT_ATTEMPTS = 3;

if (CACHE_ENABLED) {
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (e) { log.warn("audio", "Gagal membuat cache dir:", e.message); }
}

// --- Util ------------------------------------------------------------------
function withTimeout(promise, ms, label) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      t = setTimeout(() => reject(new Error(`${label} timeout setelah ${ms}ms`)), ms);
      t.unref?.();
    }),
  ]).finally(() => clearTimeout(t));
}

function cachePathFor(videoId, itag) {
  const safe = String(videoId).replace(/[^A-Za-z0-9_-]/g, "");
  return path.join(CACHE_DIR, `${safe}.${itag}.ogg`);
}

// Cache metadata: { videoId: { file, size, atime, title } }
function touchCacheIndex(file) {
  // atime dipakai untuk eviction — sentuh file agar tidak dihapus.
  const now = new Date();
  fs.utimes(file, now, now, () => {});
}

/** Hapus file cache paling lama sampai total di bawah batas. */
function enforceCacheLimit() {
  if (!CACHE_ENABLED) return;
  let entries;
  try {
    entries = fs.readdirSync(CACHE_DIR)
      .filter((f) => f.endsWith(".ogg"))
      .map((f) => {
        const p = path.join(CACHE_DIR, f);
        try { const s = fs.statSync(p); return { p, size: s.size, atime: s.atimeMs }; } catch { return null; }
      })
      .filter(Boolean);
  } catch { return; }

  let total = entries.reduce((a, e) => a + e.size, 0);
  if (total <= MAX_CACHE_BYTES) return;

  entries.sort((a, b) => a.atime - b.atime);
  for (const e of entries) {
    if (total <= MAX_CACHE_BYTES) break;
    try { fs.unlinkSync(e.p); total -= e.size; log.debug("audio", "Evict cache:", path.basename(e.p)); } catch {}
  }
}

/** Hapus file .part yang tertinggal dari proses yang mati. */
function cleanupPartialFiles() {
  if (!CACHE_ENABLED) return;
  try {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const f of fs.readdirSync(CACHE_DIR)) {
      if (!f.endsWith(".part")) continue;
      const p = path.join(CACHE_DIR, f);
      try { if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p); } catch {}
    }
  } catch {}
}

/** Hapus seluruh isi cache (dipakai command .cache clear). */
function clearCache() {
  if (!fs.existsSync(CACHE_DIR)) return { removed: 0, bytes: 0 };
  let removed = 0, bytes = 0;
  for (const f of fs.readdirSync(CACHE_DIR)) {
    const p = path.join(CACHE_DIR, f);
    try {
      const s = fs.statSync(p);
      if (!s.isFile()) continue;
      bytes += s.size;
      fs.unlinkSync(p);
      removed++;
    } catch {}
  }
  return { removed, bytes };
}

function cacheStats() {
  if (!fs.existsSync(CACHE_DIR)) return { files: 0, bytes: 0, dir: CACHE_DIR, maxBytes: MAX_CACHE_BYTES };
  let files = 0, bytes = 0;
  try {
    for (const f of fs.readdirSync(CACHE_DIR)) {
      const p = path.join(CACHE_DIR, f);
      try { const s = fs.statSync(p); if (s.isFile()) { files++; bytes += s.size; } } catch {}
    }
  } catch {}
  return { files, bytes, dir: CACHE_DIR, maxBytes: MAX_CACHE_BYTES };
}

// --- Resolusi format -------------------------------------------------------
async function pickBestFormat(yt, videoId) {
  let lastErr = null;
  for (const client of CLIENTS) {
    try {
      const info = await withTimeout(
        yt.getInfo(videoId, { client }),
        RESOLVE_TIMEOUT_MS,
        `getInfo(${client})`
      );
      const formats = (info.streaming_data?.adaptive_formats || [])
        .filter((f) => f.has_audio)
        .sort((a, b) => b.bitrate - a.bitrate);
      if (!formats.length) throw new Error("tidak ada format audio");

      // Utamakan Opus (native Discord), lalu m4a.
      const opus = formats.filter((f) => f.mime_type.includes("opus"));
      const ordered = [...opus, ...formats.filter((f) => !f.mime_type.includes("opus"))];

      const decoded = [];
      for (const f of ordered.slice(0, MAX_FORMAT_ATTEMPTS)) {
        try {
          const url = await f.decipher(yt.session.player);
          if (url) decoded.push({ url: String(url), itag: f.itag, mime: f.mime_type, bitrate: f.bitrate });
        } catch (e) {
          log.debug("audio", `decipher gagal itag ${f.itag}: ${e.message}`);
        }
      }
      if (!decoded.length) throw new Error("semua format gagal decipher");

      // Prioritaskan opus terbaik; kalau tidak ada, ambil bitrate tertinggi.
      decoded.sort((a, b) => {
        const ao = a.mime.includes("opus") ? 1 : 0;
        const bo = b.mime.includes("opus") ? 1 : 0;
        if (ao !== bo) return bo - ao;
        return b.bitrate - a.bitrate;
      });
      const best = decoded[0];
      log.debug("audio", `format terpilih: client=${client} itag=${best.itag} ${Math.round(best.bitrate / 1000)}kbps ${best.mime.split(";")[0]}`);
      return { ...best, client, info };
    } catch (e) {
      lastErr = e;
      log.debug("audio", `client ${client} gagal: ${e.message}`);
    }
  }
  throw new Error(`Gagal resolve audio (${videoId}): ${lastErr?.message || "unknown"}`);
}

// --- Download & remux ------------------------------------------------------
function downloadToFile(url, destPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const partial = destPath + ".part";
    const file = fs.createWriteStream(partial);
    const lib = url.startsWith("https:") ? https : http;
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      file.destroy();
      try { fs.unlinkSync(partial); } catch {}
      reject(err);
    };
    const timer = setTimeout(() => fail(new Error(`download timeout ${timeoutMs}ms`)), timeoutMs);
    timer.unref?.();

    const req = lib.get(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity" } }, (res) => {
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume();
        return fail(new Error(`HTTP ${res.statusCode}`));
      }
      pipeline(res, file, (err) => {
        if (err) return fail(err);
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { fs.renameSync(partial, destPath); resolve(destPath); } catch (e) { fail(e); }
      });
    });
    req.on("error", fail);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("socket timeout")));
  });
}

/** Remux webm/opus (atau m4a) -> ogg/opus tanpa re-encode bila memungkinkan. */
function remuxToOgg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg-static tidak tersedia"));
    const args = [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", inputPath,
      "-vn", "-map", "a:0",
      "-c:a", "copy",
      "-f", "ogg", outputPath,
    ];
    const ff = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let errBuf = "";
    ff.stderr.on("data", (d) => { if (errBuf.length < 2000) errBuf += d.toString(); });
    const timer = setTimeout(() => { try { ff.kill("SIGKILL"); } catch {} }, 90000);
    timer.unref?.();
    ff.on("error", (e) => { clearTimeout(timer); reject(e); });
    ff.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve(outputPath);
      reject(new Error(`ffmpeg exit ${code}: ${errBuf.slice(0, 300)}`));
    });
  });
}

/**
 * Siapkan sumber audio untuk videoId.
 * Mengembalikan { type:'file', path } bila cache berhasil, atau { type:'stream', stream, url } sebagai fallback.
 */
async function resolveAudioSource(yt, videoId, { allowCache = true } = {}) {
  if (!yt) throw new Error("YouTube engine belum siap");

  const cacheEnabled = CACHE_ENABLED && allowCache;
  const best = await pickBestFormat(yt, videoId);
  const finalPath = cachePathFor(videoId, best.itag);

  if (cacheEnabled && fs.existsSync(finalPath)) {
    const size = fs.statSync(finalPath).size;
    if (size > 1024) {
      touchCacheIndex(finalPath);
      log.debug("audio", `cache hit ${path.basename(finalPath)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
      return { type: "file", path: finalPath, format: best, cached: true };
    }
    try { fs.unlinkSync(finalPath); } catch {}
  }

  if (cacheEnabled) {
    const rawPath = path.join(CACHE_DIR, `${String(videoId).replace(/[^A-Za-z0-9_-]/g, "")}.${best.itag}.raw`);
    try {
      log.debug("audio", `download ${videoId} (${best.mime.split(";")[0]})`);
      const dlStart = Date.now();
      await downloadToFile(best.url, rawPath, DOWNLOAD_TIMEOUT_MS);
      try {
        await remuxToOgg(rawPath, finalPath);
        log.info("audio", `siap ${path.basename(finalPath)} dalam ${((Date.now() - dlStart) / 1000).toFixed(1)}s`);
        enforceCacheLimit();
        return { type: "file", path: finalPath, format: best, cached: false };
      } finally {
        try { fs.unlinkSync(rawPath); } catch {}
      }
    } catch (e) {
      log.warn("audio", `download/remux gagal, fallback streaming: ${e.message}`);
      try { fs.unlinkSync(rawPath); } catch {}
    }
  }

  // Fallback: streaming langsung (tanpa simpan di disk). Format mentah apa adanya.
  const lib = best.url.startsWith("https:") ? https : http;
  const nodeStream = await new Promise((resolve, reject) => {
    const req = lib.get(best.url, { headers: { "User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity" } }, (res) => {
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      resolve(res);
    });
    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("socket timeout")));
  });
  return { type: "stream", stream: Readable.from(nodeStream), format: best, cached: false };
}

cleanupPartialFiles();

module.exports = {
  resolveAudioSource,
  pickBestFormat,
  clearCache,
  cacheStats,
  enforceCacheLimit,
  CACHE_DIR,
  MAX_CACHE_BYTES,
};
