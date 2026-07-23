const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");
const { config } = require("./config");
const { saveSession } = require("./session");
const { sleep, log } = require("./helpers");

const CDP_PORT = 9223;
const TURNSTILE_WAIT_SECONDS = 60;
const LOGIN_RESULT_WAIT_SECONDS = 30;

// Turnstile detects Playwright-launched browsers (automation flags), so we spawn a
// plain Chrome with a debugging port and attach over CDP instead.
function spawnChrome(profileDir) {
  fs.mkdirSync(profileDir, { recursive: true });
  const args = [
    `--user-data-dir=${profileDir}`,
    "--profile-directory=Default",
    `--remote-debugging-port=${CDP_PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
  ];
  if (process.env.RELOGIN_HEADLESS === "1") {
    args.push("--headless=new");
  }
  args.push("about:blank");
  return spawn(config.browserExecutablePath, args, { stdio: "ignore" });
}

async function waitForCdp() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) {
        return;
      }
    } catch {
      // Chrome not ready yet
    }
    await sleep(1000);
  }
  throw new Error("Chrome did not open its debugging port within 30s");
}

async function relogin() {
  if (!config.railwayUsername || !config.railwayPassword) {
    throw new Error("RAILWAY_USERNAME / RAILWAY_PASSWORD missing from .env");
  }

  const profileDir = path.resolve(__dirname, "..", "state", "login-profile");
  log("Launching browser for re-login...");
  const chrome = spawnChrome(profileDir);
  let browser = null;

  try {
    await waitForCdp();
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
    const context = browser.contexts()[0];
    const page = context.pages()[0] || (await context.newPage());

    await page.goto("https://eticket.railway.gov.bd/", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    log("Storage cleared, loading login page for fresh device handshake...");
    await page.goto("https://eticket.railway.gov.bd/login", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector("#mobile_number", { timeout: 60000 });

    await page.locator("#mobile_number").fill(config.railwayUsername);
    await page.locator("#password").fill(config.railwayPassword);

    log("Waiting for Turnstile to solve...");
    let turnstileToken = "";
    for (let i = 0; i < TURNSTILE_WAIT_SECONDS; i += 1) {
      turnstileToken = await page.evaluate(() => {
        const el = document.querySelector('input[name="cf-turnstile-response"]');
        return el ? el.value : "";
      });
      if (turnstileToken) {
        break;
      }
      await page.waitForTimeout(1000);
    }

    if (!turnstileToken) {
      throw new Error(`Turnstile did not solve within ${TURNSTILE_WAIT_SECONDS}s`);
    }

    log("Turnstile solved, submitting login...");
    await page.locator('button[type="submit"]').first().click();

    let session = null;
    for (let i = 0; i < LOGIN_RESULT_WAIT_SECONDS; i += 1) {
      session = await page.evaluate(() => {
        if (!localStorage.getItem("token")) {
          return null;
        }
        return {
          token: localStorage.getItem("token"),
          ssdk: localStorage.getItem("ssdk"),
          user: localStorage.getItem("user"),
          uudid: localStorage.getItem("uudid"),
          handshake_data: localStorage.getItem("handshake_data"),
          handshake_hash: localStorage.getItem("handshake_hash"),
        };
      });
      if (session) {
        break;
      }
      await page.waitForTimeout(1000);
    }

    if (!session) {
      const bodyText = await page
        .locator("body")
        .innerText()
        .catch(() => "");
      const hint = bodyText.replace(/\s+/g, " ").slice(0, 200);
      throw new Error(`Login did not produce a token within ${LOGIN_RESULT_WAIT_SECONDS}s. Page said: ${hint}`);
    }

    saveSession(session);
    log("Re-login successful, fresh session saved to .env");
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    chrome.kill();
  }
}

if (require.main === module) {
  relogin()
    .then(() => process.exit(0))
    .catch((error) => {
      log(`Re-login failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { relogin };
