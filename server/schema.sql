-- Workout Tracker — database schema.
--
-- Weight is always stored internally in kilograms and distance always in
-- kilometers, regardless of the unit the user entered or prefers to view —
-- every *_unit column just records what was typed/displayed so a value can
-- be redisplayed faithfully. All calculations (volume, 1RM, BMI, totals)
-- run on the internal kg/km values, then get converted for display.
--
-- Historical integrity: exercises and cardio activities can be renamed or
-- archived, but strength_exercises/cardio_sessions keep a *_snapshot of the
-- name (and muscle group, for exercises) taken at the time they were
-- logged, so past workout records never silently change.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  height_cm NUMERIC,
  default_weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (default_weight_unit IN ('kg', 'lb')),
  default_distance_unit TEXT NOT NULL DEFAULT 'km' CHECK (default_distance_unit IN ('km', 'mi')),
  fitness_goal TEXT,
  activity_level TEXT,
  target_weight_kg NUMERIC,
  target_weekly_workouts INTEGER,
  target_daily_calories INTEGER,
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per user per calendar date. day_type is user-controlled for the
-- "rest" state; when it's one of the workout states it's kept in sync with
-- whatever cardio/strength entries actually exist (see helpers.recomputeDailyLog).
CREATE TABLE IF NOT EXISTS daily_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_type TEXT NOT NULL DEFAULT 'rest' CHECK (day_type IN ('workout', 'cardio_only', 'strength_only', 'rest')),
  body_weight_kg NUMERIC,
  notes TEXT,
  -- Manual strength time/calories: strength sets don't carry duration or
  -- calorie fields of their own (the spec has no such field per-set), so a
  -- user who wants those counted in the day's totals enters them once here.
  manual_strength_duration_minutes NUMERIC,
  manual_strength_calories NUMERIC,
  sleep_rating SMALLINT CHECK (sleep_rating BETWEEN 1 AND 10),
  soreness_rating SMALLINT CHECK (soreness_rating BETWEEN 1 AND 10),
  energy_rating SMALLINT CHECK (energy_rating BETWEEN 1 AND 10),
  difficulty_rating SMALLINT CHECK (difficulty_rating BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs (user_id, date);

CREATE TABLE IF NOT EXISTS cardio_activities (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_cardio_activities_user ON cardio_activities (user_id);

CREATE TABLE IF NOT EXISTS cardio_sessions (
  id TEXT PRIMARY KEY,
  daily_log_id TEXT NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  cardio_activity_id TEXT REFERENCES cardio_activities(id) ON DELETE SET NULL,
  activity_name_snapshot TEXT NOT NULL,
  duration_minutes NUMERIC NOT NULL CHECK (duration_minutes > 0),
  calories_burned NUMERIC CHECK (calories_burned IS NULL OR calories_burned >= 0),
  average_heart_rate SMALLINT CHECK (average_heart_rate IS NULL OR average_heart_rate BETWEEN 20 AND 250),
  maximum_heart_rate SMALLINT CHECK (maximum_heart_rate IS NULL OR maximum_heart_rate BETWEEN 20 AND 250),
  pace_seconds_per_unit NUMERIC CHECK (pace_seconds_per_unit IS NULL OR pace_seconds_per_unit > 0),
  distance_km NUMERIC CHECK (distance_km IS NULL OR distance_km >= 0),
  distance_unit TEXT CHECK (distance_unit IS NULL OR distance_unit IN ('km', 'mi')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cardio_sessions_daily_log ON cardio_sessions (daily_log_id);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_muscle_group TEXT NOT NULL,
  secondary_muscle_groups TEXT[] NOT NULL DEFAULT '{}',
  category TEXT,
  equipment_type TEXT,
  notes TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exercises_user ON exercises (user_id);

CREATE TABLE IF NOT EXISTS strength_exercises (
  id TEXT PRIMARY KEY,
  daily_log_id TEXT NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name_snapshot TEXT NOT NULL,
  muscle_group_snapshot TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_strength_exercises_daily_log ON strength_exercises (daily_log_id);
CREATE INDEX IF NOT EXISTS idx_strength_exercises_exercise ON strength_exercises (exercise_id);

CREATE TABLE IF NOT EXISTS strength_sets (
  id TEXT PRIMARY KEY,
  strength_exercise_id TEXT NOT NULL REFERENCES strength_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL CHECK (reps > 0),
  weight_kg NUMERIC NOT NULL CHECK (weight_kg >= 0),
  weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb')),
  completed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_strength_sets_exercise ON strength_sets (strength_exercise_id);

CREATE TABLE IF NOT EXISTS body_measurements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  body_weight_kg NUMERIC NOT NULL CHECK (body_weight_kg > 0),
  waist_cm NUMERIC CHECK (waist_cm IS NULL OR waist_cm > 0),
  body_fat_percentage NUMERIC CHECK (body_fat_percentage IS NULL OR (body_fat_percentage >= 0 AND body_fat_percentage <= 100)),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_body_measurements_user_date ON body_measurements (user_id, date);

CREATE TABLE IF NOT EXISTS workout_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workout_templates_user ON workout_templates (user_id);

CREATE TABLE IF NOT EXISTS workout_template_exercises (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name_snapshot TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  target_sets INTEGER,
  target_reps INTEGER,
  target_weight_kg NUMERIC,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_workout_template_exercises_template ON workout_template_exercises (template_id);

-- Weekly goals (cardio minutes, workout count, strength volume, body
-- weight target) plus per-exercise milestones (e.g. "Bench Press to 100kg").
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('weekly_cardio_minutes', 'weekly_workouts', 'weekly_strength_volume', 'target_body_weight', 'exercise_milestone')),
  target_value NUMERIC NOT NULL,
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  exercise_name_snapshot TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);
