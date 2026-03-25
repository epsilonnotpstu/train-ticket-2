const { chromium } = require("playwright");
const { config } = require("./config");

async function connectBrowser() {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${config.cdpPort}`);
  const context = browser.contexts()[0];

  if (!context) {
    throw new Error(
      `No Chrome context found on port ${config.cdpPort}. Start the browser first with: npm run start-browser`
    );
  }

  return { browser, context };
}

module.exports = { connectBrowser };
