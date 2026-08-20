// Unit conversions — everything is stored internally in kg / km / cm, so
// every route converts at the boundary (request in, response out) rather
// than scattering conversions through query logic.

export const KG_PER_LB = 0.45359237;
export const KM_PER_MI = 1.609344;
export const CM_PER_IN = 2.54;

export function lbToKg(lb) {
  return lb * KG_PER_LB;
}
export function kgToLb(kg) {
  return kg / KG_PER_LB;
}
export function miToKm(mi) {
  return mi * KM_PER_MI;
}
export function kmToMi(km) {
  return km / KM_PER_MI;
}
export function inToCm(inches) {
  return inches * CM_PER_IN;
}
export function cmToIn(cm) {
  return cm / CM_PER_IN;
}

export function weightToKg(value, unit) {
  if (value == null) return null;
  return unit === "lb" ? lbToKg(Number(value)) : Number(value);
}
export function weightFromKg(kg, unit) {
  if (kg == null) return null;
  return unit === "lb" ? kgToLb(Number(kg)) : Number(kg);
}
export function distanceToKm(value, unit) {
  if (value == null) return null;
  return unit === "mi" ? miToKm(Number(value)) : Number(value);
}
export function distanceFromKm(km, unit) {
  if (km == null) return null;
  return unit === "mi" ? kmToMi(Number(km)) : Number(km);
}

// Training volume = sum(reps * weight) across sets. Only "completed" sets
// count, per the business rule that volume reflects work actually done.
export function trainingVolumeKg(sets) {
  return sets.filter((s) => s.completed !== false).reduce((sum, s) => sum + Number(s.reps) * Number(s.weight_kg), 0);
}

// Epley estimated 1RM: weight * (1 + reps/30). Undefined for reps <= 0.
export function epley1RM(weightKg, reps) {
  if (weightKg == null || !reps || reps <= 0) return null;
  return weightKg * (1 + reps / 30);
}

// "Best valid set" reference for an exercise entry: the completed set whose
// Epley-estimated 1RM is highest, not simply the heaviest weight — a lower
// weight for more reps can imply a higher 1RM.
export function bestEstimated1RM(sets) {
  let best = null;
  for (const s of sets) {
    if (s.completed === false) continue;
    const est = epley1RM(Number(s.weight_kg), Number(s.reps));
    if (est != null && (best == null || est > best)) best = est;
  }
  return best;
}

export function bmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function bmiCategory(value) {
  if (value == null) return null;
  if (value < 18.5) return "Underweight";
  if (value < 25) return "Normal";
  if (value < 30) return "Overweight";
  return "Obese";
}

export function paceSecondsPerUnit(durationMinutes, distanceInUnit) {
  if (!durationMinutes || !distanceInUnit) return null;
  return (durationMinutes * 60) / distanceInUnit;
}

export function round(n, decimals = 1) {
  if (n == null) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
