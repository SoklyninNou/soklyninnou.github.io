import { PendingWorkout, SavedWorkout } from '@/types/workout';

const WORKOUTS_KEY = 'gym_workouts_v1';
const PENDING_KEY = 'gym_pending_v1';

function ok(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function getWorkouts(): SavedWorkout[] {
  if (!ok()) return [];
  try {
    const raw = localStorage.getItem(WORKOUTS_KEY);
    return raw ? (JSON.parse(raw) as SavedWorkout[]) : [];
  } catch {
    return [];
  }
}

export function saveWorkout(workout: SavedWorkout): void {
  if (!ok()) return;
  const list = getWorkouts();
  list.unshift(workout);
  localStorage.setItem(WORKOUTS_KEY, JSON.stringify(list));
}

export function deleteWorkout(id: string): void {
  if (!ok()) return;
  const list = getWorkouts().filter((w) => w.id !== id);
  localStorage.setItem(WORKOUTS_KEY, JSON.stringify(list));
}

export function getPendingWorkout(): PendingWorkout | null {
  if (!ok()) return null;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingWorkout) : null;
  } catch {
    return null;
  }
}

export function savePendingWorkout(workout: PendingWorkout): void {
  if (!ok()) return;
  localStorage.setItem(PENDING_KEY, JSON.stringify(workout));
}

export function clearPendingWorkout(): void {
  if (!ok()) return;
  localStorage.removeItem(PENDING_KEY);
}
