import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { PAPERS } from './researchData.js';
import styles from './Research.module.css';

export default function Research() {
  useDocumentTitle('Soklynin Nou | Personal Website');

  return (
    <div className={styles.container}>
      {PAPERS.map((paper) => (
        <div className={styles.paper} key={paper.title}>
          <div className={styles.paperTitle}>{paper.title}</div>
          <p style={{ textDecoration: 'underline', lineHeight: '100%' }}>Abstract</p>
          <p style={{ textIndent: '5%' }}>{paper.abstract}</p>
          <p>
            <a className={styles.readPaper} href={paper.paperUrl} target="_blank" rel="noreferrer">
              Read full paper ↗
            </a>
            {paper.dataUrl && (
              <>
                {' '}
                <a className={styles.dataLink} href={paper.dataUrl} target="_blank" rel="noreferrer">
                  (Data)
                </a>
              </>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
