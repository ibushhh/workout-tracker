// Seeds the global (user_id IS NULL) rows every account sees by default:
// predefined cardio activities and the starter exercise library. Safe to
// re-run — skips anything already present rather than duplicating it.
import "dotenv/config";
import pool from "./src/db.js";
import { uid } from "./src/helpers.js";
import { DEFAULT_CARDIO_ACTIVITIES, STARTER_EXERCISES } from "./src/starterData.js";

async function seedCardioActivities() {
  const { rows: existing } = await pool.query("SELECT name FROM cardio_activities WHERE user_id IS NULL");
  const existingNames = new Set(existing.map((r) => r.name));
  for (const name of DEFAULT_CARDIO_ACTIVITIES) {
    if (existingNames.has(name)) continue;
    await pool.query("INSERT INTO cardio_activities (id, user_id, name, is_default, is_active) VALUES ($1, NULL, $2, true, true)", [uid(), name]);
    console.log(`  + cardio activity: ${name}`);
  }
}

async function seedExercises() {
  const { rows: existing } = await pool.query("SELECT name FROM exercises WHERE user_id IS NULL");
  const existingNames = new Set(existing.map((r) => r.name));
  for (const ex of STARTER_EXERCISES) {
    if (existingNames.has(ex.name)) continue;
    await pool.query(
      "INSERT INTO exercises (id, user_id, name, primary_muscle_group, category, equipment_type) VALUES ($1, NULL, $2, $3, $4, $5)",
      [uid(), ex.name, ex.primaryMuscleGroup, ex.category, ex.equipmentType]
    );
    console.log(`  + exercise: ${ex.name}`);
  }
}

async function main() {
  console.log("Seeding default cardio activities...");
  await seedCardioActivities();
  console.log("Seeding starter exercise library...");
  await seedExercises();
  console.log("Done.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
