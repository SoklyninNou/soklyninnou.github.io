import { useState } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import styles from './ScreenSaver.module.css';

export default function ScreenSaver() {
  useDocumentTitle('Soklynin Nou | Personal Website');
  const [showVideo, setShowVideo] = useState(false);

  return (
    <div className={styles.page}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" />
      <div className={styles.container}>
        <h1
          className={styles.heading}
          contentEditable
          suppressContentEditableWarning
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        <div className={styles.hoverArea} />
        <button type="button" className={styles.toggleButton} onClick={() => setShowVideo((v) => !v)}>
          {showVideo ? 'Hide Video' : 'Show'}
        </button>
      </div>
      {showVideo && (
        <div className={styles.videoContainer}>
          <iframe
            width="320"
            height="180"
            src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=0&controls=1"
            title="YouTube video player"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
