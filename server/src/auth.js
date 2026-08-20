import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET env var is required");

export function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}
export function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

export function issueToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "90d" });
}

export function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    heightCm: row.height_cm != null ? Number(row.height_cm) : null,
    defaultWeightUnit: row.default_weight_unit,
    defaultDistanceUnit: row.default_distance_unit,
    fitnessGoal: row.fitness_goal,
    activityLevel: row.activity_level,
    targetWeightKg: row.target_weight_kg != null ? Number(row.target_weight_kg) : null,
    targetWeeklyWorkouts: row.target_weekly_workouts,
    targetDailyCalories: row.target_daily_calories,
    theme: row.theme,
    createdAt: row.created_at,
  };
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not signed in." });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Session expired, please sign in again." });
  }
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [payload.sub]);
  const row = rows[0];
  if (!row) return res.status(401).json({ error: "Account not found." });
  req.user = publicUser(row);
  req.userRow = row;
  next();
}
