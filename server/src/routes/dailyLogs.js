import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../auth.js";
import { uid, isValidDate, todayISO } from "../helpers.js";
import { trainingVolumeKg, bestEstimated1RM, weightToKg, distanceToKm, paceSecondsPerUnit } from "../calc.js";

const router = Router();
router.use(requireAuth);

function requireDate(date, res) {
  if (!isValidDate(date)) {
    res.status(400).json({ error: "A valid date (YYYY-MM-DD) is required." });
    return false;
  }
  return true;
}

async function getDailyLogRow(userId, date) {
  const { rows } = await pool.query("SELECT * FROM daily_logs WHERE user_id = $1 AND date = $2", [userId, date]);
  return rows[0] || null;
}

async function getOrCreateDailyLog(userId, date) {
  const existing = await getDailyLogRow(userId, date);
  if (existing) return existing;
  const { rows } = await pool.query(
    `INSERT INTO daily_logs (id, user_id, date, day_type) VALUES ($1, $2, $3, 'rest') RETURNING *`,
    [uid(), userId, date]
  );
  return rows[0];
}

async function recomputeDayType(dailyLogId) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM cardio_sessions WHERE daily_log_id = $1) AS cardio_count,
       (SELECT count(*)::int FROM strength_exercises WHERE daily_log_id = $1) AS strength_count`,
    [dailyLogId]
  );
  const { cardio_count, strength_count } = rows[0];
  const dayType = cardio_count > 0 && strength_count > 0 ? "workout" : cardio_count > 0 ? "cardio_only" : strength_count > 0 ? "strength_only" : "rest";
  await pool.query("UPDATE daily_logs SET day_type = $1, updated_at = now() WHERE id = $2", [dayType, dailyLogId]);
  return dayType;
}

function serializeCardioSession(row) {
  return {
    id: row.id,
    cardioActivityId: row.cardio_activity_id,
    activityName: row.activity_name_snapshot,
    durationMinutes: Number(row.duration_minutes),
    caloriesBurned: row.calories_burned != null ? Number(row.calories_burned) : null,
    averageHeartRate: row.average_heart_rate,
    maximumHeartRate: row.maximum_heart_rate,
    paceSecondsPerUnit: row.pace_seconds_per_unit != null ? Number(row.pace_seconds_per_unit) : null,
    distanceKm: row.distance_km != null ? Number(row.distance_km) : null,
    distanceUnit: row.distance_unit,
    notes: row.notes,
  };
}

function serializeStrengthExercise(exerciseRow, setRows) {
  const sets = setRows.map((s) => ({
    id: s.id,
    setNumber: s.set_number,
    reps: s.reps,
    weightKg: Number(s.weight_kg),
    weightUnit: s.weight_unit,
    completed: s.completed,
  }));
  return {
    id: exerciseRow.id,
    exerciseId: exerciseRow.exercise_id,
    exerciseName: exerciseRow.exercise_name_snapshot,
    muscleGroup: exerciseRow.muscle_group_snapshot,
    notes: exerciseRow.notes,
    orderIndex: exerciseRow.order_index,
    sets,
    totals: {
      totalReps: sets.filter((s) => s.completed).reduce((a, s) => a + s.reps, 0),
      totalVolumeKg: trainingVolumeKg(setRows),
      highestWeightKg: sets.filter((s) => s.completed).reduce((max, s) => Math.max(max, s.weightKg), 0) || null,
      estimated1RMKg: bestEstimated1RM(setRows),
    },
  };
}

export async function buildDayDetail(userId, date) {
  const log = await getDailyLogRow(userId, date);
  if (!log) {
    return {
      date,
      exists: false,
      dayType: "rest",
      notes: null,
      bodyWeightKg: null,
      sleepRating: null,
      sorenessRating: null,
      energyRating: null,
      difficultyRating: null,
      manualStrengthDurationMinutes: null,
      manualStrengthCalories: null,
      cardioSessions: [],
      strengthExercises: [],
      totals: { totalDurationMinutes: 0, totalCaloriesBurned: 0, cardioSessionsCount: 0, strengthExercisesCount: 0, totalSets: 0, totalStrengthVolumeKg: 0 },
    };
  }
  const [cardioRes, exerciseRes] = await Promise.all([
    pool.query("SELECT * FROM cardio_sessions WHERE daily_log_id = $1 ORDER BY created_at ASC", [log.id]),
    pool.query("SELECT * FROM strength_exercises WHERE daily_log_id = $1 ORDER BY order_index ASC, created_at ASC", [log.id]),
  ]);
  const exerciseIds = exerciseRes.rows.map((r) => r.id);
  let setsByExercise = {};
  if (exerciseIds.length) {
    const { rows: setRows } = await pool.query(
      `SELECT * FROM strength_sets WHERE strength_exercise_id = ANY($1) ORDER BY set_number ASC`,
      [exerciseIds]
    );
    setsByExercise = setRows.reduce((acc, s) => {
      (acc[s.strength_exercise_id] ||= []).push(s);
      return acc;
    }, {});
  }
  const strengthExercises = exerciseRes.rows.map((ex) => serializeStrengthExercise(ex, setsByExercise[ex.id] || []));
  const cardioSessions = cardioRes.rows.map(serializeCardioSession);

  let bodyWeightKg = log.body_weight_kg != null ? Number(log.body_weight_kg) : null;
  if (bodyWeightKg == null) {
    const { rows } = await pool.query("SELECT body_weight_kg FROM body_measurements WHERE user_id = $1 AND date = $2", [userId, date]);
    if (rows[0]) bodyWeightKg = Number(rows[0].body_weight_kg);
  }

  const cardioDuration = cardioSessions.reduce((a, c) => a + c.durationMinutes, 0);
  const cardioCalories = cardioSessions.reduce((a, c) => a + (c.caloriesBurned || 0), 0);
  const manualDuration = log.manual_strength_duration_minutes != null ? Number(log.manual_strength_duration_minutes) : 0;
  const manualCalories = log.manual_strength_calories != null ? Number(log.manual_strength_calories) : 0;
  const totalSets = strengthExercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
  const totalStrengthVolumeKg = strengthExercises.reduce((a, e) => a + e.totals.totalVolumeKg, 0);

  return {
    date,
    exists: true,
    dayType: log.day_type,
    notes: log.notes,
    bodyWeightKg,
    sleepRating: log.sleep_rating,
    sorenessRating: log.soreness_rating,
    energyRating: log.energy_rating,
    difficultyRating: log.difficulty_rating,
    manualStrengthDurationMinutes: log.manual_strength_duration_minutes != null ? Number(log.manual_strength_duration_minutes) : null,
    manualStrengthCalories: log.manual_strength_calories != null ? Number(log.manual_strength_calories) : null,
    cardioSessions,
    strengthExercises,
    totals: {
      totalDurationMinutes: cardioDuration + manualDuration,
      totalCaloriesBurned: cardioCalories + manualCalories,
      cardioSessionsCount: cardioSessions.length,
      strengthExercisesCount: strengthExercises.length,
      totalSets,
      totalStrengthVolumeKg,
    },
  };
}

router.get("/recent-exercises", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (se.exercise_id) se.exercise_id, se.exercise_name_snapshot, se.muscle_group_snapshot, dl.date
     FROM strength_exercises se
     JOIN daily_logs dl ON dl.id = se.daily_log_id
     WHERE dl.user_id = $1 AND se.exercise_id IS NOT NULL
     ORDER BY se.exercise_id, dl.date DESC
     LIMIT 200`,
    [req.user.id]
  );
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json({
    recentExercises: rows.slice(0, 12).map((r) => ({ exerciseId: r.exercise_id, exerciseName: r.exercise_name_snapshot, muscleGroup: r.muscle_group_snapshot, lastUsed: r.date })),
  });
});

router.get("/last-strength/:exerciseId", async (req, res) => {
  const { rows: exRows } = await pool.query(
    `SELECT se.* FROM strength_exercises se JOIN daily_logs dl ON dl.id = se.daily_log_id
     WHERE dl.user_id = $1 AND se.exercise_id = $2 ORDER BY dl.date DESC, se.created_at DESC LIMIT 1`,
    [req.user.id, req.params.exerciseId]
  );
  const exercise = exRows[0];
  if (!exercise) return res.json({ strengthExercise: null });
  const { rows: setRows } = await pool.query("SELECT * FROM strength_sets WHERE strength_exercise_id = $1 ORDER BY set_number ASC", [exercise.id]);
  res.json({ strengthExercise: serializeStrengthExercise(exercise, setRows) });
});

router.get("/", async (req, res) => {
  const { start, end } = req.query;
  if (!isValidDate(start) || !isValidDate(end)) return res.status(400).json({ error: "start and end (YYYY-MM-DD) are required." });
  const { rows } = await pool.query("SELECT * FROM daily_logs WHERE user_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date ASC", [req.user.id, start, end]);
  const details = await Promise.all(rows.map((r) => buildDayDetail(req.user.id, r.date)));
  res.json({ days: details });
});

router.get("/:date", async (req, res) => {
  if (!requireDate(req.params.date, res)) return;
  res.json(await buildDayDetail(req.user.id, req.params.date));
});

router.put("/:date", async (req, res) => {
  if (!requireDate(req.params.date, res)) return;
  const { dayType, notes, bodyWeight, weightUnit, sleepRating, sorenessRating, energyRating, difficultyRating, manualStrengthDurationMinutes, manualStrengthCalories } = req.body || {};
  if (dayType && !["workout", "cardio_only", "strength_only", "rest"].includes(dayType)) {
    return res.status(400).json({ error: "Invalid day type." });
  }
  for (const [label, val] of [["sleepRating", sleepRating], ["sorenessRating", sorenessRating], ["energyRating", energyRating], ["difficultyRating", difficultyRating]]) {
    if (val != null && (val < 1 || val > 10)) return res.status(400).json({ error: `${label} must be between 1 and 10.` });
  }
  if (manualStrengthDurationMinutes != null && manualStrengthDurationMinutes < 0) return res.status(400).json({ error: "Duration cannot be negative." });
  if (manualStrengthCalories != null && manualStrengthCalories < 0) return res.status(400).json({ error: "Calories cannot be negative." });

  const log = await getOrCreateDailyLog(req.user.id, req.params.date);
  const bodyWeightKg = bodyWeight != null ? weightToKg(bodyWeight, weightUnit || req.user.defaultWeightUnit) : undefined;
  if (bodyWeightKg != null && bodyWeightKg <= 0) return res.status(400).json({ error: "Body weight must be greater than zero." });

  await pool.query(
    `UPDATE daily_logs SET
       day_type = COALESCE($1, day_type),
       notes = $2,
       body_weight_kg = COALESCE($3, body_weight_kg),
       sleep_rating = $4, soreness_rating = $5, energy_rating = $6, difficulty_rating = $7,
       manual_strength_duration_minutes = $8, manual_strength_calories = $9,
       updated_at = now()
     WHERE id = $10`,
    [
      dayType || null,
      notes ?? log.notes,
      bodyWeightKg ?? null,
      sleepRating ?? log.sleep_rating,
      sorenessRating ?? log.soreness_rating,
      energyRating ?? log.energy_rating,
      difficultyRating ?? log.difficulty_rating,
      manualStrengthDurationMinutes ?? log.manual_strength_duration_minutes,
      manualStrengthCalories ?? log.manual_strength_calories,
      log.id,
    ]
  );

  if (bodyWeightKg != null) {
    await pool.query(
      `INSERT INTO body_measurements (id, user_id, date, body_weight_kg)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, date) DO UPDATE SET body_weight_kg = EXCLUDED.body_weight_kg, updated_at = now()`,
      [uid(), req.user.id, req.params.date, bodyWeightKg]
    );
  }

  if (dayType && dayType !== "rest") {
    // explicit non-rest selection is honored as-is; recompute only runs
    // after entries are added/removed (see recomputeDayType call sites)
  } else if (dayType === "rest") {
    await recomputeDayType(log.id);
  }

  res.json(await buildDayDetail(req.user.id, req.params.date));
});

router.post("/:date/cardio-sessions", async (req, res) => {
  if (!requireDate(req.params.date, res)) return;
  const { cardioActivityId, activityName, durationMinutes, caloriesBurned, averageHeartRate, maximumHeartRate, distance, distanceUnit, pace, notes } = req.body || {};
  if (!durationMinutes || durationMinutes <= 0) return res.status(400).json({ error: "Duration must be greater than zero." });
  if (caloriesBurned != null && caloriesBurned < 0) return res.status(400).json({ error: "Calories cannot be negative." });
  if (averageHeartRate != null && (averageHeartRate < 20 || averageHeartRate > 250)) return res.status(400).json({ error: "Average heart rate is out of range." });
  if (maximumHeartRate != null && (maximumHeartRate < 20 || maximumHeartRate > 250)) return res.status(400).json({ error: "Maximum heart rate is out of range." });
  if (distance != null && distance < 0) return res.status(400).json({ error: "Distance cannot be negative." });

  let nameSnapshot = activityName;
  if (cardioActivityId) {
    const { rows } = await pool.query("SELECT name FROM cardio_activities WHERE id = $1 AND (user_id IS NULL OR user_id = $2)", [cardioActivityId, req.user.id]);
    if (!rows[0]) return res.status(400).json({ error: "Cardio activity not found." });
    nameSnapshot = rows[0].name;
  }
  if (!nameSnapshot) return res.status(400).json({ error: "A cardio activity is required." });

  const distanceKm = distanceToKm(distance, distanceUnit || req.user.defaultDistanceUnit);
  const distUnit = distance != null ? distanceUnit || req.user.defaultDistanceUnit : null;
  const paceSeconds = pace != null ? pace : distanceKm && distanceKm > 0 ? paceSecondsPerUnit(durationMinutes, distanceUnit === "mi" ? distance : distanceKm) : null;

  const log = await getOrCreateDailyLog(req.user.id, req.params.date);
  const { rows } = await pool.query(
    `INSERT INTO cardio_sessions (id, daily_log_id, cardio_activity_id, activity_name_snapshot, duration_minutes, calories_burned, average_heart_rate, maximum_heart_rate, pace_seconds_per_unit, distance_km, distance_unit, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [uid(), log.id, cardioActivityId || null, nameSnapshot, durationMinutes, caloriesBurned ?? null, averageHeartRate ?? null, maximumHeartRate ?? null, paceSeconds, distanceKm, distUnit, notes || null]
  );
  await recomputeDayType(log.id);
  res.status(201).json({ cardioSession: serializeCardioSession(rows[0]), day: await buildDayDetail(req.user.id, req.params.date) });
});

async function loadCardioSessionForUser(id, userId) {
  const { rows } = await pool.query(
    `SELECT cs.*, dl.date, dl.user_id FROM cardio_sessions cs JOIN daily_logs dl ON dl.id = cs.daily_log_id WHERE cs.id = $1 AND dl.user_id = $2`,
    [id, userId]
  );
  return rows[0];
}

router.patch("/cardio-sessions/:id", async (req, res) => {
  const existing = await loadCardioSessionForUser(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Cardio session not found." });
  const { durationMinutes, caloriesBurned, averageHeartRate, maximumHeartRate, distance, distanceUnit, pace, notes, activityName } = req.body || {};
  if (durationMinutes != null && durationMinutes <= 0) return res.status(400).json({ error: "Duration must be greater than zero." });
  if (caloriesBurned != null && caloriesBurned < 0) return res.status(400).json({ error: "Calories cannot be negative." });
  if (averageHeartRate != null && (averageHeartRate < 20 || averageHeartRate > 250)) return res.status(400).json({ error: "Average heart rate is out of range." });
  if (maximumHeartRate != null && (maximumHeartRate < 20 || maximumHeartRate > 250)) return res.status(400).json({ error: "Maximum heart rate is out of range." });

  const distanceKm = distance != null ? distanceToKm(distance, distanceUnit || req.user.defaultDistanceUnit) : undefined;
  const { rows } = await pool.query(
    `UPDATE cardio_sessions SET
       activity_name_snapshot = COALESCE($1, activity_name_snapshot),
       duration_minutes = COALESCE($2, duration_minutes),
       calories_burned = COALESCE($3, calories_burned),
       average_heart_rate = COALESCE($4, average_heart_rate),
       maximum_heart_rate = COALESCE($5, maximum_heart_rate),
       distance_km = COALESCE($6, distance_km),
       distance_unit = COALESCE($7, distance_unit),
       pace_seconds_per_unit = COALESCE($8, pace_seconds_per_unit),
       notes = COALESCE($9, notes),
       updated_at = now()
     WHERE id = $10 RETURNING *`,
    [activityName ?? null, durationMinutes ?? null, caloriesBurned ?? null, averageHeartRate ?? null, maximumHeartRate ?? null, distanceKm ?? null, distanceUnit ?? null, pace ?? null, notes ?? null, existing.id]
  );
  res.json({ cardioSession: serializeCardioSession(rows[0]), day: await buildDayDetail(req.user.id, existing.date) });
});

router.delete("/cardio-sessions/:id", async (req, res) => {
  const existing = await loadCardioSessionForUser(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Cardio session not found." });
  await pool.query("DELETE FROM cardio_sessions WHERE id = $1", [existing.id]);
  const dailyLogId = existing.daily_log_id;
  await recomputeDayType(dailyLogId);
  res.json({ ok: true, day: await buildDayDetail(req.user.id, existing.date) });
});

function validateSets(sets) {
  if (!Array.isArray(sets) || sets.length === 0) return "At least one set is required.";
  for (const s of sets) {
    if (!s.reps || s.reps <= 0) return "Reps must be greater than zero for every set.";
    if (s.weight == null || s.weight < 0) return "Weight cannot be negative.";
  }
  return null;
}

router.post("/:date/strength-exercises", async (req, res) => {
  if (!requireDate(req.params.date, res)) return;
  const { exerciseId, exerciseName, muscleGroup, notes, sets } = req.body || {};
  const setError = validateSets(sets);
  if (setError) return res.status(400).json({ error: setError });

  let nameSnapshot = exerciseName;
  let muscleSnapshot = muscleGroup || null;
  if (exerciseId) {
    const { rows } = await pool.query("SELECT name, primary_muscle_group FROM exercises WHERE id = $1 AND (user_id IS NULL OR user_id = $2)", [exerciseId, req.user.id]);
    if (!rows[0]) return res.status(400).json({ error: "Exercise not found." });
    nameSnapshot = rows[0].name;
    muscleSnapshot = muscleGroup || rows[0].primary_muscle_group;
  }
  if (!nameSnapshot) return res.status(400).json({ error: "An exercise is required." });

  const log = await getOrCreateDailyLog(req.user.id, req.params.date);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: countRows } = await client.query("SELECT count(*)::int AS n FROM strength_exercises WHERE daily_log_id = $1", [log.id]);
    const { rows: exRows } = await client.query(
      `INSERT INTO strength_exercises (id, daily_log_id, exercise_id, exercise_name_snapshot, muscle_group_snapshot, order_index, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [uid(), log.id, exerciseId || null, nameSnapshot, muscleSnapshot, countRows[0].n, notes || null]
    );
    const exerciseRow = exRows[0];
    const setRows = [];
    for (let i = 0; i < sets.length; i++) {
      const s = sets[i];
      const weightKg = weightToKg(s.weight, s.weightUnit || req.user.defaultWeightUnit);
      const { rows } = await client.query(
        `INSERT INTO strength_sets (id, strength_exercise_id, set_number, reps, weight_kg, weight_unit, completed)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [uid(), exerciseRow.id, i + 1, s.reps, weightKg, s.weightUnit || req.user.defaultWeightUnit, s.completed !== false]
      );
      setRows.push(rows[0]);
    }
    await client.query("COMMIT");
    client.release();
    await recomputeDayType(log.id);
    res.status(201).json({ strengthExercise: serializeStrengthExercise(exerciseRow, setRows), day: await buildDayDetail(req.user.id, req.params.date) });
  } catch (e) {
    await client.query("ROLLBACK");
    client.release();
    throw e;
  }
});

async function loadStrengthExerciseForUser(id, userId) {
  const { rows } = await pool.query(
    `SELECT se.*, dl.date, dl.user_id FROM strength_exercises se JOIN daily_logs dl ON dl.id = se.daily_log_id WHERE se.id = $1 AND dl.user_id = $2`,
    [id, userId]
  );
  return rows[0];
}

router.patch("/strength-exercises/:id", async (req, res) => {
  const existing = await loadStrengthExerciseForUser(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Strength exercise not found." });
  const { notes, muscleGroup } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE strength_exercises SET notes = COALESCE($1, notes), muscle_group_snapshot = COALESCE($2, muscle_group_snapshot), updated_at = now() WHERE id = $3 RETURNING *`,
    [notes ?? null, muscleGroup ?? null, existing.id]
  );
  const { rows: setRows } = await pool.query("SELECT * FROM strength_sets WHERE strength_exercise_id = $1 ORDER BY set_number ASC", [existing.id]);
  res.json({ strengthExercise: serializeStrengthExercise(rows[0], setRows) });
});

router.delete("/strength-exercises/:id", async (req, res) => {
  const existing = await loadStrengthExerciseForUser(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Strength exercise not found." });
  await pool.query("DELETE FROM strength_exercises WHERE id = $1", [existing.id]);
  await recomputeDayType(existing.daily_log_id);
  res.json({ ok: true, day: await buildDayDetail(req.user.id, existing.date) });
});

router.post("/strength-exercises/:id/sets", async (req, res) => {
  const existing = await loadStrengthExerciseForUser(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Strength exercise not found." });
  const { reps, weight, weightUnit, completed } = req.body || {};
  if (!reps || reps <= 0) return res.status(400).json({ error: "Reps must be greater than zero." });
  if (weight == null || weight < 0) return res.status(400).json({ error: "Weight cannot be negative." });
  const { rows: countRows } = await pool.query("SELECT count(*)::int AS n FROM strength_sets WHERE strength_exercise_id = $1", [existing.id]);
  const weightKg = weightToKg(weight, weightUnit || req.user.defaultWeightUnit);
  const { rows } = await pool.query(
    `INSERT INTO strength_sets (id, strength_exercise_id, set_number, reps, weight_kg, weight_unit, completed)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [uid(), existing.id, countRows[0].n + 1, reps, weightKg, weightUnit || req.user.defaultWeightUnit, completed !== false]
  );
  res.status(201).json({ set: { id: rows[0].id, setNumber: rows[0].set_number, reps: rows[0].reps, weightKg: Number(rows[0].weight_kg), weightUnit: rows[0].weight_unit, completed: rows[0].completed } });
});

async function loadSetForUser(id, userId) {
  const { rows } = await pool.query(
    `SELECT ss.*, dl.date, dl.user_id, se.daily_log_id FROM strength_sets ss
     JOIN strength_exercises se ON se.id = ss.strength_exercise_id
     JOIN daily_logs dl ON dl.id = se.daily_log_id
     WHERE ss.id = $1 AND dl.user_id = $2`,
    [id, userId]
  );
  return rows[0];
}

router.patch("/sets/:id", async (req, res) => {
  const existing = await loadSetForUser(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Set not found." });
  const { reps, weight, weightUnit, completed } = req.body || {};
  if (reps != null && reps <= 0) return res.status(400).json({ error: "Reps must be greater than zero." });
  if (weight != null && weight < 0) return res.status(400).json({ error: "Weight cannot be negative." });
  const weightKg = weight != null ? weightToKg(weight, weightUnit || existing.weight_unit) : undefined;
  const { rows } = await pool.query(
    `UPDATE strength_sets SET reps = COALESCE($1, reps), weight_kg = COALESCE($2, weight_kg), weight_unit = COALESCE($3, weight_unit), completed = COALESCE($4, completed), updated_at = now() WHERE id = $5 RETURNING *`,
    [reps ?? null, weightKg ?? null, weightUnit ?? null, completed ?? null, existing.id]
  );
  const r = rows[0];
  res.json({ set: { id: r.id, setNumber: r.set_number, reps: r.reps, weightKg: Number(r.weight_kg), weightUnit: r.weight_unit, completed: r.completed } });
});

router.delete("/sets/:id", async (req, res) => {
  const existing = await loadSetForUser(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Set not found." });
  await pool.query("DELETE FROM strength_sets WHERE id = $1", [existing.id]);
  // renumber remaining sets so set_number stays contiguous
  const { rows } = await pool.query("SELECT id FROM strength_sets WHERE strength_exercise_id = $1 ORDER BY set_number ASC", [existing.strength_exercise_id]);
  await Promise.all(rows.map((r, i) => pool.query("UPDATE strength_sets SET set_number = $1 WHERE id = $2", [i + 1, r.id])));
  res.json({ ok: true });
});

router.post("/:date/duplicate", async (req, res) => {
  if (!requireDate(req.params.date, res)) return;
  const { fromDate } = req.body || {};
  if (!isValidDate(fromDate)) return res.status(400).json({ error: "fromDate (YYYY-MM-DD) is required." });
  const sourceLog = await getDailyLogRow(req.user.id, fromDate);
  if (!sourceLog) return res.status(404).json({ error: "No workout found on that date to duplicate." });

  const targetLog = await getOrCreateDailyLog(req.user.id, req.params.date);
  const [cardioRes, exerciseRes] = await Promise.all([
    pool.query("SELECT * FROM cardio_sessions WHERE daily_log_id = $1", [sourceLog.id]),
    pool.query("SELECT * FROM strength_exercises WHERE daily_log_id = $1 ORDER BY order_index ASC", [sourceLog.id]),
  ]);
  for (const c of cardioRes.rows) {
    await pool.query(
      `INSERT INTO cardio_sessions (id, daily_log_id, cardio_activity_id, activity_name_snapshot, duration_minutes, calories_burned, average_heart_rate, maximum_heart_rate, pace_seconds_per_unit, distance_km, distance_unit, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [uid(), targetLog.id, c.cardio_activity_id, c.activity_name_snapshot, c.duration_minutes, c.calories_burned, c.average_heart_rate, c.maximum_heart_rate, c.pace_seconds_per_unit, c.distance_km, c.distance_unit, c.notes]
    );
  }
  for (let i = 0; i < exerciseRes.rows.length; i++) {
    const ex = exerciseRes.rows[i];
    const { rows: newExRows } = await pool.query(
      `INSERT INTO strength_exercises (id, daily_log_id, exercise_id, exercise_name_snapshot, muscle_group_snapshot, order_index, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [uid(), targetLog.id, ex.exercise_id, ex.exercise_name_snapshot, ex.muscle_group_snapshot, i, ex.notes]
    );
    const { rows: setRows } = await pool.query("SELECT * FROM strength_sets WHERE strength_exercise_id = $1 ORDER BY set_number ASC", [ex.id]);
    for (const s of setRows) {
      await pool.query(
        `INSERT INTO strength_sets (id, strength_exercise_id, set_number, reps, weight_kg, weight_unit, completed) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uid(), newExRows[0].id, s.set_number, s.reps, s.weight_kg, s.weight_unit, s.completed]
      );
    }
  }
  await recomputeDayType(targetLog.id);
  res.json(await buildDayDetail(req.user.id, req.params.date));
});

export default router;
