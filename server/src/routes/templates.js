import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../auth.js";
import { uid, isValidDate, todayISO } from "../helpers.js";

const router = Router();
router.use(requireAuth);

async function serializeTemplate(row) {
  const { rows } = await pool.query("SELECT * FROM workout_template_exercises WHERE template_id = $1 ORDER BY order_index ASC", [row.id]);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    exercises: rows.map((e) => ({
      id: e.id,
      exerciseId: e.exercise_id,
      exerciseName: e.exercise_name_snapshot,
      targetSets: e.target_sets,
      targetReps: e.target_reps,
      targetWeightKg: e.target_weight_kg != null ? Number(e.target_weight_kg) : null,
      notes: e.notes,
    })),
    createdAt: row.created_at,
  };
}

router.get("/", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM workout_templates WHERE user_id = $1 ORDER BY name ASC", [req.user.id]);
  res.json({ templates: await Promise.all(rows.map(serializeTemplate)) });
});

router.post("/", async (req, res) => {
  const { name, description, exercises } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Template name is required." });
  const id = uid();
  const { rows } = await pool.query(
    "INSERT INTO workout_templates (id, user_id, name, description) VALUES ($1,$2,$3,$4) RETURNING *",
    [id, req.user.id, String(name).trim(), description || null]
  );
  for (let i = 0; i < (exercises || []).length; i++) {
    const e = exercises[i];
    let nameSnapshot = e.exerciseName;
    if (e.exerciseId) {
      const { rows: exRows } = await pool.query("SELECT name FROM exercises WHERE id = $1 AND (user_id IS NULL OR user_id = $2)", [e.exerciseId, req.user.id]);
      if (exRows[0]) nameSnapshot = exRows[0].name;
    }
    await pool.query(
      `INSERT INTO workout_template_exercises (id, template_id, exercise_id, exercise_name_snapshot, order_index, target_sets, target_reps, target_weight_kg, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uid(), id, e.exerciseId || null, nameSnapshot || "Exercise", i, e.targetSets || null, e.targetReps || null, e.targetWeightKg || null, e.notes || null]
    );
  }
  res.status(201).json({ template: await serializeTemplate(rows[0]) });
});

router.patch("/:id", async (req, res) => {
  const { name, description, exercises } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Template name is required." });
  const { rows: existing } = await pool.query("SELECT id FROM workout_templates WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  if (!existing[0]) return res.status(404).json({ error: "Template not found." });

  const { rows } = await pool.query(
    "UPDATE workout_templates SET name = $1, description = $2, updated_at = now() WHERE id = $3 RETURNING *",
    [String(name).trim(), description || null, req.params.id]
  );
  // Simplest correct way to apply an edited exercise list: replace it
  // wholesale rather than diffing adds/removes/reorders against the old one.
  await pool.query("DELETE FROM workout_template_exercises WHERE template_id = $1", [req.params.id]);
  for (let i = 0; i < (exercises || []).length; i++) {
    const e = exercises[i];
    let nameSnapshot = e.exerciseName;
    if (e.exerciseId) {
      const { rows: exRows } = await pool.query("SELECT name FROM exercises WHERE id = $1 AND (user_id IS NULL OR user_id = $2)", [e.exerciseId, req.user.id]);
      if (exRows[0]) nameSnapshot = exRows[0].name;
    }
    await pool.query(
      `INSERT INTO workout_template_exercises (id, template_id, exercise_id, exercise_name_snapshot, order_index, target_sets, target_reps, target_weight_kg, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uid(), req.params.id, e.exerciseId || null, nameSnapshot || "Exercise", i, e.targetSets || null, e.targetReps || null, e.targetWeightKg || null, e.notes || null]
    );
  }
  res.json({ template: await serializeTemplate(rows[0]) });
});

router.delete("/:id", async (req, res) => {
  const { rows } = await pool.query("DELETE FROM workout_templates WHERE id = $1 AND user_id = $2 RETURNING id", [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "Template not found." });
  res.json({ ok: true });
});

// Applies a template's exercises to a given date's daily log as new
// strength-exercise entries (target values become the first set's reps/weight,
// left for the user to adjust — this is a starting point, not a lock-in).
router.post("/:id/apply", async (req, res) => {
  const { date } = req.body || {};
  if (!isValidDate(date)) return res.status(400).json({ error: "A valid date is required." });
  const { rows: tplRows } = await pool.query("SELECT * FROM workout_templates WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  if (!tplRows[0]) return res.status(404).json({ error: "Template not found." });
  const { rows: tplExercises } = await pool.query("SELECT * FROM workout_template_exercises WHERE template_id = $1 ORDER BY order_index ASC", [req.params.id]);

  let { rows: logRows } = await pool.query("SELECT * FROM daily_logs WHERE user_id = $1 AND date = $2", [req.user.id, date]);
  let log = logRows[0];
  if (!log) {
    const { rows } = await pool.query("INSERT INTO daily_logs (id, user_id, date, day_type) VALUES ($1,$2,$3,'rest') RETURNING *", [uid(), req.user.id, date]);
    log = rows[0];
  }
  const { rows: countRows } = await pool.query("SELECT count(*)::int AS n FROM strength_exercises WHERE daily_log_id = $1", [log.id]);
  let orderIndex = countRows[0].n;
  for (const te of tplExercises) {
    const { rows: exRows } = await pool.query(
      `INSERT INTO strength_exercises (id, daily_log_id, exercise_id, exercise_name_snapshot, muscle_group_snapshot, order_index)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [uid(), log.id, te.exercise_id, te.exercise_name_snapshot, null, orderIndex++]
    );
    const sets = te.target_sets || 1;
    for (let i = 0; i < sets; i++) {
      await pool.query(
        `INSERT INTO strength_sets (id, strength_exercise_id, set_number, reps, weight_kg, weight_unit, completed) VALUES ($1,$2,$3,$4,$5,$6,false)`,
        [uid(), exRows[0].id, i + 1, te.target_reps || 8, te.target_weight_kg || 0, req.user.defaultWeightUnit]
      );
    }
  }
  await pool.query(
    `UPDATE daily_logs SET day_type = CASE WHEN day_type = 'cardio_only' THEN 'workout' ELSE 'strength_only' END, updated_at = now() WHERE id = $1`,
    [log.id]
  );
  res.json({ ok: true });
});

export default router;
