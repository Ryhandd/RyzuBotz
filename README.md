# 🤖 RyzuBotz — Discord Music & Media Bot

Script Discord Bot yang memiliki fitur pemutar musik (kualitas audio opus 137 kbps + cache) serta perintah pencarian gambar anime / media berbasis API yang aman (SFW).

Bot ini mendukung penggunaan **Prefix Tradisional (`.`)** sekaligus **Slash Commands (`/`)** yang terintegrasi langsung dengan antarmuka Discord.

Dilengkapi **web server port 3000** dengan endpoint health check untuk monitoring UptimeRobot, dan siap dijalankan di hosting **Instabox**.

---

## 🛠️ Persyaratan
- Node.js **v18+** (direkomendasikan v20/v22; v16 tidak lagi didukung youtubei.js terbaru)
- **FFmpeg** (otomatis via `ffmpeg-static`; tidak perlu install manual)
- Discord Bot Token

---

## ⚙️ Cara Setup

### 1. Buat Discord Bot Application
1. Masuk ke [Discord Developer Portal](https://discord.com/developers/applications).
2. Buat aplikasi baru dengan mengeklik **New Application**.
3. Masuk ke tab **Bot**, lalu klik **Reset Token** untuk menyalin token Discord Bot Anda.
4. Aktifkan bagian **Privileged Gateway Intents** (aktifkan **Server Members Intent** dan **Message Content Intent**).
5. Masuk ke tab **OAuth2** > **URL Generator**:
   - **Scopes**: Centang **`bot`** dan **`applications.commands`** (Wajib agar menu `/` muncul di server).
   - **Bot Permissions**: Centang `Connect`, `Speak`, `Send Messages`, `Embed Links`, `Read Message History`, `Use Voice Activity`.
   - Salin tautan yang dihasilkan di bagian bawah dan buka di browser untuk mengundang bot ke server Discord Anda.

### 2. Konfigurasi Environment
```bash
# Salin contoh konfigurasi
cp .env.example .env
# Lalu edit .env dan isi DISCORD_TOKEN
```

Variabel penting (lihat `.env.example` untuk daftar lengkap):
```env
DISCORD_TOKEN=your_real_discord_bot_token_here
PREFIX=.
PORT=3000
```

### 3. Instalasi & Jalankan
```bash
npm install
npm start
```

Bot akan otomatis:
- Menginisialisasi YouTube engine (youtubei.js)
- Mendaftarkan Slash Commands (`/`) secara global
- Menjalankan web server di port `3000` (`/`, `/health`, `/status`)

---

## 🌐 Web Server & UptimeRobot

Saat bot berjalan, tiga endpoint tersedia (port `PORT`, default `3000`):

| Endpoint | Keterangan |
| :--- | :--- |
| `GET /` | Status teks singkat "RyzuBotz Online" |
| `GET /health` | JSON health check: `{status, checks:{discord,yt,audio,cache}}`. HTTP **503** jika bot bermasalah. Ringan, cocok untuk UptimeRobot. |
| `GET /status` | JSON uptime, RAM, Node version, platform (tanpa data sensitif) |

### Setup UptimeRobot
1. Buat akun di [uptimerobot.com](https://uptimerobot.com).
2. Add New Monitor → tipe **HTTP(s)**.
3. URL: `https://ALAMAT-HOSTING-ANDA/health`
4. Interval: **15 menit** (atau lebih sering).
5. Simpan. Jika `/health` mengembalikan 503, UptimeRobot akan menandai bot down dan mengirim notifikasi.

> Catatan: ping UptimeRobot membantu mencegah idle-sleep di sebagian platform, tetapi tidak menjamin hosting selalu aktif — periksa kebijakan hosting masing-masing.

---

## 🎵 Sistem Musik (Arsitektur Audio)

Pipeline audio (di `utils/audio.js` + `utils/player.js`):

1. **Resolve** — metadata + format stream diambil via `yt.getInfo` dengan klien berurutan `YTMUSIC → WEB → IOS` (env `YT_CLIENT`).
2. **Pilih format terbaik** — prioritas codec **opus**, lalu bitrate tertinggi (umumnya **itag 251 webm/opus ~137 kbps 48 kHz stereo**).
3. **Decipher URL** — URL stream di-decipher dengan player session.
4. **Unduh + remux** — audio webm diunduh ke cache (`.part` → rename atomik), lalu di-**remux** ke `ogg/opus` dengan FFmpeg `-c:a copy` (tanpa re-encode → tanpa kehilangan kualitas, CPU hampir nol).
5. **Putar** — file `.ogg` dibaca sebagai stream dan dikirim ke Discord voice dengan `StreamType.OggOpus`.

### Cache
- Lokasi default: `./cache/music` (env `MUSIC_CACHE_DIR`).
- Format: `<videoId>.<itag>.ogg` — lagu kedua kali diputar **langsung dari cache** (tanpa unduh ulang).
- Batas: `MUSIC_CACHE_MAX_MB` (default **1500 MB**); file terlama dihapus otomatis (`enforceCacheLimit`).
- Matikan cache: `MUSIC_CACHE=0` (selalu streaming langsung).

### Kenapa kualitas sekarang jernih?
Sebelumnya bot memakai `yt.download(client:'ANDROID')` yang kini gagal/terdegradasi di sumber YouTube, menghasilkan audio rendah kualitas. Sekarang audio diambil dari klien YTMUSIC/WEB dengan opus bitrate tertinggi, dan hanya di-*remux* (bukan dikonversi ulang) sehingga tidak ada penurunan kualitas tambahan.

---

## 📋 Perintah Bot (Mendukung Prefix `.` dan Slash `/`)

### 🎵 Musik & Voice Perintah
| Perintah (Prefix) | Slash Command | Deskripsi |
| :--- | :--- | :--- |
| `.play <judul/link>` | `/play <query>` | Mencari dan memutar musik dari YouTube di Voice Channel. |
| `.skip` (atau `.s`) | `/skip` | Melewati lagu yang sedang diputar. |
| `.stop` | `/stop` | Menghentikan pemutaran, mengosongkan antrean, dan keluar dari voice. |
| `.pause` | `/pause` | Menjeda lagu yang sedang berjalan. |
| `.resume` | `/resume` | Melanjutkan kembali lagu yang dijeda. |
| `.queue` (atau `.q`) | `/queue` | Menampilkan daftar antrean lagu saat ini. |
| `.volume <10-200>` | `/volume <level>` | Mengatur volume pemutaran. |
| `.repeat <off/one/queue>` | `/repeat <mode>` | Mode pengulangan lagu/antrean. |
| `.shuffle` | `/shuffle` | Mengacak urutan antrean. |
| `.search <query>` | `/search <query>` | Mencari lagu di YouTube tanpa memutar. |
| `.leave` (atau `.dc`) | `/leave` | Mengeluarkan bot dari voice channel dan menghapus antrean. |
| `.help` (atau `.menu`) | `/help` | Menampilkan seluruh menu bantuan perintah bot. |

### 🛠️ Utility & Monitoring
| Perintah | Deskripsi |
| :--- | :--- |
| `.status` | Status bot: uptime, RAM, guild, queue aktif, cache, YouTube engine. |
| `.cache` | Info cache musik; `.cache clear` hapus, `.cache trim` pangkas ke batas. |

### 🌸 Media & Anime Perintah (Nekosia API & Pinterest)
| Perintah (Prefix) | Slash Command | Deskripsi |
| :--- | :--- | :--- |
| `.neko` | `/neko` | Mengirim gambar neko (catgirl) random. |
| `.waifu` | `/waifu` | Mengirim gambar waifu random. |
| `.awoo` | `/awoo` | Mengirim gambar wolfgirl/awoo random. |
| `.foxgirl` | `/foxgirl` | Mengirim gambar foxgirl random. |
| `.maid` | `/maid` | Mengirim gambar maid random. |
| `.vtuber` | `/vtuber` | Mengirim gambar VTuber random. |
| `.headphones` | `/headphones` | Mengirim gambar anime dengan headphone random. |
| `.bluearchive` | `/bluearchive` | Mengirim gambar bertema Blue Archive random. |
| `.hoodie` | `/hoodie` | Mengirim gambar anime ber-hoodie random. |
| `.pinterest <query>` | `/pinterest <query>` | Mencari dan mengirim gambar Pinterest berdasarkan kata kunci. |

---

## 📦 Deployment (Instabox / VPS)

1. Upload project ke hosting (atau clone repo).
2. Pastikan Node.js ≥ 18 tersedia, lalu `npm install`.
3. Isi `.env` (minimal `DISCORD_TOKEN`, `PREFIX`, `PORT=3000`).
4. Start command: `npm start` (atau `node index.js`).
5. Web server bind di `0.0.0.0:3000` — gunakan alamat itu untuk UptimeRobot/Instabox health.
6. FFmpeg tersedia otomatis via `ffmpeg-static` (binary diunduh saat `npm install`).

Bot memakai long-polling gateway Discord — tidak perlu webhook/SSL tambahan.

### Troubleshooting
| Masalah | Penyebab & solusi |
| :--- | :--- |
| `/health` 503 | Cek log: kemungkinan `DISCORD_TOKEN` salah atau koneksi gateway terputus. |
| "An invalid token was provided" | Token `.env` salah/kosong. Reset token di Developer Portal. |
| Musik lambat mulai pertama kali | Unduhan pertama mengikuti bandwidth server ke googlevideo (~100 s untuk lagu 3 MB pada koneksi 250 kbps). Putaran berikutnya instan dari cache. |
| Audio tidak keluar | Pastikan bot punya permission **Connect + Speak** di voice channel. |
| Cache penuh | Otomatis di-evict; atau jalankan `.cache clear`. |
| Port 3000 dipakai proses lain | Set `PORT` lain di `.env`. |

---

## 📁 Struktur Project

```
RyzuBotz/
├── index.js            # Entry point: Discord client, YouTube engine, web server, shutdown
├── commands/           # 24 command (musik, media, utility)
├── utils/
│   ├── audio.js        # Resolve YouTube → unduh → remux ogg/opus → cache
│   ├── player.js       # GuildQueue: antrean, playback, volume, repeat, auto-leave
│   ├── web.js          # Web server (/, /health, /status) port 3000
│   └── logger.js       # Logger berlevel (error/warn/info/debug)
├── cache/music/        # Cache audio (dibuat otomatis, di-gitignore)
├── .env                # Konfigurasi rahasia (tidak di-commit)
└── .env.example        # Template konfigurasi
```

Dokumentasi teknis lengkap: lihat `ryzubotz.md`.
