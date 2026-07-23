const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function numberFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}=${raw}`);
  }
  return value;
}

const rootDir = path.resolve(__dirname, "..");
const stateDir = path.join(rootDir, "state");

fs.mkdirSync(stateDir, { recursive: true });

const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  telegramChatId: required("TELEGRAM_CHAT_ID"),
  journeyDate: required("JOURNEY_DATE"),
  fromCity: required("FROM_CITY"),
  toCities: required("TO_CITIES")
    .split(",")
    .map((city) => city.trim())
    .filter(Boolean),
  trainName: process.env.TRAIN_NAME || "TURNA (742)",
  seatClass: process.env.SEAT_CLASS || "S_CHAIR",
  pollIntervalSeconds: numberFromEnv("POLL_INTERVAL_SECONDS", 25),
  requestSpacingSeconds: numberFromEnv("REQUEST_SPACING_SECONDS", 8),
  browserExecutablePath: process.env.BROWSER_EXECUTABLE_PATH || "/usr/bin/google-chrome-stable",
  railwayUsername: required("RAILWAY_USERNAME"),
  railwayPassword: required("RAILWAY_PASSWORD"),
  stateFilePath: path.join(stateDir, "availability-state.json"),
};

module.exports = { config, rootDir, stateDir };
