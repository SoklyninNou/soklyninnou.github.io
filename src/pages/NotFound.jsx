import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function NotFound() {
  useDocumentTitle('Page Not Found | Soklynin Nou');

  return (
    <div className="title" style={{ marginTop: 'calc(var(--banner-height) + 4rem)' }}>
      Page not found — <Link to="/">go home</Link>
    </div>
  );
}
