export const KG_PER_LB = 0.45359237;
export const KM_PER_MI = 1.609344;
export const CM_PER_IN = 2.54;

export const lbToKg = (lb) => lb * KG_PER_LB;
export const kgToLb = (kg) => kg / KG_PER_LB;
export const miToKm = (mi) => mi * KM_PER_MI;
export const kmToMi = (km) => km / KM_PER_MI;
export const inToCm = (inches) => inches * CM_PER_IN;
export const cmToIn = (cm) => cm / CM_PER_IN;

export function weightFromKg(kg, unit) {
  if (kg == null) return null;
  return unit === "lb" ? kgToLb(kg) : kg;
}
export function weightToKg(value, unit) {
  if (value == null || value === "") return null;
  return unit === "lb" ? lbToKg(Number(value)) : Number(value);
}
export function distanceFromKm(km, unit) {
  if (km == null) return null;
  return unit === "mi" ? kmToMi(km) : km;
}
export function distanceToKm(value, unit) {
  if (value == null || value === "") return null;
  return unit === "mi" ? miToKm(Number(value)) : Number(value);
}
export function heightFromCm(cm, unit) {
  if (cm == null) return null;
  return unit === "in" ? cmToIn(cm) : cm;
}

export function round(n, decimals = 1) {
  if (n == null || Number.isNaN(n)) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function fmtWeight(kg, unit, decimals = 1) {
  if (kg == null) return "—";
  return `${round(weightFromKg(kg, unit), decimals)} ${unit}`;
}
export function fmtDistance(km, unit, decimals = 2) {
  if (km == null) return "—";
  return `${round(distanceFromKm(km, unit), decimals)} ${unit}`;
}
export function fmtDuration(minutes) {
  if (minutes == null || minutes === 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}
export function fmtCalories(cal) {
  if (cal == null) return "—";
  return `${Math.round(cal)} kcal`;
}
export function fmtPace(secondsPerUnit, unit) {
  if (secondsPerUnit == null) return "—";
  const m = Math.floor(secondsPerUnit / 60);
  const s = Math.round(secondsPerUnit % 60);
  return `${m}:${String(s).padStart(2, "0")} /${unit}`;
}
export function heightToCm(value, unit) {
  if (value == null || value === "") return null;
  return unit === "in" ? inToCm(Number(value)) : Number(value);
}
