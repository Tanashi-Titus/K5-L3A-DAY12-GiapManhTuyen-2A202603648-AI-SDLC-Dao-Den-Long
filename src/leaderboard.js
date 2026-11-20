export const LEADERBOARD_LIMIT = 10;
export const NAME_PATTERN = /^[A-Za-z0-9_]{3,12}$/;

export function validateEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new TypeError("entry must be an object");
  if (typeof entry.name !== "string" || !NAME_PATTERN.test(entry.name)) throw new TypeError("name must be 3–12 letters, digits, or underscores");
  if (!Number.isSafeInteger(entry.score) || entry.score < 0) throw new TypeError("score must be a non-negative safe integer");
  if (!Number.isInteger(entry.nights_won) || entry.nights_won < 0 || entry.nights_won > 3) throw new TypeError("nights_won must be an integer from 0 to 3");
  if (typeof entry.achieved_at !== "string" || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(entry.achieved_at) || Number.isNaN(Date.parse(entry.achieved_at))) throw new TypeError("achieved_at must be an ISO 8601 timestamp with a timezone");
  if (!Number.isSafeInteger(entry.seed)) throw new TypeError("seed must be a safe integer");
  return { name: entry.name, score: entry.score, nights_won: entry.nights_won, achieved_at: entry.achieved_at, seed: entry.seed };
}

export function orderEntries(entries) {
  return entries.map(validateEntry).sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at)).slice(0, LEADERBOARD_LIMIT);
}

export function insertEntry(entries, entry) {
  return orderEntries([...entries, validateEntry(entry)]);
}
