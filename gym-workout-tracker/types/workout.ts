export interface PendingSet {
  reps: string;
  weight: string;
  completed: boolean;
}

export interface PendingExercise {
  uid: string;
  name: string;
  muscleGroup: string;
  sets: PendingSet[];
}

export interface PendingWorkout {
  startedAt: string;
  exercises: PendingExercise[];
}

export interface SavedSet {
  reps: number;
  weight: number;
}

export interface SavedExercise {
  name: string;
  muscleGroup: string;
  sets: SavedSet[];
}

export interface SavedWorkout {
  id: string;
  date: string;
  durationMinutes: number;
  exercises: SavedExercise[];
}
