import { useEffect, useRef, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/research', label: 'Research' },
  { to: '/experience', label: 'Experience' },
  { to: '/courses', label: 'Courses' },
  { to: '/blog', label: 'Blog' },
];

export default function SiteLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });
  const toastTimeoutRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle('menu-open', isMenuOpen);
  }, [isMenuOpen]);

  useEffect(() => () => document.body.classList.remove('menu-open'), []);

  function showToast(message) {
    clearTimeout(toastTimeoutRef.current);
    setToast({ message, visible: true });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 1000);
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText('https://soklyninnou.github.io');
      showToast('Copied website link!');
    } catch (err) {
      showToast('Failed to copy website link.');
      console.error(err);
    }
  }

  function closeMenu() {
    setIsMenuOpen(false);
  }

  return (
    <>
      <div className="navbar">
        <div className="icon-group">
          <img
            style={{ paddingLeft: 5 }}
            src="/pictures/burger-icon.png"
            alt="Menu"
            className="icon"
            onClick={() => setIsMenuOpen((open) => !open)}
          />
          <img
            src="/pictures/share.png"
            alt="Share"
            className="icon"
            onClick={handleShare}
          />
          <a href="https://github.com/SoklyninNou" target="_blank" rel="noreferrer">
            <img src="/pictures/github.png" alt="Github" className="icon" />
          </a>
          <Link to="/screen-saver" onClick={closeMenu}>
            <img src="/pictures/ss.png" alt="Screen Saver" className="icon" />
          </Link>
        </div>
        <Link to="/" onClick={closeMenu}>
          <img src="/pictures/waiting.gif" alt="logo" className="logo" />
        </Link>
      </div>

      <div className={`burger-menu${isMenuOpen ? ' show' : ''}`}>
        {NAV_LINKS.map((link) => (
          <Link key={link.to} to={link.to} onClick={closeMenu}>
            <p>{link.label}</p>
          </Link>
        ))}
        <a href="mailto:sly.nou@berkeley.edu">
          <p>Contact me</p>
        </a>
      </div>

      <div className="profile-container">
        <div className="profile" role="img" aria-label="Soklynin Nou" />
        <p className="profile-text">Soklynin Nou</p>
      </div>

      <div className={`toast${toast.visible ? ' show' : ''}`}>{toast.message}</div>

      <Outlet />
    </>
  );
}
