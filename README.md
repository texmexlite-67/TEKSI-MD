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
- 👥 **Group tools** — tagall, hidetag, kick, add, promote, open/close, anti-link, welcome
- 🌤 **Weather, translate, calc, quotes, jokes**
- 🎵 **TikTok download**, song search
- 👑 **Owner tools** — self/public mode, restart, eval
- 🔄 Auto-reconnect, session saved in `session/`

---

## 📦 Install (Termux / Phone)

1. Install Node.js:
   ```bash
   pkg install nodejs -y
   ```
2. Unzip / copy this folder, then:
   ```bash
   cd TEKSI-MD
   npm install
   ```
3. Start the bot:
   ```bash
   npm start
   ```
4. The terminal will show a **PAIRING CODE** like `ABCD-EFGH`.
   - On your phone: **WhatsApp → Settings → Linked Devices → Link with phone number**
   - Enter the code shown in the terminal.
5. Done! ✅ Send `.menu` in WhatsApp to test.

> Keep the bot running. If you close Termux, run `npm start` again — it will reconnect automatically (no new pairing code needed).

---

## 📦 Install (VPS / Computer)

```bash
# Node.js 18+ required
node -v
npm install
npm start
```

To run 24/7 on a VPS, use PM2:
```bash
npm install -g pm2
pm2 start index.js --name TEKSI-MD
pm2 save
```

---

## ⚙️ Configuration

Edit `config.js`:

```js
botName: 'TEKSI-MD',          // bot name
botTitle: 'TEKSI',            // title
ownerNumber: '254715442684',  // OWNER number (no +, no spaces)
pairingNumber: '254715442684',// number the bot logs in as
prefix: '.',                  // command prefix
```

> **Important:** `pairingNumber` is the number you pair in the terminal.  
> By default it is the same as the owner number. If you want the bot on a **different** number, change `pairingNumber` to that number.

---

## 🎮 Commands

| Command | What it does |
|---|---|
| `.menu` | Show menu |
| `.ping` | Check if bot is alive |
| `.owner` | Show owner contact |
| `.info` | Bot info |
| `.sticker` | Reply to image/video → sticker |
| `.toimg` | Reply to sticker → image |
| `.attp <text>` | Text → sticker |
| `.ai <question>` | Ask AI |
| `.imagine <prompt>` | Generate AI image |
| `.weather <city>` | Weather |
| `.translate <text>` | Translate EN→SW |
| `.calc 12*8` | Calculator |
| `.tiktok <url>` | Download TikTok video |
| `.tagall` | Mention everyone (admin) |
| `.kick` / `.add` / `.promote` | Group management (admin) |
| `.antilink on` | Block links (owner) |
| `.self` / `.public` | Self mode (owner) |

---

## 📁 Project Structure

```
TEKSI-MD/
├── index.js          # Main bot (connection + pairing)
├── config.js         # Bot name, title, owner number
├── package.json
├── lib/
│   ├── utils.js
│   ├── sticker.js
│   └── ai.js
├── plugins/
│   └── commands.js   # All commands + menu
└── session/          # WhatsApp login (auto-created)
```

---

## ⚠️ Keep Your Session Safe

The `session/` folder is your WhatsApp login. **Never share it.**  
To log out completely, delete the `session/` folder and restart.

---

Made with ❤️ — **TEKSI-MD • TEKSI**
