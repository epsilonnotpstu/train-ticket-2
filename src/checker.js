const fs = require("fs");
const { config } = require("./config");
const { searchTrips } = require("./api-client");
const { sendTelegramMessage } = require("./telegram");
const { sleep, log } = require("./helpers");

function buildSearchUrl(destination) {
  const params = new URLSearchParams({
    fromcity: config.fromCity,
    tocity: destination,
    doj: config.journeyDate,
    class: config.seatClass,
  });

  return `https://eticket.railway.gov.bd/booking/train/search?${params.toString()}`;
}

function loadState() {
  if (!fs.existsSync(config.stateFilePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(config.stateFilePath, "utf8"));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(config.stateFilePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function extractAvailability(trains, destination) {
  const wantedTrain = config.trainName.trim().toLowerCase();
  const train = trains.find((entry) => (entry.trip_number || "").trim().toLowerCase() === wantedTrain);

  if (!train) {
    log(`${config.trainName} is not listed in the API results for ${destination}; treating as 0 available`);
    return { availableCount: 0, onlineCount: 0, offlineCount: 0, fare: null };
  }

  const seatType = (train.seat_types || []).find((entry) => entry.type === config.seatClass);
  if (!seatType) {
    log(`${config.seatClass} is not offered on ${config.trainName} for ${destination}; treating as 0 available`);
    return { availableCount: 0, onlineCount: 0, offlineCount: 0, fare: null };
  }

  const online = Number(seatType.seat_counts && seatType.seat_counts.online) || 0;
  const offline = Number(seatType.seat_counts && seatType.seat_counts.offline) || 0;

  return {
    availableCount: online + offline,
    onlineCount: online,
    offlineCount: offline,
    fare: seatType.fare || null,
  };
}

function shouldNotify(previous, current) {
  if (current.availableCount <= 0) {
    return false;
  }

  if (!previous) {
    return true;
  }

  return previous.availableCount !== current.availableCount;
}

function formatNotification(result) {
  const lines = [
    "Train ticket available!",
    `Train: ${config.trainName}`,
    `Class: ${config.seatClass}`,
    `Route: ${config.fromCity} -> ${result.destination}`,
    `Date: ${config.journeyDate}`,
    `Available: ${result.availableCount} (online ${result.onlineCount} + counter ${result.offlineCount})`,
  ];

  if (result.fare) {
    lines.push(`Fare: ${result.fare} BDT`);
  }

  lines.push(`Link: ${buildSearchUrl(result.destination)}`);
  return lines.join("\n");
}

async function checkDestination(destination, state) {
  log(`Checking ${config.trainName} ${config.seatClass} for ${config.fromCity} -> ${destination}`);

  const trains = await searchTrips(destination);
  const availability = extractAvailability(trains, destination);
  const result = { destination, ...availability };

  const stateKey = `${config.journeyDate}__${config.fromCity}__${destination}__${config.seatClass}`;
  const previous = state[stateKey];

  log(`Result for ${destination}: ${result.availableCount} seat(s) available`);

  if (shouldNotify(previous, result)) {
    await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, formatNotification(result));
    log(`Telegram notification sent for ${destination}`);
  }

  state[stateKey] = {
    availableCount: result.availableCount,
    checkedAt: new Date().toISOString(),
    url: buildSearchUrl(destination),
  };

  saveState(state);
  return result;
}

async function runChecksOnce() {
  const state = loadState();
  const results = [];

  for (const [index, destination] of config.toCities.entries()) {
    const result = await checkDestination(destination, state);
    results.push(result);

    if (index < config.toCities.length - 1) {
      await sleep(config.requestSpacingSeconds * 1000);
    }
  }

  return results;
}

module.exports = {
  buildSearchUrl,
  runChecksOnce,
};
