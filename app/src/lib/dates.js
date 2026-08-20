// Format back using LOCAL getters, not toISOString() (which is always
// UTC) — round-tripping a locally-parsed date through toISOString() shifts
// the calendar day by one for any user not at UTC+0.
function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toLocalISODate(new Date());
}

export function addDaysISO(dateISO, days) {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}

export function startOfWeekISO(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return toLocalISODate(d);
}

export function fmtDateLong(dateISO) {
  if (!dateISO) return "—";
  return new Date(dateISO + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
export function fmtDateShort(dateISO) {
  if (!dateISO) return "—";
  return new Date(dateISO + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function fmtDateWeekday(dateISO) {
  if (!dateISO) return "—";
  return new Date(dateISO + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
}
export function isToday(dateISO) {
  return dateISO === todayISO();
}
export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
