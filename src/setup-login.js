const { config } = require("./config");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

async function main() {
  fs.mkdirSync(config.loginProfileDir, { recursive: true });

  const firstDestination = config.toCities[0];
  const url = `https://eticket.railway.gov.bd/booking/train/search?fromcity=${encodeURIComponent(
    config.fromCity
  )}&tocity=${encodeURIComponent(firstDestination)}&doj=${encodeURIComponent(config.journeyDate)}&class=${encodeURIComponent(
    config.seatClass
  )}`;

  const chrome = spawn(
    config.browserExecutablePath,
    [
      `--user-data-dir=${config.loginProfileDir}`,
      "--profile-directory=Default",
      `--remote-debugging-port=${config.cdpPort}`,
      "--no-first-run",
      "--no-default-browser-check",
      url,
    ],
    {
      detached: true,
      stdio: "ignore",
    }
  );

  chrome.unref();

  const pidFile = path.join(path.dirname(config.stateFilePath), "browser.pid");
  fs.writeFileSync(pidFile, `${chrome.pid}\n`, "utf8");

  console.log("");
  console.log("Normal Chrome opened with a dedicated local profile.");
  console.log("If the railway site asks for login, complete the login there.");
  console.log("Keep that Chrome window open after login.");
  console.log("Then run: npm run watch");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
