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
pkg install nodejs ffmpeg qpdf poppler zip unzip -y
unzip TEKSI-MD.zip && cd TEKSI-MD
npm install
npm start
```

`qpdf` powers `.pdflock` / `.pdfunlock`, `poppler` provides `pdftotext` for
`.filetotxt`, `zip` / `unzip` power `.ziplock` / `.zipunlock`, and `ffmpeg`
powers the audio edit commands.

`python` and `python-pillow` provide the image backend on Termux/arm32, where
the native and WebAssembly builds of `sharp` often fail. `start.sh` installs
these automatically. You can force this backend anywhere with:

```bash
export TEKSI_IMAGE_BACKEND=pillow
```

On PCs and Render, the real `sharp` package is still used automatically.

The terminal shows a **PAIRING CODE** like `ABCD-EFGH`.  
On your phone: **WhatsApp → Settings → Linked Devices → Link with phone number**, then enter it.

> Keep the bot running. Restarting with `npm start` reconnects automatically.

## 📦 Install (VPS / Computer)

Node.js 18+ required:

```bash
npm install
npm start
```

Optional helpers for the advanced commands:

```bash
# PDF lock/unlock + PDF text extraction + password-protected ZIP
python -m pip install pikepdf pypdf pyzipper

# Audio edit tools (.tomp3, .to8daudio, .tobass, .toslowed)
# Install ffmpeg from https://ffmpeg.org or your package manager
```

All other commands (PDF merge, PDF↔image, TXT↔file, ZIP read, web tools,
AI, LAB images, fun commands) work with just `npm install`.

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
downloadMaxMB: 4096, // 4 GB — large files stream to disk
cobaltApiKey: '',  // optional — makes Instagram/Facebook downloads reliable
botDp: true,                          // auto-set on first connection
botDpFile: './assets/TEKSI-MD_art.png',
```

`cobaltApiKey` can also be set with the `COBALT_API_KEY` environment variable.  
YouTube downloads work without any key. For **video with sound**, install `ffmpeg` (and optionally `yt-dlp`) on the host; without ffmpeg the bot sends a video-only stream and says so in the caption.

The bundled artwork in `assets/TEKSI-MD_art.png` is cropped to a square and applied as the bot's display picture on the first successful connection. Change `botDpFile` to use your own image, or run `.setdp` after replacing the file.

Downloads are capped at **4 GB** (`downloadMaxMB: 4096`). Files over 64 MB stream to a temporary file instead of being held in RAM; small files stay in memory. Note that WhatsApp itself still rejects very large uploads on some clients, so the practical send limit depends on the linked device.

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

### Student LAB
| Command | What it does |
|---|---|
| `.pdfunlock [password]` *(reply to PDF)* | Remove PDF protection |
| `.pdflock [password]` *(reply to PDF)* | Password-protect a PDF |
| `.pdfmerge` *(reply to PDFs, then `.pdfmergedone`)* | Merge multiple PDFs |
| `.pdf2img [jpg]` *(reply to PDF)* | Convert PDF pages to images |
| `.img2pdf` *(reply to images, then `.img2pdfdone`)* | Combine images into a PDF |
| `.ziplock <password>` *(reply to a file)* | Create a password-protected ZIP |
| `.zipunlock <password>` *(reply to ZIP)* | Extract a protected ZIP |
| `.txttofile <name> <text>` | Turn text into a file |
| `.filetotxt` *(reply to TXT/PDF/ZIP)* | Extract text from a file |
| `.compress` *(reply to a file)* | Compress image/PDF/video/audio |
| `.dictionary <word>`, `.wiki <topic>` | Definitions / Wikipedia summaries |

### Tools
| Command | What it does |
|---|---|
| `.ip` | Public IP + location details |
| `.whois <domain>` | RDAP domain registration lookup |
| `.extractweb <url>` | Read a web page as plain text |
| `.base64 <text>`, `.decode64 <text>` | Encode / decode Base64 |
| `.uuid` | Generate a UUID v4 |
| `.shortlink <url>` | Shorten a link (TinyURL) |
| `.hash [algo] <text>` | MD5 / SHA hashes |

### LAB (images)
| Command | What it does |
|---|---|
| `.wallpaper` | Random wallpaper |
| `.cat`, `.dog` | Random cat / dog photo |
| `.girldp`, `.animedp`, `.randomdp`, `.coupledp` | Random display pictures |

### AI
| Command | What it does |
|---|---|
| `.ai`, `.ask`, `.gpt`, `.gpt1`–`.gpt4`, `.gemini` | AI chat (free tier aliases) |
| `.imagine <prompt>` | AI-generated image |
| `.currency <amount> <FROM> <TO>` | Exchange rates |
| `.crypto [coin]` | Live crypto prices |

### Fun
| Command | What it does |
|---|---|
| `.meme`, `.fact`, `.advice`, `.roast` | Random content |
| `.truth`, `.dare`, `.pickup`, `.compliment` | Party / fun text |
| `.ship <name1> <name2>`, `.lovemeter [a] [b]` | Match meters |
| `.aura`, `.king`, `.emojimix` | Random status |
| `.roll [sides]`, `.flip` | Dice / coin |
| `.quote`, `.joke` | Quotes and jokes |

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
| `.listadmin` | List group admins |
| `.setwelcome on/off`, `.setgoodbye on/off` | Set join / leave messages |
| `.setdesc <text>` | Change the group description |
| `.poll <question> <a> \| <b>` | Create a poll |
| `.announce <text>` | Mention everyone with an announcement |
| `.warn <reason>` *(reply to a member)* | Issue an official warning |

### Audio edit tools
| Command | What it does |
|---|---|
| `.tomp3` *(reply to audio)* | Convert audio to MP3 |
| `.to8daudio` *(reply to audio)* | 8D stereo panning effect |
| `.tobass` *(reply to audio)* | Bass boost |
| `.toslowed` *(reply to audio)* | Slowed-down version |

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
| `.setdp` / `.dp` | Re-apply the bundled bot display picture |
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
│   ├── ai.js           # Pollinations AI aliases
│   ├── extra.js        # Web tools + fun commands
│   ├── docs.js         # PDF / ZIP / file tools
│   ├── images.js       # Wallpaper / DP image APIs
│   ├── audio.js        # ffmpeg audio edits
│   ├── profile.js      # Bot display picture
│   ├── settings.js     # Persistent group settings
│   └── downloader.js   # YouTube / social / direct download helpers
├── plugins/
│   └── commands.js     # Commands + interactive controller
├── assets/
│   └── TEKSI-MD_art.png # Bot display picture artwork
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
