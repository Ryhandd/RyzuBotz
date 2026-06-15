# 🤖 Ryzu Discord Bot

Script Discord Bot yang memiliki fitur pemutar musik (menggunakan voice connection premium) serta perintah pencarian gambar anime / media berbasis API yang aman (SFW).

Bot ini mendukung penggunaan **Prefix Tradisional (`.`)** sekaligus **Slash Commands (`/`)** yang terintegrasi langsung dengan antarmuka Discord.

---

## 🛠️ Persyaratan
- Node.js (v16.x atau lebih tinggi)
- FFmpeg (sudah terinstal/terdeteksi di sistem)
- Discord Bot Token

---

## ⚙️ Cara Setup

### 1. Buat Discord Bot Application
1. Masuk ke [Discord Developer Portal](https://discord.com/developers/applications).
2. Buat aplikasi baru dengan mengeklik **New Application**.
3. Masuk ke tab **Bot**, lalu klik **Reset Token** untuk menyalin token Discord Bot Anda.
4. Aktifkan bagian **Privileged Gateway Intents** (aktifkan **Presence Intent**, **Server Members Intent**, dan **Message Content Intent**).
5. Masuk ke tab **OAuth2** > **URL Generator**:
   - **Scopes**: Centang **`bot`** dan **`applications.commands`** (Wajib agar menu `/` muncul di server).
   - **Bot Permissions**: Centang `Connect`, `Speak`, `Send Messages`, `Embed Links`, `Read Message History`, `Use Voice Activity`.
   - Salin tautan yang dihasilkan di bagian bawah dan buka di browser untuk mengundang bot ke server Discord Anda.

### 2. Konfigurasi Token & Environment
1. Buka file `.env` di dalam folder `RyzuBotz`.
2. Ubah `MASUKKAN_TOKEN_DISCORD_BOT_DISINI` dengan Token Bot yang Anda salin dari langkah sebelumnya:
   ```env
   DISCORD_TOKEN=your_real_discord_bot_token_here
   ```

### 3. Jalankan Bot
Jalankan perintah berikut di terminal Anda:
```bash
npm start
```
Bot akan otomatis menginisialisasi pustaka pemutar musik dan mendaftarkan Slash Commands (`/`) secara global.

---

## 📋 Perintah Bot (Mendukung Prefix `.` dan Slash `/`)

### 🎵 Musik & Voice Perintah
| Perintah (Prefix) | Slash Command | Deskripsi |
| :--- | :--- | :--- |
| `.play <judul/link>` | `/play <query>` | Mencari dan memutar musik dari YouTube di Voice Channel. |
| `.skip` (atau `.s`) | `/skip` | Melewati lagu yang sedang diputar. |
| `.stop` | `/stop` | Menghentikan pemutaran dan mengosongkan antrean musik. |
| `.pause` | `/pause` | Menjeda lagu yang sedang berjalan. |
| `.resume` | `/resume` | Melanjutkan kembali lagu yang dijeda. |
| `.queue` (atau `.q`) | `/queue` | Menampilkan daftar antrean lagu saat ini. |
| `.leave` (atau `.dc`) | `/leave` | Mengeluarkan bot dari voice channel dan menghapus antrean. |
| `.help` (atau `.menu`) | `/help` | Menampilkan seluruh menu bantuan perintah bot. |

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
