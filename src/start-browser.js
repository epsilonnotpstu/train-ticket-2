const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { config } = require("./config");

function main() {
  fs.mkdirSync(config.loginProfileDir, { recursive: true });

  const chrome = spawn(
    config.browserExecutablePath,
    [
      `--user-data-dir=${config.loginProfileDir}`,
      "--profile-directory=Default",
      `--remote-debugging-port=${config.cdpPort}`,
      "--no-first-run",
      "--no-default-browser-check",
      "https://eticket.railway.gov.bd/",
    ],
    {
      detached: true,
      stdio: "ignore",
    }
  );

  chrome.unref();

  const pidFile = path.join(path.dirname(config.stateFilePath), "browser.pid");
  fs.writeFileSync(pidFile, `${chrome.pid}\n`, "utf8");

  console.log(`Chrome started on CDP port ${config.cdpPort}.`);
  console.log("Use this browser window for railway login.");
  console.log("Keep it open while the watcher is running.");
}

main();
