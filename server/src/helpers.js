export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function isValidDate(d) {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + "T00:00:00").getTime());
}

// Pure calendar-day arithmetic anchored to UTC internally — not because
// dates are UTC, but because a date-only string ("2026-08-20") has no
// timezone of its own, and round-tripping it through a locally-parsed Date
// + toISOString() silently shifts the day whenever the server's OS
// timezone isn't UTC (verified: this server runs at UTC+5, which shifted
// every week/month boundary back by one day). Date.UTC + getUTC*/setUTCDate
// keeps the whole computation in one consistent zone so the server's own
// timezone never leaks into the math.
function toUTCDate(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function startOfWeekISO(dateISO) {
  const d = toUTCDate(dateISO);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1; // week starts Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(dateISO, days) {
  const d = toUTCDate(dateISO);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfMonthISO(dateISO) {
  return dateISO.slice(0, 7) + "-01";
}
