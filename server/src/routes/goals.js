import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../auth.js";
import { uid } from "../helpers.js";

const router = Router();
router.use(requireAuth);

const GOAL_TYPES = ["weekly_cardio_minutes", "weekly_workouts", "weekly_strength_volume", "target_body_weight", "exercise_milestone"];

function serialize(row) {
  return {
    id: row.id,
    goalType: row.goal_type,
    targetValue: Number(row.target_value),
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name_snapshot,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

router.get("/", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM goals WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC", [req.user.id]);
  res.json({ goals: rows.map(serialize) });
});

router.post("/", async (req, res) => {
  const { goalType, targetValue, exerciseId } = req.body || {};
  if (!GOAL_TYPES.includes(goalType)) return res.status(400).json({ error: "Invalid goal type." });
  if (!targetValue || targetValue <= 0) return res.status(400).json({ error: "Target value must be greater than zero." });
  if (goalType === "exercise_milestone" && !exerciseId) return res.status(400).json({ error: "An exercise is required for a milestone goal." });

  let exerciseName = null;
  if (exerciseId) {
    const { rows } = await pool.query("SELECT name FROM exercises WHERE id = $1 AND (user_id IS NULL OR user_id = $2)", [exerciseId, req.user.id]);
    if (!rows[0]) return res.status(400).json({ error: "Exercise not found." });
    exerciseName = rows[0].name;
  }
  // one active goal per (non-milestone) type — replacing an existing weekly target rather than stacking duplicates
  if (goalType !== "exercise_milestone") {
    await pool.query("UPDATE goals SET is_active = false WHERE user_id = $1 AND goal_type = $2", [req.user.id, goalType]);
  }
  const { rows } = await pool.query(
    "INSERT INTO goals (id, user_id, goal_type, target_value, exercise_id, exercise_name_snapshot) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [uid(), req.user.id, goalType, targetValue, exerciseId || null, exerciseName]
  );
  res.status(201).json({ goal: serialize(rows[0]) });
});

router.delete("/:id", async (req, res) => {
  const { rows } = await pool.query("UPDATE goals SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id", [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "Goal not found." });
  res.json({ ok: true });
});

export default router;
