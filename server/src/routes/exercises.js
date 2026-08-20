import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../auth.js";
import { uid } from "../helpers.js";

const router = Router();
router.use(requireAuth);

function serialize(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    primaryMuscleGroup: row.primary_muscle_group,
    secondaryMuscleGroups: row.secondary_muscle_groups || [],
    category: row.category,
    equipmentType: row.equipment_type,
    notes: row.notes,
    isFavorite: row.is_favorite,
    isArchived: row.is_archived,
    isSystemDefault: row.user_id == null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Visible library = global starter exercises (user_id IS NULL) + the
// signed-in user's own custom exercises. See schema.sql's note on shared
// global rows for why editing a global exercise affects every account.
router.get("/", async (req, res) => {
  const { search, muscleGroup, category, favoritesOnly, includeArchived } = req.query;
  const conditions = ["(user_id IS NULL OR user_id = $1)"];
  const params = [req.user.id];
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`name ILIKE $${params.length}`);
  }
  if (muscleGroup) {
    params.push(muscleGroup);
    conditions.push(`primary_muscle_group = $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (favoritesOnly === "true") conditions.push("is_favorite = true");
  if (includeArchived !== "true") conditions.push("is_archived = false");
  const { rows } = await pool.query(
    `SELECT * FROM exercises WHERE ${conditions.join(" AND ")} ORDER BY is_favorite DESC, name ASC`,
    params
  );
  res.json({ exercises: rows.map(serialize) });
});

router.post("/", async (req, res) => {
  const { name, primaryMuscleGroup, secondaryMuscleGroups, category, equipmentType, notes } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Exercise name is required." });
  if (!primaryMuscleGroup) return res.status(400).json({ error: "Primary muscle group is required." });
  const id = uid();
  const { rows } = await pool.query(
    `INSERT INTO exercises (id, user_id, name, primary_muscle_group, secondary_muscle_groups, category, equipment_type, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [id, req.user.id, String(name).trim(), primaryMuscleGroup, secondaryMuscleGroups || [], category || null, equipmentType || null, notes || null]
  );
  res.status(201).json({ exercise: serialize(rows[0]) });
});

async function loadVisible(id, userId) {
  const { rows } = await pool.query("SELECT * FROM exercises WHERE id = $1 AND (user_id IS NULL OR user_id = $2)", [id, userId]);
  return rows[0];
}

router.patch("/:id", async (req, res) => {
  const existing = await loadVisible(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Exercise not found." });
  const { name, primaryMuscleGroup, secondaryMuscleGroups, category, equipmentType, notes, isFavorite, isArchived } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE exercises SET
       name = COALESCE($1, name),
       primary_muscle_group = COALESCE($2, primary_muscle_group),
       secondary_muscle_groups = COALESCE($3, secondary_muscle_groups),
       category = COALESCE($4, category),
       equipment_type = COALESCE($5, equipment_type),
       notes = COALESCE($6, notes),
       is_favorite = COALESCE($7, is_favorite),
       is_archived = COALESCE($8, is_archived),
       updated_at = now()
     WHERE id = $9 RETURNING *`,
    [name ?? null, primaryMuscleGroup ?? null, secondaryMuscleGroups ?? null, category ?? null, equipmentType ?? null, notes ?? null, isFavorite ?? null, isArchived ?? null, existing.id]
  );
  res.json({ exercise: serialize(rows[0]) });
});

// Hard delete is safe for historical integrity: strength_exercises.exercise_id
// is ON DELETE SET NULL, and the exercise_name_snapshot / muscle_group_snapshot
// already recorded on each past entry keep displaying correctly regardless.
router.delete("/:id", async (req, res) => {
  const existing = await loadVisible(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Exercise not found." });
  await pool.query("DELETE FROM exercises WHERE id = $1", [existing.id]);
  res.json({ ok: true });
});

export default router;
