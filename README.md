# TEKSI-MD • TEKSI — WhatsApp Multi-Device Bot

**Bot Name:** `TEKSI-MD`  
**Title:** `TEKSI`  
**Owner:** `254715442684` (+254 715 442 684)

A WhatsApp Multi-Device bot built with [Baileys](https://github.com/WhiskeySockets/Baileys).  
Pair with a **pairing code** — no QR scan needed after the first time.

---

## ✨ Features

- 🤖 **AI chat** (`.ai`) + **AI images** (`.imagine`) — free, no API key
- 🎨 **Stickers** — `.sticker`, `.toimg`, `.attp`
- 👥 **Group controller** — buttons + 30+ group/admin commands
- 🛡 **Group guards** — antilink (delete/warn), antispam, anticall, antistatus
- ⬇️ **Downloaders** — YouTube audio/video, TikTok, Instagram, Facebook, Mediafire, direct image/video/files, movie info
- 🌤 Weather, translate, calc, quotes, jokes
- 🔄 Auto-reconnect, session saved in `session/`
- ⚙️ Settings survive restarts in `data/settings.json`

---

## 📦 Install (Termux / Phone)

```bash
pkg install nodejs -y
unzip TEKSI-MD.zip && cd TEKSI-MD
npm install
npm start
```

The terminal shows a **PAIRING CODE** like `ABCD-EFGH`.  
On your phone: **WhatsApp → Settings → Linked Devices → Link with phone number**, then enter it.

> Keep the bot running. Restarting with `npm start` reconnects automatically.

## 📦 Install (VPS / Computer)

Node.js 18+ required:

```bash
npm install
npm start
```

Run 24/7 with PM2:

```bash
npm install -g pm2
pm2 start index.js --name TEKSI-MD
pm2 save
```

---

## ⚙️ Configuration

Edit `config.js`:

```js
botName: 'TEKSI-MD',
botTitle: 'TEKSI',
ownerNumber: '254715442684',
pairingNumber: '254715442684',
prefix: '.',
downloadMaxMB: 50,
cobaltApiKey: '',  // optional — makes Instagram/Facebook downloads reliable
```

`cobaltApiKey` can also be set with the `COBALT_API_KEY` environment variable.  
YouTube downloads work without any key. For **video with sound**, install `ffmpeg` (and optionally `yt-dlp`) on the host; without ffmpeg the bot sends a video-only stream and says so in the caption.

---

## 🎮 Commands

### Main & tools
| Command | What it does |
|---|---|
| `.menu` / `.help` | Show the full menu |
| `.ping`, `.runtime`, `.speed` | Bot status |
| `.owner`, `.info` | Owner / bot info |
| `.sticker`, `.toimg`, `.attp` | Sticker tools |
| `.calc`, `.translate`, `.weather` | Utilities |
| `.ai`, `.imagine` | AI chat / AI image |
| `.quote`, `.joke` | Fun |

### Group controller (admin only)
| Command | What it does |
|---|---|
| `.control` / `.panel` | **Interactive button control panel** |
| `.gclink` / `.invite [number]` | Get / send the group invite link |
| `.tag` / `.tagall`, `.hidetag <text>` | Mention everyone (visible / hidden) |
| `.admins` | Mention all group admins |
| `.chatmute [hours]`, `.chatunmute` | Mute / unmute this chat for the bot |
| `.pin`, `.unpin` | Pin / unpin this chat |
| `.kick` *(reply)*, `.add <number>` | Remove / add members |
| `.promote`, `.demote` *(reply)* | Admin roles |
| `.open`, `.close`, `.lock`, `.unlock` | Group privacy settings |
| `.gprofile` | Group profile picture |
| `.gabout [text]`, `.groupname <name>` | View / set group about and name |
| `.gstatus <text>` | Post to your status mentioning group members |
| `.groupinfo`, `.revoke` | Group details / reset invite link |
| `.welcome on/off`, `.goodbye on/off` | Join / leave messages |

Compound aliases also work: `.g link`, `.g about`, `.chat mute 4`, `.admin tag`, `.anti link warn`.

### Group guards (admin only)
| Command | Options | What it does |
|---|---|---|
| `.antilink` | `on` / `warn` / `delete` / `off` | Remove or warn on links |
| `.antispam` | `on` / `off` | Delete burst spam (5 msgs / 10s) |
| `.anticall` | `on` / `off` | Reject incoming calls |
| `.antistatus` | `on` / `off` | Notify groups when a member posts a status |
| `.antistatusmention` | `on` / `off` | Mention that member in the alert |

All guard settings are per group (except anticall/antistatus, which are global) and are saved to `data/settings.json`.

### Downloads
| Command | What it does |
|---|---|
| `.play <song or YouTube url>` | Search + download YouTube audio (MP3/M4A) |
| `.ytmp3 <url>` | Same as `.play` with a URL |
| `.ytvideo <url>` | Download YouTube video |
| `.tiktok <url>` | TikTok video / images |
| `.instagram <url>`, `.facebook <url>` | Instagram / Facebook media |
| `.mediafire <url>` | Mediafire files |
| `.image <url>`, `.video <url>` | Direct image / video links |
| `.dl <url>` | Any direct file URL |
| `.movie <title>` | Movie info + poster + trailer link (Wikipedia) |

### Owner
| Command | What it does |
|---|---|
| `.self` / `.public` | Restrict / open the bot |
| `.restart`, `.eval <code>` | Restart / evaluate code |

---

## 📁 Project Structure

```
TEKSI-MD/
├── index.js            # Connection, guards, button handling
├── config.js           # Identity, pairing, download options
├── lib/
│   ├── utils.js
│   ├── sticker.js
│   ├── ai.js
│   ├── settings.js     # Persistent group settings
│   └── downloader.js   # YouTube / social / direct download helpers
├── plugins/
│   └── commands.js     # Commands + interactive controller
├── session/            # WhatsApp login (never share)
├── data/               # Group settings (auto-created)
└── README.md
```

---

## ⚠️ Keep your session safe

The `session/` folder is your WhatsApp login — **never share it**.  
Delete `session/` and restart to log out. Group settings live in `data/settings.json`.

---

Made with ❤️ — **TEKSI-MD • TEKSI**
