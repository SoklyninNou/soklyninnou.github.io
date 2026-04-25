export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Legs'
  | 'Core';

export interface Exercise {
  name: string;
  muscleGroup: MuscleGroup;
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core',
];

export const EXERCISES: Exercise[] = [
  // Chest
  { name: 'Bench Press', muscleGroup: 'Chest' },
  { name: 'Incline Bench Press', muscleGroup: 'Chest' },
  { name: 'Decline Bench Press', muscleGroup: 'Chest' },
  { name: 'Dumbbell Fly', muscleGroup: 'Chest' },
  { name: 'Cable Fly', muscleGroup: 'Chest' },
  { name: 'Push-Up', muscleGroup: 'Chest' },
  { name: 'Chest Dip', muscleGroup: 'Chest' },
  { name: 'Pec Deck', muscleGroup: 'Chest' },

  // Back
  { name: 'Deadlift', muscleGroup: 'Back' },
  { name: 'Pull-Up', muscleGroup: 'Back' },
  { name: 'Lat Pulldown', muscleGroup: 'Back' },
  { name: 'Seated Cable Row', muscleGroup: 'Back' },
  { name: 'Bent-Over Row', muscleGroup: 'Back' },
  { name: 'T-Bar Row', muscleGroup: 'Back' },
  { name: 'Single-Arm Dumbbell Row', muscleGroup: 'Back' },
  { name: 'Face Pull', muscleGroup: 'Back' },
  { name: 'Chest-Supported Row', muscleGroup: 'Back' },

  // Shoulders
  { name: 'Overhead Press', muscleGroup: 'Shoulders' },
  { name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders' },
  { name: 'Lateral Raise', muscleGroup: 'Shoulders' },
  { name: 'Front Raise', muscleGroup: 'Shoulders' },
  { name: 'Rear Delt Fly', muscleGroup: 'Shoulders' },
  { name: 'Upright Row', muscleGroup: 'Shoulders' },
  { name: 'Arnold Press', muscleGroup: 'Shoulders' },
  { name: 'Cable Lateral Raise', muscleGroup: 'Shoulders' },

  // Biceps
  { name: 'Barbell Curl', muscleGroup: 'Biceps' },
  { name: 'Dumbbell Curl', muscleGroup: 'Biceps' },
  { name: 'Hammer Curl', muscleGroup: 'Biceps' },
  { name: 'Cable Curl', muscleGroup: 'Biceps' },
  { name: 'Preacher Curl', muscleGroup: 'Biceps' },
  { name: 'Incline Dumbbell Curl', muscleGroup: 'Biceps' },
  { name: 'Concentration Curl', muscleGroup: 'Biceps' },

  // Triceps
  { name: 'Tricep Pushdown', muscleGroup: 'Triceps' },
  { name: 'Skull Crusher', muscleGroup: 'Triceps' },
  { name: 'Overhead Tricep Extension', muscleGroup: 'Triceps' },
  { name: 'Close-Grip Bench Press', muscleGroup: 'Triceps' },
  { name: 'Tricep Dip', muscleGroup: 'Triceps' },
  { name: 'Diamond Push-Up', muscleGroup: 'Triceps' },
  { name: 'Rope Pushdown', muscleGroup: 'Triceps' },

  // Legs
  { name: 'Squat', muscleGroup: 'Legs' },
  { name: 'Leg Press', muscleGroup: 'Legs' },
  { name: 'Romanian Deadlift', muscleGroup: 'Legs' },
  { name: 'Leg Curl', muscleGroup: 'Legs' },
  { name: 'Leg Extension', muscleGroup: 'Legs' },
  { name: 'Calf Raise', muscleGroup: 'Legs' },
  { name: 'Lunge', muscleGroup: 'Legs' },
  { name: 'Hip Thrust', muscleGroup: 'Legs' },
  { name: 'Hack Squat', muscleGroup: 'Legs' },
  { name: 'Sumo Deadlift', muscleGroup: 'Legs' },
  { name: 'Bulgarian Split Squat', muscleGroup: 'Legs' },
  { name: 'Step-Up', muscleGroup: 'Legs' },

  // Core
  { name: 'Plank', muscleGroup: 'Core' },
  { name: 'Crunch', muscleGroup: 'Core' },
  { name: 'Leg Raise', muscleGroup: 'Core' },
  { name: 'Russian Twist', muscleGroup: 'Core' },
  { name: 'Cable Crunch', muscleGroup: 'Core' },
  { name: 'Ab Wheel', muscleGroup: 'Core' },
  { name: 'Bicycle Crunch', muscleGroup: 'Core' },
  { name: 'Hanging Knee Raise', muscleGroup: 'Core' },
  { name: 'Side Plank', muscleGroup: 'Core' },
];
