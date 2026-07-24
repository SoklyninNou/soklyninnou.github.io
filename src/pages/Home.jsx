import { Link } from 'react-router-dom';
import JobEntry from '../components/JobEntry.jsx';
import PdfEmbed from '../components/PdfEmbed.jsx';
import SpotifyEmbed from '../components/SpotifyEmbed.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import styles from './Home.module.css';

const SPOTIFY_TRACK_IDS = [
  '4oE7MyJhqSD3BaHRpNs8Nl',
  '6Ec5LeRzkisa5KJtwLfOoW',
  '3DwQ7AH3xGD9h65ezslm6q',
  '2D4dV2KXDTszzJ3p3cFqhA',
];

const EXPERIENCE_PREVIEW = [
  {
    title: 'Course Staff',
    periods: [{ dateRange: 'June 2025 - Present', bullets: ['Computer Security'] }],
  },
  {
    title: 'Embedded TA',
    periods: [
      { dateRange: 'January 2024 - May 2024', bullets: ['Discrete Mathematic', 'Calculus 3'] },
      { dateRange: 'August 2023 - December 2023', bullets: ['Calculus 1', 'Trigonometry'] },
    ],
  },
  {
    title: 'Peer Tutor',
    periods: [
      {
        dateRange: 'June 2022 - May 2024',
        bullets: [
          'Differential Equations',
          'Linear Algebra',
          'Discrete Mathematic',
          'Calculus 3',
          'Calculus 2',
          'Calculus 1',
        ],
      },
    ],
  },
  {
    title: 'Academic Assistant',
    periods: [{ dateRange: 'January 2022 - December 2022', bullets: ['Logistics', 'Administration'] }],
  },
];

const COOL_THINGS = [
  { type: 'youtube', videoId: '3ytqnteXfjw' },
  { type: 'image', src: '/pictures/IMG_4744.JPG', alt: '' },
  { type: 'image', src: '/pictures/sadge-dota2.png', alt: '', caption: 'I lost this game btw' },
  { type: 'image', src: '/pictures/big-sadge.jpeg', alt: '', caption: 'This one too' },
];

const NOTES = [
  { title: 'CS 188: Introduction to Artificial Intelligence', src: '/notes/cs188_notes.pdf' },
  { title: 'EECS 127: Optimization Models in Engineering', src: '/notes/eecs127_notes.pdf' },
];

export default function Home() {
  useDocumentTitle('Soklynin Nou');

  return (
    <div className={styles.content}>
      <div className="title">About Me</div>
      <div className={styles.grid}>
        <div className={styles.songs}>
          {SPOTIFY_TRACK_IDS.map((trackId) => (
            <SpotifyEmbed key={trackId} trackId={trackId} />
          ))}
        </div>
        <div className={styles.context}>
          <p>
            Hi, I&apos;m Lynin. I&apos;m an undergraduate student studying <strong>Computer Science</strong> at
            the <strong>UC Berkeley</strong>. I am currently working on my personal project of developing an{' '}
            <strong>AI Agent</strong> that would assist me in various tasks.
          </p>
          <p>
            I&apos;m interested in AI, algorithms, and machine learning models. But, I am also learning to
            build the front-end interfaces and application logic of my projects.
          </p>
          <p>
            When I am not working on a project, I am repetitively lifting heavy metal objects, building
            things in Minecraft, losing brain cells in Dota 2, and experimenting with novel things.
          </p>
          <p>
            Feel free to explore my personal website and if you have any thoughts, you could email me:{' '}
            <strong>sly.nou [at] berkeley.edu</strong>
          </p>
        </div>
      </div>

      <div className="title">Experience</div>
      <div className="container">
        {EXPERIENCE_PREVIEW.map((job) => (
          <JobEntry
            key={job.title}
            title={job.title}
            titleClassName={styles.containerTitle}
            periods={job.periods}
            className={styles.job}
          />
        ))}
        <Link className="button" to="/experience">
          More
        </Link>
      </div>

      <div className="title">Cool things</div>
      <div className={`container ${styles.centeredItems}`}>
        {COOL_THINGS.map((item, index) => (
          <div key={index} className={styles.centeredItems}>
            {item.caption && <div className={styles.containerTitle}>{item.caption}</div>}
            {item.type === 'youtube' ? (
              <iframe
                className={styles.videoIframe}
                src={`https://www.youtube.com/embed/${item.videoId}?si=d6d8bZy97dXKAbni`}
                title="YouTube video player"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <img src={item.src} alt={item.alt} />
            )}
            <div className="divider" />
          </div>
        ))}
      </div>

      <div className="title">Notes</div>
      <div className="container">
        {NOTES.map((note) => (
          <div key={note.src} className={styles.noteBlock}>
            <div className={styles.containerTitle}>{note.title}</div>
            <PdfEmbed src={note.src} title={note.title} />
            <div className="divider" />
          </div>
        ))}
      </div>
    </div>
  );
}
