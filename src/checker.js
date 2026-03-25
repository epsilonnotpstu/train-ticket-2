const fs = require("fs");
const { config } = require("./config");
const { sendTelegramMessage } = require("./telegram");
const { sleep, log, escapeRegExp } = require("./helpers");
const RESULT_WAIT_TIMEOUT_MS = 45000;
const RESULT_WAIT_STEP_MS = 2000;

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

function extractTrainSection(text, trainName) {
  const normalized = text.replace(/\r/g, "");
  const escapedTrain = escapeRegExp(trainName);
  const nextTrainPattern = /\n[A-Z][A-Z0-9_ ]+\(\d+\)/g;
  const startMatch = normalized.match(new RegExp(escapedTrain, "i"));
  if (!startMatch || startMatch.index === undefined) {
    return null;
  }

  const fromStart = normalized.slice(startMatch.index);
  const nextMatch = nextTrainPattern.exec(fromStart.slice(trainName.length));
  if (!nextMatch || nextMatch.index === undefined) {
    return fromStart;
  }

  return fromStart.slice(0, trainName.length + nextMatch.index);
}

function extractClassSnippet(sectionText, seatClass) {
  const classNames = ["S_CHAIR", "SNIGDHA", "F_BERTH", "AC_B", "AC_S", "F_SEAT", "F_CHAIR"];
  const startIndex = sectionText.indexOf(seatClass);
  if (startIndex === -1) {
    return null;
  }

  let endIndex = sectionText.length;
  for (const candidate of classNames) {
    if (candidate === seatClass) {
      continue;
    }
    const nextIndex = sectionText.indexOf(candidate, startIndex + seatClass.length);
    if (nextIndex !== -1) {
      endIndex = Math.min(endIndex, nextIndex);
    }
  }

  return sectionText.slice(startIndex, endIndex);
}

function parseAvailabilityCount(snippet) {
  const lines = snippet
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const availableLabelIndex = lines.findIndex((line) => /Available Tickets/i.test(line));
  if (availableLabelIndex !== -1) {
    for (let index = availableLabelIndex + 1; index < lines.length; index += 1) {
      if (/^\d+$/.test(lines[index])) {
        return Number(lines[index]);
      }
    }
  }

  const numbers = lines.filter((line) => /^\d+$/.test(line)).map(Number);
  if (numbers.length > 0) {
    return numbers[numbers.length - 1];
  }

  return null;
}

async function parseAvailabilityFromPage(page, destination) {
  const bodyText = await page.locator("body").innerText();
  const loginRedirected = page.url().includes("/login") || /LOGIN\s+OR\s+REGISTER/i.test(bodyText);
  if (loginRedirected) {
    throw new Error(
      "Railway session not found. Run `npm run setup-login`, log in once in the opened browser, then start the watcher again."
    );
  }

  if (/No Trains Available/i.test(bodyText)) {
    return {
      destination,
      availableCount: 0,
      sectionText: null,
      url: page.url(),
    };
  }

  const sectionText = extractTrainSection(bodyText, config.trainName);
  if (!sectionText) {
    throw new Error(`Could not find ${config.trainName} on the search results page for ${destination}.`);
  }

  const classSnippet = extractClassSnippet(sectionText, config.seatClass);
  if (!classSnippet) {
    throw new Error(`Could not find seat class ${config.seatClass} inside ${config.trainName} for ${destination}.`);
  }

  const availableCount = parseAvailabilityCount(classSnippet);
  if (availableCount === null) {
    throw new Error(`Could not parse availability count for ${config.trainName} ${config.seatClass} to ${destination}.`);
  }

  return {
    destination,
    availableCount,
    sectionText,
    url: page.url(),
  };
}

async function waitForSearchResults(page, destination) {
  const startedAt = Date.now();
  let lastBodyText = "";

  while (Date.now() - startedAt < RESULT_WAIT_TIMEOUT_MS) {
    lastBodyText = await page.locator("body").innerText();

    if (page.url().includes("/login") || /LOGIN\s+OR\s+REGISTER/i.test(lastBodyText)) {
      return;
    }

    if (/No Trains Available/i.test(lastBodyText)) {
      return;
    }

    if (extractTrainSection(lastBodyText, config.trainName)) {
      return;
    }

    await sleep(RESULT_WAIT_STEP_MS);
  }

  const preview = lastBodyText.replace(/\s+/g, " ").trim().slice(0, 300);
  throw new Error(
    `Timed out waiting for results for ${destination}. Last page text preview: ${preview || "empty page"}`
  );
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
  return [
    "Train ticket available!",
    `Train: ${config.trainName}`,
    `Class: ${config.seatClass}`,
    `Route: ${config.fromCity} -> ${result.destination}`,
    `Date: ${config.journeyDate}`,
    `Available: ${result.availableCount}`,
    `Link: ${buildSearchUrl(result.destination)}`,
  ].join("\n");
}

async function checkDestination(page, destination, state) {
  const url = buildSearchUrl(destination);
  log(`Checking ${config.trainName} ${config.seatClass} for ${config.fromCity} -> ${destination}`);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForSearchResults(page, destination);

  const result = await parseAvailabilityFromPage(page, destination);
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
    url,
  };

  saveState(state);
  return result;
}

async function runChecksOnce(context) {
  const state = loadState();
  const page = context.pages()[0] || (await context.newPage());
  const results = [];

  for (const [index, destination] of config.toCities.entries()) {
    const result = await checkDestination(page, destination, state);
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
