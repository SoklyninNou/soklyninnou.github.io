import JobEntry from '../../components/JobEntry.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { JOBS } from './experienceData.js';
import styles from './Experience.module.css';

export default function Experience() {
  useDocumentTitle('Soklynin Nou | Personal Website');

  return (
    <div className={styles.container}>
      {JOBS.map((job) => (
        <JobEntry
          key={job.title}
          title={job.title}
          titleClassName={styles.jobTitle}
          periods={job.periods}
          className={styles.job}
        />
      ))}
    </div>
  );
}
