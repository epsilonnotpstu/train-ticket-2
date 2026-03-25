const { connectBrowser } = require("./browser");
const { config } = require("./config");
const { runChecksOnce } = require("./checker");
const { sleep, log } = require("./helpers");

async function main() {
  const once = process.argv.includes("--once");
  const { context } = await connectBrowser();

  if (once) {
    await runChecksOnce(context);
    return;
  }

  log(
    `Watcher started for ${config.trainName} ${config.seatClass} on ${config.journeyDate} (${config.fromCity} -> ${config.toCities.join(", ")})`
  );

  while (true) {
    try {
      await runChecksOnce(context);
    } catch (error) {
      log(`Check failed: ${error.message}`);
    }

    log(`Waiting ${config.pollIntervalSeconds} seconds before next cycle`);
    await sleep(config.pollIntervalSeconds * 1000);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
