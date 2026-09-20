import { useCallback, useEffect, useRef, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { decryptPayload, loadEnvelope } from './unlock.js';
import Game from './Game.jsx';
import { LockIcon } from './icons.jsx';
import styles from './BSide.module.css';

const SESSION_KEY = 'bside:key';

/**
 * Unlisted route. It is deliberately absent from the site nav and from any
 * sitemap; the only way in is the URL plus the password.
 */
export default function BSide() {
  useDocumentTitle('B-Side');

  const [payload, setPayload] = useState(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle | working | error
  const [message, setMessage] = useState('');
  const [shake, setShake] = useState(0);
  const inputRef = useRef(null);

  // Keep it out of search results even if the URL leaks.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow, noarchive, nosnippet';
    document.head.appendChild(meta);
    document.documentElement.dataset.bside = 'on';
    return () => {
      meta.remove();
      delete document.documentElement.dataset.bside;
    };
  }, []);

  const attempt = useCallback(async (candidate, { silent = false } = {}) => {
    setStatus('working');
    setMessage('');
    try {
      const envelope = await loadEnvelope();
      const data = await decryptPayload(envelope, candidate);
      try {
        sessionStorage.setItem(SESSION_KEY, candidate);
      } catch {
        /* private browsing — unlocking just won't survive a refresh */
      }
      setPayload(data);
      setStatus('idle');
      return true;
    } catch (err) {
      const reason = String(err?.message ?? err);
      if (reason.startsWith('missing-payload')) {
        setMessage('The song list has not been built yet. Run `npm run sync:bside`.');
      } else if (reason === 'insecure-context') {
        setMessage('This page needs a secure (https) connection to decrypt.');
      } else if (!silent) {
        setMessage('Incorrect password.');
        setShake((n) => n + 1);
      }
      setStatus(silent ? 'idle' : 'error');
      setPassword('');
      return false;
    }
  }, []);

  // Unlock once per tab, not once per refresh.
  useEffect(() => {
    let remembered = null;
    try {
      remembered = sessionStorage.getItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    if (remembered) attempt(remembered, { silent: true });
  }, [attempt]);

  useEffect(() => {
    if (!payload) inputRef.current?.focus();
  }, [payload]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!password || status === 'working') return;
    attempt(password);
  }

  if (payload) return <Game data={payload} />;

  return (
    <div className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <main className={styles.gate}>
        <form
          key={shake}
          className={`${styles.gateCard} ${status === 'error' ? styles.shake : ''}`}
          onSubmit={handleSubmit}
        >
          <div className={styles.gateGlyph}>
            <LockIcon width={26} height={26} />
          </div>
          <h1 className={styles.gateTitle}>B-Side</h1>
          <p className={styles.gateBody}>This one&rsquo;s private. Enter the password to play.</p>

          <input
            ref={inputRef}
            className={styles.gateInput}
            type="password"
            inputMode="text"
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (status === 'error') setStatus('idle');
            }}
          />

          <button className={styles.gateButton} type="submit" disabled={!password || status === 'working'}>
            {status === 'working' ? 'Unlocking…' : 'Unlock'}
          </button>

          <p className={`${styles.gateNote} ${message ? styles.gateNoteShown : ''}`} role="status">
            {message || ' '}
          </p>
        </form>
      </main>
    </div>
  );
}
