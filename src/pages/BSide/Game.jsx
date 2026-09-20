import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, PauseIcon, PlayIcon, SearchIcon, ShareIcon, ShuffleIcon, SkipIcon, XIcon } from './icons.jsx';
import styles from './BSide.module.css';

/** Seconds of audio unlocked at each attempt, the Heardle ladder. */
const LADDER = [1, 2, 4, 7, 11, 16];
const MAX_ATTEMPTS = LADDER.length;
const FULL_CLIP = 30;
const STATS_KEY = 'bside:stats';

// ------------------------------------------------------------------ helpers

function todayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** FNV-1a — small, stable, and enough to turn a date into a track index. */
function hash32(value) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage disabled — the game still plays, it just won't remember */
  }
}

function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `0:${String(whole).padStart(2, '0')}`;
}

function trackLabel(track) {
  return `${track.artists.join(', ')} — ${track.title}`;
}

function searchable(track) {
  return `${track.title} ${track.artists.join(' ')} ${track.album}`.toLowerCase();
}

/**
 * Averages the album art into one colour, weighted toward saturated mid-tone
 * pixels so the ambient glow picks up the cover's actual hue rather than its
 * background. Needs a CORS-clean image; callers fall back silently.
 */
function artworkColor(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error('load'));
    img.onload = () => {
      try {
        const size = 28;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let r = 0;
        let g = 0;
        let b = 0;
        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
          const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]];
          const max = Math.max(pr, pg, pb);
          const min = Math.min(pr, pg, pb);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const brightness = max / 255;
          const weight = 0.08 + saturation * (1 - Math.abs(brightness - 0.62));
          r += pr * weight;
          g += pg * weight;
          b += pb * weight;
          total += weight;
        }
        if (!total) throw new Error('empty');
        resolve([r / total, g / total, b / total].map((v) => Math.round(Math.min(255, v))));
      } catch (err) {
        reject(err);
      }
    };
    img.src = url;
  });
}

// --------------------------------------------------------------------- view

export default function Game({ data }) {
  const tracks = data.tracks ?? [];
  const playable = useMemo(() => tracks.filter((t) => t.preview), [tracks]);
  const playlistId = data.playlist?.id ?? 'b-side';

  const [mode, setMode] = useState('daily');
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [highlight, setHighlight] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [glow, setGlow] = useState(null);
  const [toast, setToast] = useState('');
  const [stats, setStats] = useState(() =>
    readJson(STATS_KEY, { played: 0, won: 0, streak: 0, best: 0, lastDaily: null }),
  );

  const audioRef = useRef(null);
  const rafRef = useRef(0);
  const inputRef = useRef(null);
  const toastTimer = useRef(null);

  const dayKey = todayKey();
  const dailyStorageKey = `bside:round:${playlistId}:${dayKey}`;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const answer = useMemo(() => {
    if (!playable.length) return null;
    if (mode === 'daily') return playable[hash32(`${playlistId}:${dayKey}`) % playable.length];
    return playable[hash32(`${playlistId}:shuffle:${shuffleSeed}`) % playable.length];
  }, [playable, mode, playlistId, dayKey, shuffleSeed]);

  const attemptsUsed = guesses.length;
  const won = guesses.some((g) => g.kind === 'correct');
  const lost = !won && attemptsUsed >= MAX_ATTEMPTS;
  const finished = won || lost;
  const unlocked = finished ? FULL_CLIP : LADDER[Math.min(attemptsUsed, MAX_ATTEMPTS - 1)];
  const barMax = finished ? FULL_CLIP : LADDER[MAX_ATTEMPTS - 1];

  // ------------------------------------------------------------- round setup

  // Today's daily round is restored so a refresh doesn't hand out a second try.
  // Keyed on the date alone: switching modes is handled explicitly below, and
  // this should not fire when the player flips to shuffle and back.
  useEffect(() => {
    if (modeRef.current !== 'daily') return;
    const saved = readJson(dailyStorageKey, null);
    setGuesses(Array.isArray(saved?.guesses) ? saved.guesses : []);
  }, [dailyStorageKey]);

  const startShuffle = useCallback(() => {
    setMode('shuffle');
    setGuesses([]);
    setShuffleSeed((n) => n + 1);
  }, []);

  const startDaily = useCallback(() => {
    setMode('daily');
    const saved = readJson(dailyStorageKey, null);
    setGuesses(Array.isArray(saved?.guesses) ? saved.guesses : []);
  }, [dailyStorageKey]);

  useEffect(() => {
    if (mode === 'daily') writeJson(dailyStorageKey, { guesses });
  }, [mode, dailyStorageKey, guesses]);

  useEffect(() => {
    setQuery('');
    setSelected(null);
    setHighlight(0);
    setAudioError(false);
    setGlow(null);
    setElapsed(0);
    setIsPlaying(false);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [answer?.id]);

  // ---------------------------------------------------------------- playback

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    cancelAnimationFrame(rafRef.current);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setElapsed(0);
  }, []);

  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.currentTime >= unlocked - 0.02) {
      stopPlayback();
      return;
    }
    setElapsed(audio.currentTime);
    rafRef.current = requestAnimationFrame(tick);
  }, [unlocked, stopPlayback]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !answer) return;
    if (isPlaying) {
      stopPlayback();
      return;
    }
    audio.currentTime = 0;
    setElapsed(0);
    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        setAudioError(false);
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => setAudioError(true));
  }, [answer, isPlaying, stopPlayback, tick]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Space plays, as long as you are not typing a guess.
  useEffect(() => {
    function onKey(event) {
      if (event.code !== 'Space') return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      event.preventDefault();
      togglePlay();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay]);

  // ------------------------------------------------------------- the reveal

  useEffect(() => {
    if (!finished || !answer?.art) return;
    let cancelled = false;
    artworkColor(answer.art)
      .then((rgb) => !cancelled && setGlow(rgb))
      .catch(() => {
        /* cross-origin artwork — the default gradient stays */
      });
    return () => {
      cancelled = true;
    };
  }, [finished, answer?.art]);

  // Stats land once per finished round, and the daily round only counts once.
  const scoredRef = useRef(null);
  useEffect(() => {
    if (!finished || !answer) return;
    const roundId = mode === 'daily' ? `daily:${dayKey}` : `shuffle:${shuffleSeed}`;
    if (scoredRef.current === roundId) return;
    if (mode === 'daily' && stats.lastDaily === dayKey) {
      scoredRef.current = roundId;
      return;
    }
    scoredRef.current = roundId;

    setStats((prev) => {
      const next = {
        played: prev.played + 1,
        won: prev.won + (won ? 1 : 0),
        streak: won ? prev.streak + 1 : 0,
        best: Math.max(prev.best, won ? prev.streak + 1 : 0),
        lastDaily: mode === 'daily' ? dayKey : prev.lastDaily,
      };
      writeJson(STATS_KEY, next);
      return next;
    });
  }, [finished, won, answer, mode, dayKey, shuffleSeed, stats.lastDaily]);

  // ---------------------------------------------------------------- guessing

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || selected) return [];
    return tracks.filter((t) => searchable(t).includes(q)).slice(0, 7);
  }, [query, selected, tracks]);

  function choose(track) {
    setSelected(track);
    setQuery(trackLabel(track));
    setHighlight(0);
  }

  function clearGuess() {
    setSelected(null);
    setQuery('');
    setHighlight(0);
    inputRef.current?.focus();
  }

  function pushGuess(entry) {
    stopPlayback();
    setGuesses((prev) => [...prev, entry]);
    clearGuess();
  }

  function submitGuess() {
    if (!selected || finished) return;
    const correct = selected.id === answer?.id;
    pushGuess({ kind: correct ? 'correct' : 'wrong', label: trackLabel(selected) });
  }

  function skip() {
    if (finished) return;
    const next = LADDER[Math.min(attemptsUsed + 1, MAX_ATTEMPTS - 1)] - LADDER[attemptsUsed];
    pushGuess({ kind: 'skip', label: attemptsUsed + 1 >= MAX_ATTEMPTS ? 'Skipped' : `Skipped · +${next}s` });
  }

  function onSearchKeyDown(event) {
    if (event.key === 'ArrowDown' && matches.length) {
      event.preventDefault();
      setHighlight((h) => (h + 1) % matches.length);
    } else if (event.key === 'ArrowUp' && matches.length) {
      event.preventDefault();
      setHighlight((h) => (h - 1 + matches.length) % matches.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (matches.length) choose(matches[highlight]);
      else if (selected) submitGuess();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      clearGuess();
    }
  }

  // ------------------------------------------------------------------ share

  function showToast(text) {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(''), 1600);
  }

  async function share() {
    const squares = Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
      const g = guesses[i];
      if (!g) return '⬛';
      if (g.kind === 'correct') return '🟩';
      if (g.kind === 'wrong') return '🟥';
      return '⬜';
    }).join('');

    const heading = mode === 'daily' ? `B-Side · ${dayKey}` : 'B-Side · shuffle';
    const score = won ? `${guesses.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
    try {
      await navigator.clipboard.writeText(`${heading}\n${squares} ${score}`);
      showToast('Copied result');
    } catch {
      showToast('Could not copy');
    }
  }

  // ----------------------------------------------------------------- render

  if (!answer) {
    return (
      <div className={styles.page}>
        <div className={styles.ambient} aria-hidden="true" />
        <main className={styles.empty}>
          <h1 className={styles.gateTitle}>Nothing to play</h1>
          <p className={styles.gateBody}>
            No track in this playlist has a usable audio preview. Re-run <code>npm run sync:bside</code> after adding
            songs with wider availability.
          </p>
        </main>
      </div>
    );
  }

  const glowStyle = glow
    ? {
        '--glow-a': `rgba(${glow[0]}, ${glow[1]}, ${glow[2]}, 0.42)`,
        '--glow-b': `rgba(${glow[0]}, ${glow[1]}, ${glow[2]}, 0.10)`,
      }
    : undefined;

  return (
    <div className={`${styles.page} ${finished ? styles.pageRevealed : ''}`} style={glowStyle}>
      <div className={styles.ambient} aria-hidden="true" />

      <audio
        ref={audioRef}
        src={answer.preview}
        preload="auto"
        onEnded={stopPlayback}
        onError={() => setAudioError(true)}
      />

      <main className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>B-Side</p>
          <h1 className={styles.title}>{data.playlist?.name || 'Name that track'}</h1>

          <div className={styles.segmented} role="tablist" aria-label="Game mode">
            <span className={`${styles.segmentedThumb} ${mode === 'shuffle' ? styles.segmentedThumbRight : ''}`} />
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'daily'}
              className={styles.segment}
              onClick={startDaily}
            >
              Daily
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'shuffle'}
              className={styles.segment}
              onClick={startShuffle}
            >
              Shuffle
            </button>
          </div>
        </header>

        {finished ? (
          <section className={styles.reveal}>
            <div className={styles.artWrap}>
              {answer.art ? (
                <img className={styles.art} src={answer.art} alt="" />
              ) : (
                <div className={`${styles.art} ${styles.artFallback}`} aria-hidden="true" />
              )}
            </div>
            <p className={`${styles.verdict} ${won ? styles.verdictWon : styles.verdictLost}`}>
              {won ? `Got it in ${guesses.length}` : 'Out of guesses'}
            </p>
            <h2 className={styles.revealTitle}>{answer.title}</h2>
            <p className={styles.revealArtist}>{answer.artists.join(', ')}</p>
            <p className={styles.revealAlbum}>
              {answer.album}
              {answer.year ? ` · ${answer.year}` : ''}
            </p>
          </section>
        ) : (
          <ol className={styles.guessList}>
            {Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
              const guess = guesses[i];
              const active = i === guesses.length;
              return (
                <li key={i} className={`${styles.guessRow} ${active ? styles.guessRowActive : ''}`}>
                  <span className={`${styles.guessGlyph} ${guess ? styles[`glyph_${guess.kind}`] : ''}`}>
                    {guess?.kind === 'correct' && <CheckIcon width={15} height={15} />}
                    {guess?.kind === 'wrong' && <XIcon width={15} height={15} />}
                    {guess?.kind === 'skip' && <SkipIcon width={15} height={15} />}
                  </span>
                  <span className={`${styles.guessText} ${guess ? '' : styles.guessTextEmpty}`}>
                    {guess ? guess.label : `${LADDER[i]}s`}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <section className={styles.player}>
          <div className={styles.trackRow}>
            <span className={styles.time}>{formatTime(elapsed)}</span>
            <div className={styles.track}>
              <span className={styles.trackUnlocked} style={{ width: `${Math.min(100, (unlocked / barMax) * 100)}%` }} />
              <span className={styles.trackFill} style={{ width: `${Math.min(100, (elapsed / barMax) * 100)}%` }} />
              {!finished &&
                LADDER.slice(0, -1).map((mark) => (
                  <span key={mark} className={styles.tick} style={{ left: `${(mark / barMax) * 100}%` }} />
                ))}
            </div>
            <span className={styles.time}>{formatTime(barMax)}</span>
          </div>

          <button
            type="button"
            className={styles.playButton}
            onClick={togglePlay}
            aria-label={isPlaying ? 'Stop' : `Play ${unlocked} seconds`}
          >
            {isPlaying ? <PauseIcon width={28} height={28} /> : <PlayIcon width={28} height={28} />}
          </button>

          {audioError && <p className={styles.audioError}>That preview wouldn&rsquo;t load. Try skipping this one.</p>}
        </section>

        {finished ? (
          <section className={styles.actions}>
            {answer.url && (
              <a className={styles.buttonPrimary} href={answer.url} target="_blank" rel="noreferrer">
                Open in Spotify
              </a>
            )}
            <div className={styles.actionRow}>
              <button type="button" className={styles.buttonSecondary} onClick={share}>
                <ShareIcon width={18} height={18} />
                Share
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={startShuffle}
              >
                <ShuffleIcon width={18} height={18} />
                Another
              </button>
            </div>
          </section>
        ) : (
          <section className={styles.actions}>
            <div className={styles.searchWrap}>
              <span className={styles.searchGlyph}>
                <SearchIcon width={17} height={17} />
              </span>
              <input
                ref={inputRef}
                className={styles.search}
                type="text"
                placeholder="Know it? Start typing…"
                aria-label="Guess the song"
                autoComplete="off"
                spellCheck="false"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected(null);
                  setHighlight(0);
                }}
                onKeyDown={onSearchKeyDown}
              />
              {query && (
                <button type="button" className={styles.searchClear} onClick={clearGuess} aria-label="Clear">
                  <XIcon width={14} height={14} />
                </button>
              )}

              {matches.length > 0 && (
                <ul className={styles.results}>
                  {matches.map((track, i) => (
                    <li key={track.id}>
                      <button
                        type="button"
                        className={`${styles.result} ${i === highlight ? styles.resultActive : ''}`}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => choose(track)}
                      >
                        {track.artSmall && <img className={styles.resultArt} src={track.artSmall} alt="" />}
                        <span className={styles.resultText}>
                          <span className={styles.resultTitle}>{track.title}</span>
                          <span className={styles.resultArtist}>{track.artists.join(', ')}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.actionRow}>
              <button type="button" className={styles.buttonSecondary} onClick={skip}>
                <SkipIcon width={18} height={18} />
                {attemptsUsed + 1 >= MAX_ATTEMPTS
                  ? 'Give up'
                  : `Skip · +${LADDER[attemptsUsed + 1] - LADDER[attemptsUsed]}s`}
              </button>
              <button type="button" className={styles.buttonPrimary} onClick={submitGuess} disabled={!selected}>
                Submit
              </button>
            </div>
          </section>
        )}

        <footer className={styles.footer}>
          <span>
            Streak <b>{stats.streak}</b>
          </span>
          <span className={styles.footerDot} />
          <span>
            Best <b>{stats.best}</b>
          </span>
          <span className={styles.footerDot} />
          <span>
            Played <b>{stats.played}</b>
          </span>
          <span className={styles.footerDot} />
          <span>
            Won <b>{stats.played ? Math.round((stats.won / stats.played) * 100) : 0}%</b>
          </span>
        </footer>
      </main>

      <div className={`${styles.toast} ${toast ? styles.toastShown : ''}`} role="status">
        {toast}
      </div>
    </div>
  );
}
