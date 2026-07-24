import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import styles from './GymTracker.module.css';

export default function GymTracker() {
  useDocumentTitle('Soklynin Nou | Gym Workout Tracker');

  return <iframe className={styles.trackerFrame} src="/gym-workout-tracker/dist/" title="Gym Workout Tracker" />;
}
