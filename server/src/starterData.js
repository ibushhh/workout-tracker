export const MUSCLE_GROUPS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms", "Core / Abs",
  "Quadriceps", "Hamstrings", "Glutes", "Calves", "Full body", "Cardio",
];

export const EXERCISE_CATEGORIES = [
  "Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Kettlebell", "Resistance band", "Other",
];

export const DEFAULT_CARDIO_ACTIVITIES = [
  "Morning Walk", "Running", "Cycling / Bike", "Treadmill", "Stationary Bike", "Swimming",
];

export const STARTER_EXERCISES = [
  { name: "Barbell Bench Press", primaryMuscleGroup: "Chest", category: "Barbell", equipmentType: "Barbell" },
  { name: "Incline Dumbbell Press", primaryMuscleGroup: "Chest", category: "Dumbbell", equipmentType: "Dumbbell" },
  { name: "Lat Pulldown", primaryMuscleGroup: "Back", category: "Cable", equipmentType: "Cable machine" },
  { name: "Barbell Row", primaryMuscleGroup: "Back", category: "Barbell", equipmentType: "Barbell" },
  { name: "Seated Cable Row", primaryMuscleGroup: "Back", category: "Cable", equipmentType: "Cable machine" },
  { name: "Shoulder Press", primaryMuscleGroup: "Shoulders", category: "Dumbbell", equipmentType: "Dumbbell" },
  { name: "Lateral Raise", primaryMuscleGroup: "Shoulders", category: "Dumbbell", equipmentType: "Dumbbell" },
  { name: "Barbell Curl", primaryMuscleGroup: "Biceps", category: "Barbell", equipmentType: "Barbell" },
  { name: "Triceps Pushdown", primaryMuscleGroup: "Triceps", category: "Cable", equipmentType: "Cable machine" },
  { name: "Squat", primaryMuscleGroup: "Quadriceps", category: "Barbell", equipmentType: "Barbell" },
  { name: "Leg Press", primaryMuscleGroup: "Quadriceps", category: "Machine", equipmentType: "Machine" },
  { name: "Romanian Deadlift", primaryMuscleGroup: "Hamstrings", category: "Barbell", equipmentType: "Barbell" },
  { name: "Leg Curl", primaryMuscleGroup: "Hamstrings", category: "Machine", equipmentType: "Machine" },
  { name: "Calf Raise", primaryMuscleGroup: "Calves", category: "Machine", equipmentType: "Machine" },
  { name: "Plank", primaryMuscleGroup: "Core / Abs", category: "Bodyweight", equipmentType: "None" },
  { name: "Pull-up", primaryMuscleGroup: "Back", category: "Bodyweight", equipmentType: "Pull-up bar" },
  { name: "Push-up", primaryMuscleGroup: "Chest", category: "Bodyweight", equipmentType: "None" },
];
