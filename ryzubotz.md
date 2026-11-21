# RyzuBotz — Dokumentasi Teknis

> Discord bot (discord.js v14) untuk pemutar musik YouTube dan perintah gambar anime.
> Dokumen ini mencerminkan implementasi **terkini** setelah audit & refactor.
> Platform: Node.js 20+ (diuji di Node 25 / Windows), 100% JavaScript CommonJS.

---

## 1. Ringkasan

| Aspek | Keterangan |
|---|---|
| Nama bot | RyzuBotz |
| Library | `discord.js` v14 + `@discordjs/voice` |
| Trigger | Prefix pesan (default `.`) dan Slash Command `/` (deploy global otomatis) |
| Fitur utama | Musik YouTube di voice channel (antrean, cache disk, volume, repeat, shuffle), perintah gambar anime, health check HTTP |
| Web server | `http` bawaan Node, port `3000` (env `PORT`) — untuk UptimeRobot |
| Pencarian YouTube | `youtubei.js` (Innertube) + `yt-search` |
| Audio | `ffmpeg-static` (remux opus), `@discordjs/voice` (OggOpus stream) |
| Entry point | `index.js` |

**Penting:** ini adalah bot **Discord**, bukan Telegram.

---

## 2. Struktur Project

```text
RyzuBotz/
├── index.js              # Entry: client Discord, loader command, web server, shutdown
├── package.json
├── .env.example          # Template konfigurasi
├── .gitignore
├── README.md             # Panduan singkat untuk pengguna
├── ryzubotz.md           # Dokumen ini (dokumentasi teknis)
├── cache/
│   └── music/            # Cache file .ogg (dibuat otomatis, di-gitignore)
├── commands/             # 24 command
│   ├── awoo.js           ├── bluearchive.js   ├── cache.js
│   ├── foxgirl.js        ├── headphones.js    ├── help.js
│   ├── hoodie.js         ├── leave.js         ├── maid.js
│   ├── neko.js           ├── pause.js         ├── pinterest.js
│   ├── play.js           ├── queue.js         ├── repeat.js
│   ├── resume.js         ├── search.js        ├── shuffle.js
│   ├── skip.js           ├── status.js        ├── stop.js
│   ├── volume.js         ├── vtuber.js        ├── waifu.js
└── utils/
    ├── audio.js          # Resolve YouTube → unduh → remux OGG → cache
    ├── logger.js         # Logger bertingkat
    ├── player.js         # GuildQueue (antrean per-guild) + auto-leave + watchdog
    └── web.js            # HTTP server: /, /health, /status
```

---

## 3. Konfigurasi (`.env`)

| Variabel | Default | Keterangan |
|---|---|---|
| `DISCORD_TOKEN` | — | **Wajib.** Token bot dari Discord Developer Portal. Bisa diisi dari Developer Portal tab Bot dengan sekali tekan (Reset Token). |
| `PREFIX` | `.` | Prefix perintah teks |
| `PORT` | `3000` | Port web server |
| `HOST` | `0.0.0.0` | Bind address web server |
| `LOG_LEVEL` | `info` | `error` / `warn` / `info` / `debug` |
| `YT_CLIENT` | `YTMUSIC,WEB,IOS` | Urutan klien Innertube yang dicoba |
| `MUSIC_CACHE` | `1` | `0` untuk menonaktifkan cache disk |
| `MUSIC_CACHE_DIR` | `./cache/music` | Lokasi cache |
| `MUSIC_CACHE_MAX_MB` | `1500` | Batas ukuran cache (MB), evict file paling lama |
| `MUSIC_RESOLVE_TIMEOUT_MS` | `20000` | Timeout resolve metadata YouTube |
| `MUSIC_DOWNLOAD_TIMEOUT_MS` | `120000` | Timeout unduh audio |
| `MAX_QUEUE_SIZE` | `100` | Maksimal lagu per antrean guild |
| `MAX_GUILD_QUEUES` | `200` | Maksimal antrean guild aktif (proteksi memory) |

Salin `.env.example` → `.env` lalu isi `DISCORD_TOKEN`.

---

## 4. Arsitektur

### 4.1 Alur startup (`index.js`)

1. Muat `dotenv`, buat `Client` dengan intents: `Guilds`, `GuildVoiceStates`, `GuildMessages`, `MessageContent`.
2. Patch `Platform.shim.eval` untuk `youtubei.js` (agar evaluasi signature berjalan di Node).
3. Inisialisasi Innertube (`Innertube.create()`); status disimpan di `health.yt`.
4. Load semua file `commands/*.js` ke `client.commands` (Map berdasarkan nama lowercase), hitung total.
5. `clientReady`: set activity, deploy slash command global via `REST` + `Routes.applicationCommands`.
6. Handler `messageCreate` (prefix) dan `interactionCreate` (slash).
7. Mulai web server `startWebServer(getHealthStatus)`.
8. `SIGINT`/`SIGTERM` → graceful shutdown (`client.destroy`, `server.close`, `exit(0)` ≤1.5 s, hard exit 5 s).
9. Jika token hilang/invalid: web server **tetap hidup**, status `/health` menjadi `503` (degraded).

### 4.2 Handler command

```js
// pesan
await command.execute({ client, message, args, prefix, command: commandName });
// slash
await command.execute({ client, interaction, args: [], prefix: "/", command: interaction.commandName });
```

Alias didukung lewat properti `alias: [...]`. Error dari command ditangkap dan dibalas pesan error singkat.

Module command boleh mengekspor `slashData` (`SlashCommandBuilder`) — hanya command yang punya `slashData` yang di-deploy.

### 4.3 Health & monitoring

- `health = { discord, yt, audio }` di-update oleh event Discord (`clientReady`, `disconnected`, `reconnecting`) dan inisialisasi Innertube.
- `GET /health` (juga `/healthz`) → `200` bila semua `ok`/`unknown`; `503` bila ada `error`.
- `GET /status` → JSON uptime, memory, guild, cache.
- `GET /` → teks `RyzuBotz Online!`.
- Target UptimeRobot: `https://<host>/health` setiap **15 menit**.

---

## 5. Sistem Musik

### 5.1 Pipeline (`utils/audio.js`, 302 baris)

```
videoId → Innertube.getInfo(client: YTMUSIC, WEB, IOS)
        → pickBestFormat (utamakan opus itag 251 ≈ 137 kbps 48 kHz stereo)
        → decipher URL
        → downloadToFile  → file .part → rename
        → remuxToOgg     → ffmpeg -c:a copy webm → ogg (tanpa re-encode)
        → cache (touch atime, enforceCacheLimit)
        → resolveAudioSource → path file .ogg
```

Fungsi yang diekspor: `resolveAudioSource`, `pickBestFormat`, `clearCache`, `cacheStats`, `enforceCacheLimit`, `CACHE_DIR`, `MAX_CACHE_BYTES`.

- `withTimeout(fn, ms)` membungkus resolve/unduh.
- `cleanupPartialFiles()` menghapus `.part` yatim saat startup.
- `enforceCacheLimit()` menghapus file dengan `atime` tertua bila total > `MAX_CACHE_BYTES`.
- Fallback: bila remux gagal, putar stream webm mentah (di-transcode oleh Discord).

### 5.2 GuildQueue (`utils/player.js`, 274 baris)

Satu instance per guild, disimpan di `Map` `queues` (maks `MAX_GUILD_QUEUES`).

| Method | Perilaku |
|---|---|
| `play(song)` | Tambah lagu, putar bila idle |
| `playNext()` | Ambil lagu berikutnya, buat resource, set volume, putar |
| `skip()` | Lanjut ke lagu berikutnya |
| `pause()` / `resume()` | Berdasarkan `audioPlayer.state.status` |
| `setVolume(v)` | Clamp `0.1`–`2.0` (inline volume) |
| `shuffle()` | Fisher–Yates pada sisa antrean |
| `setRepeat(mode)` | `off` / `one` / `queue`; mode tidak valid → `false` |
| `stop()` | Hentikan playback, kosongkan antrean |
| `destroy()` | Bersihkan timer, listener, voice connection |

Perilaku tambahan:
- **Auto-leave**: `setupAutoLeave()` — jika voice channel kosong (0 manusia) dan antrean kosong selama 60 s → keluar.
- **Connection watchdog**: `setupConnectionWatchdog()` — `Disconnected` → `Signalling`/`Connecting`, timeout 5 s lalu reconnect.
- Resource dibuat dengan `StreamType.OggOpus` dari file cache → kualitas stabil, tanpa "suara telepon".

---

## 6. Daftar Command (24)

### Musik
| Command | Deskripsi |
|---|---|
| `play` | Putar musik dari YouTube (judul atau URL: `watch?v=`, `/shorts/`, `/live/`, `youtu.be`). Reconnect voice bila channel berbeda. |
| `pause` | Jeda pemutaran |
| `resume` | Lanjutkan pemutaran |
| `skip` | Lewati lagu saat ini |
| `stop` | Hentikan dan kosongkan antrean, keluar voice |
| `leave` | Keluar voice channel & hapus antrean (bekerja walau user tidak di VC) |
| `queue` | Daftar antrean, pagination 10 per halaman |
| `volume` | Atur volume 10–200 (→ `setVolume(level/100)`) |
| `repeat` | Mode `off` / `one` / `queue` |
| `shuffle` | Acak antrean (minimal 2 lagu) |
| `search` | Cari lagu YouTube (top 8) tanpa memutar |

### Utility
| Command | Deskripsi |
|---|---|
| `help` | Daftar semua command, dikelompokkan per kategori |
| `status` | Uptime, RAM, versi Node, jumlah guild, antrean aktif, statistik cache, status YouTube |
| `cache` | `info` / `clear` (diblokir saat memutar) / `trim` |

### Gambar / Hiburan
| Command | Sumber |
|---|---|
| `awoo`, `bluearchive`, `foxgirl`, `headphones`, `hoodie`, `maid`, `vtuber` | Nekosia (gambar random) |
| `neko`, `waifu` | Gambar random |
| `pinterest` | Pencarian gambar Pinterest |

---

## 7. Perubahan dari Versi Lama (ringkas)

| Area | Masalah lama | Perbaikan |
|---|---|---|
| `commands/play.js` | Regex URL typo (`u\/\w\/`) + urutan branch → `videoId` kosong bila kirim URL | Deteksi link eksplisit, `getYouTubeID` di jalur link, validasi null, metadata via `yts({ videoId })` |
| `commands/help.js` | `delete require.cache` + re-require tiap panggilan (bocor memory/CPU) | Iterasi `client.commands` langsung |
| `commands/leave.js` | Gagal bila user tidak berada di VC | Cek queue/connection secara mandiri |
| `pause`/`resume` | Memanggil `audioPlayer` langsung | Lewat state `GuildQueue` |
| `utils/player.js` | Audio stream mentah (kualitas rendah), tanpa cleanup | Remux OggOpus + cache + auto-leave + watchdog + batas guild |
| `index.js` | Tanpa monitoring, tanpa graceful shutdown | Web server health, tracking status, shutdown SIGINT/SIGTERM |

---

## 8. Hosting & Deployment (Instabox)

1. Siapkan file `.env` berisi `DISCORD_TOKEN` (+ opsi lain sesuai kebutuhan).
2. Jalankan: `npm install` lalu `npm start` (atau `node index.js`).
3. Pastikan port `3000` (atau `PORT`) dapat diakses publik.
4. Daftarkan monitor **UptimeRobot** setiap **15 menit** ke `https://<host>/health`.
   - `200 OK` = bot sehat.
   - `503` = degraded (contoh: token invalid / Discord terputus).
5. Cache musik butuh ruang disk ± hingga `MUSIC_CACHE_MAX_MB` (default 1500 MB). Gunakan volume persisten bila memungkinkan.

---

## 9. Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Bot tidak online | `DISCORD_TOKEN` kosong / salah | Isi token valid di `.env`, cek log (`LOG_LEVEL=debug`) |
| `/health` 503 tapi web hidup | Login Discord gagal | Periksa token & koneksi; status `discord: "error"` |
| Tidak ada suara | Voice channel permission | Beri izin Connect + Speak + Use Voice Activity |
| Suara terputus/putus-putus | Disk penuh / download lambat | Cek `%cache info%`, naikkan timeout, atau `%cache trim%` |
| Slash command tidak muncul | Deploy global butuh waktu propagasi | Tunggu ±1 jam atau mode dev guild |
| Memori naik terus | Terlalu banyak guild | Kurangi `MAX_GUILD_QUEUES`, restart berkala |

---

## 10. Catatan Keamanan

- Tidak pernah mencetak token/API key ke log.
- Cache dir & `*.log` sudah masuk `.gitignore`.
- Endpoint HTTP bersifat read-only, tanpa data sensitif.
- Kunci provider AI (mis. BangunWeb `bwr_live_...`) tidak boleh ditulis di repo maupun dokumen; gunakan environment variable.
