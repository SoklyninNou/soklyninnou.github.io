import { useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { CATEGORIES, SCHOOLS } from './coursesData.js';
import styles from './Courses.module.css';

export default function Courses() {
  useDocumentTitle('Soklynin Nou | Personal Website');
  const [hiddenCategories, setHiddenCategories] = useState(() => new Set());

  function toggleCategory(category) {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  return (
    <div className={styles.page}>
      <div className="title">Coursework</div>
      <div className="container">
        <div className={styles.list}>
          {SCHOOLS.map((school, schoolIndex) => (
            <div key={school.name}>
              {schoolIndex > 0 && <div className={styles.divider} />}
              <h1 className={styles.centeredLargeText}>{school.name}</h1>
              {school.semesters.map((semester) => (
                <div className={styles.row} key={semester.name}>
                  <div className={styles.semester}>{semester.name}</div>
                  {semester.courses.map((course, i) => (
                    <div
                      key={`${course.code}-${i}`}
                      className={`${styles.item} ${styles[course.category]}${
                        hiddenCategories.has(course.category) ? ` ${styles.hidden}` : ''
                      }`}
                      data-hover={course.hover}
                    >
                      {course.code}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className={styles.divider} />
        <h1 className={styles.centeredLargeText}>Filter</h1>
        <br />
        <div className={`${styles.row} ${styles.legend}`}>
          {CATEGORIES.map((category) => (
            <div
              key={category.key}
              className={`${styles.legendButton} ${styles[category.key]}${
                hiddenCategories.has(category.key) ? ` ${styles.off}` : ''
              }`}
              onClick={() => toggleCategory(category.key)}
            >
              {category.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
