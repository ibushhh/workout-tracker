import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../auth.js";
import { uid, isValidDate } from "../helpers.js";
import { weightToKg } from "../calc.js";

const router = Router();
router.use(requireAuth);

function toCsv(rows, columns) {
  const escape = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => c.label).join(",");
  const body = rows.map((r) => columns.map((c) => escape(c.value(r))).join(",")).join("\n");
  return header + "\n" + body;
}

function sendCsv(res, filename, csv) {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

router.get("/cardio.csv", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT dl.date, cs.* FROM cardio_sessions cs JOIN daily_logs dl ON dl.id = cs.daily_log_id WHERE dl.user_id = $1 ORDER BY dl.date ASC`,
    [req.user.id]
  );
  const csv = toCsv(rows, [
    { label: "Date", value: (r) => r.date },
    { label: "Activity", value: (r) => r.activity_name_snapshot },
    { label: "Duration (min)", value: (r) => r.duration_minutes },
    { label: "Calories", value: (r) => r.calories_burned },
    { label: "Avg HR", value: (r) => r.average_heart_rate },
    { label: "Max HR", value: (r) => r.maximum_heart_rate },
    { label: "Distance (km)", value: (r) => r.distance_km },
    { label: "Pace (sec/unit)", value: (r) => r.pace_seconds_per_unit },
    { label: "Notes", value: (r) => r.notes },
  ]);
  sendCsv(res, "cardio-history.csv", csv);
});

router.get("/strength.csv", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT dl.date, se.exercise_name_snapshot, se.muscle_group_snapshot, ss.set_number, ss.reps, ss.weight_kg, ss.completed
     FROM strength_sets ss
     JOIN strength_exercises se ON se.id = ss.strength_exercise_id
     JOIN daily_logs dl ON dl.id = se.daily_log_id
     WHERE dl.user_id = $1 ORDER BY dl.date ASC, se.order_index ASC, ss.set_number ASC`,
    [req.user.id]
  );
  const csv = toCsv(rows, [
    { label: "Date", value: (r) => r.date },
    { label: "Exercise", value: (r) => r.exercise_name_snapshot },
    { label: "Muscle Group", value: (r) => r.muscle_group_snapshot },
    { label: "Set", value: (r) => r.set_number },
    { label: "Reps", value: (r) => r.reps },
    { label: "Weight (kg)", value: (r) => r.weight_kg },
    { label: "Completed", value: (r) => r.completed },
  ]);
  sendCsv(res, "strength-history.csv", csv);
});

router.get("/body-measurements.csv", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM body_measurements WHERE user_id = $1 ORDER BY date ASC", [req.user.id]);
  const csv = toCsv(rows, [
    { label: "Date", value: (r) => r.date },
    { label: "Body Weight (kg)", value: (r) => r.body_weight_kg },
    { label: "Waist (cm)", value: (r) => r.waist_cm },
    { label: "Body Fat %", value: (r) => r.body_fat_percentage },
    { label: "Notes", value: (r) => r.notes },
  ]);
  sendCsv(res, "body-measurements.csv", csv);
});

router.get("/backup.json", async (req, res) => {
  const userId = req.user.id;
  const [dailyLogs, cardioSessions, strengthExercises, strengthSets, bodyMeasurements, exercises, cardioActivities, templates] = await Promise.all([
    pool.query("SELECT * FROM daily_logs WHERE user_id = $1", [userId]),
    pool.query("SELECT cs.* FROM cardio_sessions cs JOIN daily_logs dl ON dl.id = cs.daily_log_id WHERE dl.user_id = $1", [userId]),
    pool.query("SELECT se.* FROM strength_exercises se JOIN daily_logs dl ON dl.id = se.daily_log_id WHERE dl.user_id = $1", [userId]),
    pool.query("SELECT ss.* FROM strength_sets ss JOIN strength_exercises se ON se.id = ss.strength_exercise_id JOIN daily_logs dl ON dl.id = se.daily_log_id WHERE dl.user_id = $1", [userId]),
    pool.query("SELECT * FROM body_measurements WHERE user_id = $1", [userId]),
    pool.query("SELECT * FROM exercises WHERE user_id = $1", [userId]),
    pool.query("SELECT * FROM cardio_activities WHERE user_id = $1", [userId]),
    pool.query("SELECT * FROM workout_templates WHERE user_id = $1", [userId]),
  ]);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="workout-tracker-backup.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    version: 1,
    dailyLogs: dailyLogs.rows,
    cardioSessions: cardioSessions.rows,
    strengthExercises: strengthExercises.rows,
    strengthSets: strengthSets.rows,
    bodyMeasurements: bodyMeasurements.rows,
    exercises: exercises.rows,
    cardioActivities: cardioActivities.rows,
    templates: templates.rows,
  });
});

// Imports a JSON backup produced by GET /backup.json. Rows are re-inserted
// with fresh ids (ON CONFLICT DO NOTHING keyed by natural fields) so
// importing twice, or into an account that already has some data, doesn't
// duplicate or clobber anything.
router.post("/import", async (req, res) => {
  const backup = req.body || {};
  if (!Array.isArray(backup.dailyLogs)) return res.status(400).json({ error: "That file doesn't look like a workout tracker backup." });
  const userId = req.user.id;
  const idMap = {};

  for (const log of backup.dailyLogs) {
    if (!isValidDate(log.date?.slice?.(0, 10) || log.date)) continue;
    const date = String(log.date).slice(0, 10);
    const { rows } = await pool.query(
      `INSERT INTO daily_logs (id, user_id, date, day_type, body_weight_kg, notes, manual_strength_duration_minutes, manual_strength_calories, sleep_rating, soreness_rating, energy_rating, difficulty_rating)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (user_id, date) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [uid(), userId, date, log.day_type || "rest", log.body_weight_kg, log.notes, log.manual_strength_duration_minutes, log.manual_strength_calories, log.sleep_rating, log.soreness_rating, log.energy_rating, log.difficulty_rating]
    );
    idMap[log.id] = rows[0].id;
  }
  for (const c of backup.cardioSessions || []) {
    const dailyLogId = idMap[c.daily_log_id];
    if (!dailyLogId || !c.duration_minutes) continue;
    await pool.query(
      `INSERT INTO cardio_sessions (id, daily_log_id, activity_name_snapshot, duration_minutes, calories_burned, average_heart_rate, maximum_heart_rate, pace_seconds_per_unit, distance_km, distance_unit, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [uid(), dailyLogId, c.activity_name_snapshot || "Cardio", c.duration_minutes, c.calories_burned, c.average_heart_rate, c.maximum_heart_rate, c.pace_seconds_per_unit, c.distance_km, c.distance_unit, c.notes]
    );
  }
  const exIdMap = {};
  for (const se of backup.strengthExercises || []) {
    const dailyLogId = idMap[se.daily_log_id];
    if (!dailyLogId || !se.exercise_name_snapshot) continue;
    const { rows } = await pool.query(
      `INSERT INTO strength_exercises (id, daily_log_id, exercise_name_snapshot, muscle_group_snapshot, order_index, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [uid(), dailyLogId, se.exercise_name_snapshot, se.muscle_group_snapshot, se.order_index || 0, se.notes]
    );
    exIdMap[se.id] = rows[0].id;
  }
  for (const ss of backup.strengthSets || []) {
    const strengthExerciseId = exIdMap[ss.strength_exercise_id];
    if (!strengthExerciseId || !ss.reps || ss.weight_kg == null) continue;
    await pool.query(
      `INSERT INTO strength_sets (id, strength_exercise_id, set_number, reps, weight_kg, weight_unit, completed) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uid(), strengthExerciseId, ss.set_number || 1, ss.reps, ss.weight_kg, ss.weight_unit || "kg", ss.completed !== false]
    );
  }
  for (const bm of backup.bodyMeasurements || []) {
    if (!bm.body_weight_kg) continue;
    const date = String(bm.date).slice(0, 10);
    if (!isValidDate(date)) continue;
    await pool.query(
      `INSERT INTO body_measurements (id, user_id, date, body_weight_kg, waist_cm, body_fat_percentage, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id, date) DO NOTHING`,
      [uid(), userId, date, bm.body_weight_kg, bm.waist_cm, bm.body_fat_percentage, bm.notes]
    );
  }
  for (const ex of backup.exercises || []) {
    if (!ex.name) continue;
    await pool.query(
      `INSERT INTO exercises (id, user_id, name, primary_muscle_group, secondary_muscle_groups, category, equipment_type, notes, is_favorite, is_archived)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uid(), userId, ex.name, ex.primary_muscle_group || "Full body", ex.secondary_muscle_groups || [], ex.category, ex.equipment_type, ex.notes, ex.is_favorite || false, ex.is_archived || false]
    );
  }
  res.json({ ok: true, dailyLogsImported: backup.dailyLogs.length });
});

export default router;
