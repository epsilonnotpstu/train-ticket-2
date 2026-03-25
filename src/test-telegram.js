const { config } = require("./config");
const { sendTelegramMessage } = require("./telegram");

async function main() {
  await sendTelegramMessage(
    config.telegramBotToken,
    config.telegramChatId,
    `Telegram test OK for ${config.trainName} ${config.seatClass} on ${config.journeyDate}.`
  );

  console.log("Telegram test message sent successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
