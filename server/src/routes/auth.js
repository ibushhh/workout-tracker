import { Router } from "express";
import pool from "../db.js";
import { hashPassword, verifyPassword, issueToken, publicUser, requireAuth } from "../auth.js";
import { uid } from "../helpers.js";
import { weightToKg, inToCm } from "../calc.js";

const router = Router();

function validEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Name is required." });
  if (!validEmail(email)) return res.status(400).json({ error: "A valid email is required." });
  if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

  const normalizedEmail = String(email).toLowerCase().trim();
  const { rows: existing } = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing[0]) return res.status(409).json({ error: "An account with that email already exists." });

  const id = uid();
  const passwordHash = await hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO users (id, name, email, password_hash) VALUES ($1,$2,$3,$4) RETURNING *`,
    [id, String(name).trim(), normalizedEmail, passwordHash]
  );

  // Starter exercises and predefined cardio activities are seeded once as
  // shared global rows (user_id IS NULL, see seed.js) — every account sees
  // them automatically, nothing to copy per-user here.
  const user = publicUser(rows[0]);
  res.status(201).json({ token: issueToken(user), user });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [String(email).toLowerCase().trim()]);
  const row = rows[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  const user = publicUser(row);
  res.json({ token: issueToken(user), user });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.patch("/me", requireAuth, async (req, res) => {
  const {
    name, dateOfBirth, gender, height, heightUnit, defaultWeightUnit, defaultDistanceUnit,
    fitnessGoal, activityLevel, targetWeight, targetWeeklyWorkouts, targetDailyCalories, theme,
  } = req.body || {};

  if (defaultWeightUnit && !["kg", "lb"].includes(defaultWeightUnit)) return res.status(400).json({ error: "Invalid weight unit." });
  if (defaultDistanceUnit && !["km", "mi"].includes(defaultDistanceUnit)) return res.status(400).json({ error: "Invalid distance unit." });
  if (theme && !["light", "dark", "system"].includes(theme)) return res.status(400).json({ error: "Invalid theme." });
  if (targetWeeklyWorkouts != null && targetWeeklyWorkouts < 0) return res.status(400).json({ error: "Target weekly workouts cannot be negative." });
  if (targetDailyCalories != null && targetDailyCalories < 0) return res.status(400).json({ error: "Target daily calories cannot be negative." });

  const heightCm = height != null ? (heightUnit === "in" ? inToCm(height) : height) : undefined;
  const targetWeightKg = targetWeight != null ? weightToKg(targetWeight, defaultWeightUnit || req.user.defaultWeightUnit) : undefined;

  const { rows } = await pool.query(
    `UPDATE users SET
       name = COALESCE($1, name),
       date_of_birth = COALESCE($2, date_of_birth),
       gender = COALESCE($3, gender),
       height_cm = COALESCE($4, height_cm),
       default_weight_unit = COALESCE($5, default_weight_unit),
       default_distance_unit = COALESCE($6, default_distance_unit),
       fitness_goal = COALESCE($7, fitness_goal),
       activity_level = COALESCE($8, activity_level),
       target_weight_kg = COALESCE($9, target_weight_kg),
       target_weekly_workouts = COALESCE($10, target_weekly_workouts),
       target_daily_calories = COALESCE($11, target_daily_calories),
       theme = COALESCE($12, theme),
       updated_at = now()
     WHERE id = $13 RETURNING *`,
    [
      name ?? null, dateOfBirth ?? null, gender ?? null, heightCm ?? null, defaultWeightUnit ?? null, defaultDistanceUnit ?? null,
      fitnessGoal ?? null, activityLevel ?? null, targetWeightKg ?? null, targetWeeklyWorkouts ?? null, targetDailyCalories ?? null, theme ?? null,
      req.user.id,
    ]
  );
  res.json({ user: publicUser(rows[0]) });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters." });
  if (!(await verifyPassword(currentPassword || "", req.userRow.password_hash))) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  const passwordHash = await hashPassword(newPassword);
  await pool.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [passwordHash, req.user.id]);
  res.json({ ok: true });
});

export default router;
