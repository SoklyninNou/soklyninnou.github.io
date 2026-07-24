import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import styles from './Mambo.module.css';

export default function Mambo() {
  useDocumentTitle('Mambo');

  return (
    <div className={styles.page}>
      <video className={styles.video} controls autoPlay loop>
        <source src="/video-memes/mambo.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
