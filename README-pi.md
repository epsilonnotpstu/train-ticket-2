# Raspberry Pi Setup (Pi 3 Model B, 64-bit Raspberry Pi OS)

Ei watcher ta browser chara sudhu API diye ticket check kore, tai Pi 3 (1GB RAM) e comfortably chole.
Browser (chromium + xvfb) sudhu **re-login er somoy** ~30 second er jonno chole — din e 2-3 bar.

## 1. Install dependencies (Pi te, ekbar)

```bash
# Node.js 20 (arm64)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Chromium + virtual display (relogin er jonno)
sudo apt-get install -y chromium-browser xvfb
```

> Jodi `chromium-browser` package na thake, `sudo apt-get install -y chromium` try koren,
> tahole `.env` e path hobe `/usr/bin/chromium`.

## 2. Project copy koren (laptop theke)

```bash
rsync -a --exclude node_modules --exclude state \
  "/home/afridi/Documents/train ticket 2/" pi@<PI_IP>:/home/pi/train-ticket-2/
```

`.env` file tao copy hoye jabe (rsync e include ache). Tarpor Pi te:

```bash
cd /home/pi/train-ticket-2
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --omit=dev
```

## 3. `.env` adjust koren (Pi te)

Ei line ta bodlan:

```
BROWSER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

Baki sob (Telegram token, RAILWAY_USERNAME/PASSWORD, train config) laptop er motoi thakbe.

## 4. First test (Pi te)

```bash
# Relogin test — xvfb diye headed chromium chole, Turnstile solve hobe
xvfb-run -a node src/relogin.js

# Ek cycle check
npm run check-once
```

`Re-login successful` ar `Result for ...` dekhle sob thik ache.

> **Note:** Watcher nije-i DISPLAY na pele `xvfb-run` diye relogin chalay —
> apnake manually kichu korte hobe na. Ei step ta sudhu verify korar jonno.

## 5. Service install (always-on)

```bash
sudo cp deploy/train-watcher.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now train-watcher
```

Log dekhte:

```bash
journalctl -u train-watcher -f
```

Watcher start hole Telegram e "Ticket watcher started on <hostname>" message ashbe.

## Kivabe kaj kore

- Proti 25 second por por API diye seat check hoy (`POLL_INTERVAL_SECONDS` e change kora jay).
- Seat > 0 hole ba seat count change hole (jotokkhon > 0) Telegram notification jay.
- Token ~12 ghonta por expire hoy. Expiry er 30 min age watcher nije-i chromium (xvfb) khule
  auto re-login kore. Apnar kichu korte hoy na.
- **Auto re-login fail hole** Telegram e alert ashbe. Tokhon Pi te SSH kore:
  ```bash
  cd /home/pi/train-ticket-2 && xvfb-run -a node src/relogin.js
  ```
  chalale watcher porer cycle ei abar chole.
- Pi reboot holeo systemd service auto start hobe (`Restart=always`).

## Config change korte chaile

`.env` e `JOURNEY_DATE`, `TRAIN_NAME`, `SEAT_CLASS`, `TO_CITIES` bodlan, tarpor:

```bash
sudo systemctl restart train-watcher
```

`TO_CITIES` e plain text likhben (`Cox's Bazar`), URL-encoded na.
