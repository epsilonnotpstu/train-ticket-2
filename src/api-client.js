const { config } = require("./config");
const { loadSession } = require("./session");

const SEARCH_URL = "https://railspaapi.shohoz.com/v1.0/web/bookings/search-trips-v2";

class SessionExpiredError extends Error {
  constructor(message) {
    super(message);
    this.name = "SessionExpiredError";
  }
}

async function searchTrips(toCity) {
  const session = loadSession();
  const params = new URLSearchParams({
    from_city: config.fromCity,
    to_city: toCity,
    date_of_journey: config.journeyDate,
    seat_class: config.seatClass,
  });

  const response = await fetch(`${SEARCH_URL}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${session.token}`,
      "x-device-key": session.ssdk,
      "x-device-id": session.uudid,
    },
  });

  const text = await response.text();

  if (response.status === 401 || response.status === 403) {
    throw new SessionExpiredError(`Railway API rejected the session (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`Railway API error HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Railway API returned non-JSON response: ${text.slice(0, 200)}`);
  }

  return (payload.data && payload.data.trains) || [];
}

module.exports = { searchTrips, SessionExpiredError };
