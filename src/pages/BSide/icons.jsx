/**
 * Small inline glyphs drawn in the spirit of SF Symbols: 24×24 box, rounded
 * caps and joins, weight carried by strokeWidth so they sit evenly next to text.
 */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export function LockIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="3.2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
      <circle cx="12" cy="15.4" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PlayIcon(props) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <path d="M8.4 5.6a1 1 0 0 1 1.52-.85l8.2 5.4a1.2 1.2 0 0 1 0 2l-8.2 5.4A1 1 0 0 1 8.4 16.6z" />
    </svg>
  );
}

export function PauseIcon(props) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <rect x="7.4" y="5.5" width="3.6" height="13" rx="1.5" />
      <rect x="13" y="5.5" width="3.6" height="13" rx="1.5" />
    </svg>
  );
}

export function XIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m7.6 7.6 8.8 8.8M16.4 7.6l-8.8 8.8" />
    </svg>
  );
}

export function CheckIcon(props) {
  return (
    <svg {...base} strokeWidth={2.1} {...props}>
      <path d="m6.4 12.5 3.7 3.7 7.5-8.4" />
    </svg>
  );
}

export function SkipIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5.5 12h12.2" />
      <path d="m13.6 7.9 4.1 4.1-4.1 4.1" />
    </svg>
  );
}

export function SearchIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.2" />
      <path d="m15.6 15.6 3.4 3.4" />
    </svg>
  );
}

export function ShareIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 15.2V4.4" />
      <path d="m8.3 8 3.7-3.6L15.7 8" />
      <path d="M6.2 12.4v5.4a2 2 0 0 0 2 2h7.6a2 2 0 0 0 2-2v-5.4" />
    </svg>
  );
}

export function ShuffleIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.6 7.2h3.1c1.2 0 2.3.6 3 1.6l3.6 5.4c.7 1 1.8 1.6 3 1.6h2.1" />
      <path d="M4.6 16.8h3.1c1.2 0 2.3-.6 3-1.6l.9-1.3" />
      <path d="M13.9 9.4l.4-.6c.7-1 1.8-1.6 3-1.6h2.1" />
      <path d="m17.4 4.8 2.4 2.4-2.4 2.4M17.4 14.4l2.4 2.4-2.4 2.4" />
    </svg>
  );
}
