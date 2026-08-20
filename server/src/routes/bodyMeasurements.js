import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../auth.js";
import { uid, isValidDate } from "../helpers.js";
import { weightToKg, inToCm } from "../calc.js";

const router = Router();
router.use(requireAuth);

function serialize(row) {
  return {
    id: row.id,
    date: row.date,
    bodyWeightKg: Number(row.body_weight_kg),
    waistCm: row.waist_cm != null ? Number(row.waist_cm) : null,
    bodyFatPercentage: row.body_fat_percentage != null ? Number(row.body_fat_percentage) : null,
    notes: row.notes,
  };
}

router.get("/", async (req, res) => {
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
  const { rows } = await pool.query(`SELECT * FROM body_measurements WHERE ${conditions.join(" AND ")} ORDER BY date ASC`, params);
  res.json({ measurements: rows.map(serialize) });
});

router.post("/", async (req, res) => {
  const { date, bodyWeight, weightUnit, waist, waistUnit, bodyFatPercentage, notes } = req.body || {};
  if (!isValidDate(date)) return res.status(400).json({ error: "A valid date (YYYY-MM-DD) is required." });
  if (!bodyWeight || bodyWeight <= 0) return res.status(400).json({ error: "Body weight must be greater than zero." });
  if (bodyFatPercentage != null && (bodyFatPercentage < 0 || bodyFatPercentage > 100)) return res.status(400).json({ error: "Body fat percentage must be between 0 and 100." });
  if (waist != null && waist <= 0) return res.status(400).json({ error: "Waist measurement must be greater than zero." });

  const bodyWeightKg = weightToKg(bodyWeight, weightUnit || req.user.defaultWeightUnit);
  const waistCm = waist != null ? (waistUnit === "in" ? inToCm(waist) : waist) : null;

  const { rows } = await pool.query(
    `INSERT INTO body_measurements (id, user_id, date, body_weight_kg, waist_cm, body_fat_percentage, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id, date) DO UPDATE SET
       body_weight_kg = EXCLUDED.body_weight_kg,
       waist_cm = COALESCE(EXCLUDED.waist_cm, body_measurements.waist_cm),
       body_fat_percentage = COALESCE(EXCLUDED.body_fat_percentage, body_measurements.body_fat_percentage),
       notes = COALESCE(EXCLUDED.notes, body_measurements.notes),
       updated_at = now()
     RETURNING *`,
    [uid(), req.user.id, date, bodyWeightKg, waistCm, bodyFatPercentage ?? null, notes || null]
  );
  await pool.query(
    `UPDATE daily_logs SET body_weight_kg = $1 WHERE user_id = $2 AND date = $3`,
    [bodyWeightKg, req.user.id, date]
  );
  res.status(201).json({ measurement: serialize(rows[0]) });
});

router.patch("/:id", async (req, res) => {
  const { rows: existingRows } = await pool.query("SELECT * FROM body_measurements WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Measurement not found." });
  const { bodyWeight, weightUnit, waist, waistUnit, bodyFatPercentage, notes } = req.body || {};
  if (bodyFatPercentage != null && (bodyFatPercentage < 0 || bodyFatPercentage > 100)) return res.status(400).json({ error: "Body fat percentage must be between 0 and 100." });
  const bodyWeightKg = bodyWeight != null ? weightToKg(bodyWeight, weightUnit || req.user.defaultWeightUnit) : undefined;
  const waistCm = waist != null ? (waistUnit === "in" ? inToCm(waist) : waist) : undefined;
  const { rows } = await pool.query(
    `UPDATE body_measurements SET
       body_weight_kg = COALESCE($1, body_weight_kg),
       waist_cm = COALESCE($2, waist_cm),
       body_fat_percentage = COALESCE($3, body_fat_percentage),
       notes = COALESCE($4, notes),
       updated_at = now()
     WHERE id = $5 RETURNING *`,
    [bodyWeightKg ?? null, waistCm ?? null, bodyFatPercentage ?? null, notes ?? null, existing.id]
  );
  res.json({ measurement: serialize(rows[0]) });
});

router.delete("/:id", async (req, res) => {
  const { rows } = await pool.query("DELETE FROM body_measurements WHERE id = $1 AND user_id = $2 RETURNING id", [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "Measurement not found." });
  res.json({ ok: true });
});

export default router;
