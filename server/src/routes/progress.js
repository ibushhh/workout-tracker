import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../auth.js";
import { todayISO, startOfWeekISO, addDaysISO, startOfMonthISO, isValidDate } from "../helpers.js";
import { bmi, bmiCategory, trainingVolumeKg, bestEstimated1RM, round } from "../calc.js";
import { buildDayDetail } from "./dailyLogs.js";

const router = Router();
router.use(requireAuth);

async function weekAggregate(userId, weekStart) {
  const weekEnd = addDaysISO(weekStart, 6);
  const { rows } = await pool.query("SELECT * FROM daily_logs WHERE user_id = $1 AND date BETWEEN $2 AND $3", [userId, weekStart, weekEnd]);
  const details = await Promise.all(rows.map((r) => buildDayDetail(userId, r.date)));
  const activeDays = details.filter((d) => d.dayType !== "rest");
  return {
    weekStart,
    weekEnd,
    workoutCount: activeDays.length,
    totalDurationMinutes: details.reduce((a, d) => a + d.totals.totalDurationMinutes, 0),
    totalCaloriesBurned: details.reduce((a, d) => a + d.totals.totalCaloriesBurned, 0),
    totalCardioMinutes: details.reduce((a, d) => a + d.cardioSessions.reduce((s, c) => s + c.durationMinutes, 0), 0),
    totalStrengthVolumeKg: details.reduce((a, d) => a + d.totals.totalStrengthVolumeKg, 0),
  };
}

async function currentStreak(userId, today) {
  const { rows } = await pool.query(
    "SELECT date, day_type FROM daily_logs WHERE user_id = $1 AND day_type != 'rest' ORDER BY date DESC LIMIT 400",
    [userId]
  );
  const activeDates = new Set(rows.map((r) => r.date));
  let streak = 0;
  let cursor = today;
  if (!activeDates.has(cursor)) cursor = addDaysISO(cursor, -1);
  while (activeDates.has(cursor)) {
    streak++;
    cursor = addDaysISO(cursor, -1);
  }
  return streak;
}

router.get("/dashboard", async (req, res) => {
  // "Today" is whatever the client's local calendar says — a UTC-based
  // default would show the wrong day near midnight in most timezones.
  const today = isValidDate(req.query.date) ? req.query.date : todayISO();
  const weekStart = startOfWeekISO(today);
  const monthStart = startOfMonthISO(today);

  const [todayDetail, week, streak, weightRows, restDaysRows] = await Promise.all([
    buildDayDetail(req.user.id, today),
    weekAggregate(req.user.id, weekStart),
    currentStreak(req.user.id, today),
    pool.query("SELECT * FROM body_measurements WHERE user_id = $1 ORDER BY date DESC LIMIT 1", [req.user.id]),
    pool.query("SELECT count(*)::int AS n FROM daily_logs WHERE user_id = $1 AND day_type = 'rest' AND date >= $2 AND date <= $3", [req.user.id, monthStart, today]),
  ]);

  const currentWeightKg = weightRows.rows[0] ? Number(weightRows.rows[0].body_weight_kg) : todayDetail.bodyWeightKg;
  const currentBmi = req.user.heightCm ? bmi(currentWeightKg, req.user.heightCm) : null;

  res.json({
    today: {
      date: today,
      dayType: todayDetail.dayType,
      totalDurationMinutes: todayDetail.totals.totalDurationMinutes,
      totalCaloriesBurned: todayDetail.totals.totalCaloriesBurned,
      cardioMinutes: todayDetail.cardioSessions.reduce((a, c) => a + c.durationMinutes, 0),
      strengthVolumeKg: todayDetail.totals.totalStrengthVolumeKg,
    },
    currentWeightKg,
    currentBmi: currentBmi != null ? round(currentBmi, 1) : null,
    bmiCategory: bmiCategory(currentBmi),
    week,
    currentStreakDays: streak,
    restDaysThisMonth: restDaysRows.rows[0].n,
  });
});

router.get("/body-weight", async (req, res) => {
  const { start, end } = req.query;
  const conditions = ["user_id = $1"];
  const params = [req.user.id];
  if (start && isValidDate(start)) {
    params.push(start);
    conditions.push(`date >= $${params.length}`);
  }
  if (end && isValidDate(end)) {
    params.push(end);
    conditions.push(`date <= $${params.length}`);
  }
  const { rows } = await pool.query(`SELECT date, body_weight_kg FROM body_measurements WHERE ${conditions.join(" AND ")} ORDER BY date ASC`, params);
  const series = rows.map((r) => ({
    date: r.date,
    bodyWeightKg: Number(r.body_weight_kg),
    bmi: req.user.heightCm ? round(bmi(Number(r.body_weight_kg), req.user.heightCm), 1) : null,
  }));
  const today = isValidDate(req.query.date) ? req.query.date : todayISO();
  const current = series[series.length - 1] || null;
  const first = series[0] || null;
  const find7d = series.filter((s) => s.date <= today && s.date >= addDaysISO(today, -7)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const find30d = series.filter((s) => s.date <= today && s.date >= addDaysISO(today, -30)).sort((a, b) => (a.date < b.date ? -1 : 1));

  res.json({
    series,
    currentWeightKg: current ? current.bodyWeightKg : null,
    currentBmi: current ? current.bmi : null,
    change7dKg: find7d.length > 1 ? round(find7d[find7d.length - 1].bodyWeightKg - find7d[0].bodyWeightKg, 2) : null,
    change30dKg: find30d.length > 1 ? round(find30d[find30d.length - 1].bodyWeightKg - find30d[0].bodyWeightKg, 2) : null,
    changeSinceFirstKg: current && first && current !== first ? round(current.bodyWeightKg - first.bodyWeightKg, 2) : null,
    targetWeightKg: req.user.targetWeightKg,
    progressTowardTargetKg: current && req.user.targetWeightKg != null ? round(current.bodyWeightKg - req.user.targetWeightKg, 2) : null,
  });
});

router.get("/cardio", async (req, res) => {
  const { start, end } = req.query;
  const conditions = ["dl.user_id = $1"];
  const params = [req.user.id];
  if (start && isValidDate(start)) {
    params.push(start);
    conditions.push(`dl.date >= $${params.length}`);
  }
  if (end && isValidDate(end)) {
    params.push(end);
    conditions.push(`dl.date <= $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT dl.date, cs.* FROM cardio_sessions cs JOIN daily_logs dl ON dl.id = cs.daily_log_id WHERE ${conditions.join(" AND ")} ORDER BY dl.date ASC`,
    params
  );
  const sessions = rows.map((r) => ({
    date: r.date,
    activityName: r.activity_name_snapshot,
    durationMinutes: Number(r.duration_minutes),
    caloriesBurned: r.calories_burned != null ? Number(r.calories_burned) : null,
    averageHeartRate: r.average_heart_rate,
    maximumHeartRate: r.maximum_heart_rate,
    paceSecondsPerUnit: r.pace_seconds_per_unit != null ? Number(r.pace_seconds_per_unit) : null,
    distanceKm: r.distance_km != null ? Number(r.distance_km) : null,
  }));
  const withHr = sessions.filter((s) => s.averageHeartRate != null);
  res.json({
    sessions,
    totalMinutes: round(sessions.reduce((a, s) => a + s.durationMinutes, 0), 1),
    totalDistanceKm: round(sessions.reduce((a, s) => a + (s.distanceKm || 0), 0), 2),
    averageHeartRate: withHr.length ? round(withHr.reduce((a, s) => a + s.averageHeartRate, 0) / withHr.length, 0) : null,
    maxHeartRate: sessions.length ? Math.max(...sessions.map((s) => s.maximumHeartRate || 0)) || null : null,
  });
});

router.get("/duration", async (req, res) => {
  await bucketedTotals(req, res, "duration");
});
router.get("/calories", async (req, res) => {
  await bucketedTotals(req, res, "calories");
});

async function bucketedTotals(req, res, kind) {
  const { start, end, bucket } = req.query;
  if (!isValidDate(start) || !isValidDate(end)) return res.status(400).json({ error: "start and end (YYYY-MM-DD) are required." });
  const trunc = bucket === "month" ? "month" : bucket === "week" ? "week" : "day";
  const { rows } = await pool.query("SELECT * FROM daily_logs WHERE user_id = $1 AND date BETWEEN $2 AND $3", [req.user.id, start, end]);
  const details = await Promise.all(rows.map((r) => buildDayDetail(req.user.id, r.date)));
  const buckets = {};
  for (const d of details) {
    const key = trunc === "day" ? d.date : trunc === "week" ? startOfWeekISO(d.date) : startOfMonthISO(d.date);
    const value = kind === "duration" ? d.totals.totalDurationMinutes : d.totals.totalCaloriesBurned;
    buckets[key] = (buckets[key] || 0) + value;
  }
  const series = Object.entries(buckets).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, value]) => ({ bucket: key, value: round(value, 1) }));
  res.json({ bucket: trunc, series });
}

router.get("/strength-volume", async (req, res) => {
  const weeks = Math.min(Number(req.query.weeks) || 12, 52);
  const end = todayISO();
  const start = addDaysISO(startOfWeekISO(end), -7 * (weeks - 1));
  const { rows } = await pool.query("SELECT * FROM daily_logs WHERE user_id = $1 AND date BETWEEN $2 AND $3", [req.user.id, start, end]);
  const details = await Promise.all(rows.map((r) => buildDayDetail(req.user.id, r.date)));
  const buckets = {};
  for (const d of details) {
    const key = startOfWeekISO(d.date);
    buckets[key] = (buckets[key] || 0) + d.totals.totalStrengthVolumeKg;
  }
  const series = Object.entries(buckets).sort(([a], [b]) => (a < b ? -1 : 1)).map(([weekStart, value]) => ({ weekStart, totalVolumeKg: round(value, 1) }));
  res.json({ series });
});

router.get("/exercise/:exerciseId", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT se.*, dl.date FROM strength_exercises se JOIN daily_logs dl ON dl.id = se.daily_log_id
     WHERE dl.user_id = $1 AND se.exercise_id = $2 ORDER BY dl.date ASC`,
    [req.user.id, req.params.exerciseId]
  );
  const history = [];
  let overallBestWeight = 0;
  let overallBest1RM = null;
  for (const ex of rows) {
    const { rows: setRows } = await pool.query("SELECT * FROM strength_sets WHERE strength_exercise_id = $1 ORDER BY set_number ASC", [ex.id]);
    const completedSets = setRows.filter((s) => s.completed);
    const totalReps = completedSets.reduce((a, s) => a + s.reps, 0);
    const totalVolumeKg = trainingVolumeKg(setRows);
    const highestWeightKg = completedSets.reduce((max, s) => Math.max(max, Number(s.weight_kg)), 0) || null;
    const best1RM = bestEstimated1RM(setRows);
    if (highestWeightKg) overallBestWeight = Math.max(overallBestWeight, highestWeightKg);
    if (best1RM != null) overallBest1RM = Math.max(overallBest1RM || 0, best1RM);
    history.push({
      date: ex.date,
      sets: setRows.map((s) => ({ setNumber: s.set_number, reps: s.reps, weightKg: Number(s.weight_kg), completed: s.completed })),
      totalReps,
      totalVolumeKg: round(totalVolumeKg, 1),
      highestWeightKg,
      estimated1RMKg: best1RM != null ? round(best1RM, 1) : null,
    });
  }
  res.json({
    exerciseId: req.params.exerciseId,
    exerciseName: rows[0]?.exercise_name_snapshot || null,
    history,
    highestWeightKgEver: overallBestWeight || null,
    best1RMKgEver: overallBest1RM != null ? round(overallBest1RM, 1) : null,
  });
});

router.get("/records", async (req, res) => {
  const userId = req.user.id;
  const [strengthRows, cardioRows, weekly] = await Promise.all([
    pool.query(
      `SELECT se.exercise_name_snapshot, ss.weight_kg, ss.reps
       FROM strength_sets ss
       JOIN strength_exercises se ON se.id = ss.strength_exercise_id
       JOIN daily_logs dl ON dl.id = se.daily_log_id
       WHERE dl.user_id = $1 AND ss.completed = true`,
      [userId]
    ),
    pool.query(
      `SELECT cs.activity_name_snapshot, cs.distance_km, cs.duration_minutes, cs.pace_seconds_per_unit, dl.date
       FROM cardio_sessions cs JOIN daily_logs dl ON dl.id = cs.daily_log_id WHERE dl.user_id = $1`,
      [userId]
    ),
    pool.query(`SELECT date FROM daily_logs WHERE user_id = $1`, [userId]),
  ]);

  const byExercise = {};
  for (const r of strengthRows.rows) {
    const key = r.exercise_name_snapshot;
    const weight = Number(r.weight_kg);
    const est1RM = weight * (1 + Number(r.reps) / 30);
    if (!byExercise[key]) byExercise[key] = { exerciseName: key, highestWeightKg: 0, best1RMKg: 0 };
    byExercise[key].highestWeightKg = Math.max(byExercise[key].highestWeightKg, weight);
    byExercise[key].best1RMKg = Math.max(byExercise[key].best1RMKg, est1RM);
  }
  const exerciseRecords = Object.values(byExercise)
    .map((r) => ({ ...r, highestWeightKg: round(r.highestWeightKg, 1), best1RMKg: round(r.best1RMKg, 1) }))
    .sort((a, b) => b.best1RMKg - a.best1RMKg);

  let longestRunKm = null;
  let fastestPaceSecondsPerUnit = null;
  let longestWorkoutMinutes = 0;
  for (const c of cardioRows.rows) {
    if (c.distance_km != null) longestRunKm = Math.max(longestRunKm || 0, Number(c.distance_km));
    if (c.pace_seconds_per_unit != null) fastestPaceSecondsPerUnit = fastestPaceSecondsPerUnit == null ? Number(c.pace_seconds_per_unit) : Math.min(fastestPaceSecondsPerUnit, Number(c.pace_seconds_per_unit));
    longestWorkoutMinutes = Math.max(longestWorkoutMinutes, Number(c.duration_minutes));
  }

  const dates = [...new Set(weekly.rows.map((r) => r.date))];
  let highestWeeklyVolumeKg = 0;
  if (dates.length) {
    const weeks = [...new Set(dates.map((d) => startOfWeekISO(d)))];
    for (const w of weeks) {
      const agg = await weekAggregate(userId, w);
      highestWeeklyVolumeKg = Math.max(highestWeeklyVolumeKg, agg.totalStrengthVolumeKg);
    }
  }

  res.json({
    exerciseRecords: exerciseRecords.slice(0, 25),
    longestRunKm: longestRunKm != null ? round(longestRunKm, 2) : null,
    fastestPaceSecondsPerUnit,
    longestWorkoutMinutes: longestWorkoutMinutes || null,
    highestWeeklyVolumeKg: round(highestWeeklyVolumeKg, 1) || null,
  });
});

export default router;
