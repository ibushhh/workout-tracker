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
    isDefault: row.is_default,
    isActive: row.is_active,
  };
}

router.get("/", async (req, res) => {
  const { includeInactive } = req.query;
  const conditions = ["(user_id IS NULL OR user_id = $1)"];
  if (includeInactive !== "true") conditions.push("is_active = true");
  const { rows } = await pool.query(
    `SELECT * FROM cardio_activities WHERE ${conditions.join(" AND ")} ORDER BY is_default DESC, name ASC`,
    [req.user.id]
  );
  res.json({ cardioActivities: rows.map(serialize) });
});

router.post("/", async (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Activity name is required." });
  const id = uid();
  const { rows } = await pool.query(
    `INSERT INTO cardio_activities (id, user_id, name, is_default, is_active) VALUES ($1, $2, $3, false, true) RETURNING *`,
    [id, req.user.id, String(name).trim()]
  );
  res.status(201).json({ cardioActivity: serialize(rows[0]) });
});

async function loadVisible(id, userId) {
  const { rows } = await pool.query("SELECT * FROM cardio_activities WHERE id = $1 AND (user_id IS NULL OR user_id = $2)", [id, userId]);
  return rows[0];
}

router.patch("/:id", async (req, res) => {
  const existing = await loadVisible(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Cardio activity not found." });
  const { name, isActive } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE cardio_activities SET name = COALESCE($1, name), is_active = COALESCE($2, is_active) WHERE id = $3 RETURNING *`,
    [name ?? null, isActive ?? null, existing.id]
  );
  res.json({ cardioActivity: serialize(rows[0]) });
});

router.delete("/:id", async (req, res) => {
  const existing = await loadVisible(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Cardio activity not found." });
  if (existing.is_default) return res.status(400).json({ error: "Predefined activities can be deactivated but not deleted." });
  await pool.query("DELETE FROM cardio_activities WHERE id = $1", [existing.id]);
  res.json({ ok: true });
});

export default router;
