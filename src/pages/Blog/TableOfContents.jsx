import { useEffect, useRef, useState } from 'react';

// Hardcoded to match the navbar's rendered height; kept in sync manually
// rather than reading --banner-height since this runs on scroll/resize.
const STICK_AT_Y = 64 + 16;
const STACK_BREAKPOINT = 1024;

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

export default function TableOfContents({ layoutRef, contentRef, contentKey }) {
  const asideRef = useRef(null);
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [pin, setPin] = useState(null);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const headings = contentEl.querySelectorAll('.post-subtitle, .post-subsubtitle');
    const seen = new Set();
    const built = [];

    headings.forEach((h) => {
      const base = slugify(h.textContent);
      let id = base;
      let i = 2;
      while (seen.has(id)) {
        id = `${base}-${i}`;
        i += 1;
      }
      seen.add(id);
      h.id = id;

      let level = 'top';
      if (h.classList.contains('post-subsubtitle')) level = 'subsub';
      else if (h.tagName.toLowerCase() === 'h2') level = 'sub';

      built.push({ id, text: h.textContent, level });
    });

    setItems(built);
  }, [contentRef, contentKey]);

  useEffect(() => {
    if (items.length === 0) return undefined;

    const layoutEl = layoutRef.current;
    const asideEl = asideRef.current;
    if (!layoutEl || !asideEl) return undefined;

    const headingEls = items.map((item) => document.getElementById(item.id)).filter(Boolean);
    let natural = { top: 0, left: 0, width: 0 };

    function measureNatural() {
      setPin(null);
      const rect = asideEl.getBoundingClientRect();
      natural = { top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width };
    }

    function updatePinned() {
      if (window.innerWidth <= STACK_BREAKPOINT) {
        setPin(null);
        return;
      }

      const tocViewportTop = natural.top - window.scrollY;
      if (tocViewportTop > STICK_AT_Y) {
        setPin(null);
        return;
      }

      const tocHeight = asideEl.offsetHeight;
      const layoutBottom = layoutEl.getBoundingClientRect().bottom + window.scrollY;
      const pinnedBottomIfFlat = window.scrollY + STICK_AT_Y + tocHeight;
      const top = pinnedBottomIfFlat > layoutBottom ? layoutBottom - tocHeight - window.scrollY : STICK_AT_Y;

      setPin({ top, left: natural.left - window.scrollX, width: natural.width });
    }

    function updateActive() {
      const cutoff = window.scrollY + STICK_AT_Y + 250;
      let active = headingEls[0];

      for (const heading of headingEls) {
        const top = heading.getBoundingClientRect().top + window.scrollY;
        if (top <= cutoff) active = heading;
        else break;
      }

      setActiveId(active ? active.id : null);
    }

    function update() {
      updatePinned();
      updateActive();
    }

    function remeasure() {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          measureNatural();
          update();
        });
      });
    }

    remeasure();

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', remeasure);
    window.addEventListener('pageshow', remeasure);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('pageshow', remeasure);
    };
  }, [items, layoutRef]);

  if (items.length === 0) return null;

  function handleLinkClick(event, id) {
    event.preventDefault();
    const heading = document.getElementById(id);
    if (!heading) return;

    const targetY = heading.getBoundingClientRect().top + window.scrollY - STICK_AT_Y;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
    window.history.replaceState(null, '', `#${id}`);
  }

  const pinStyle = pin ? { position: 'fixed', top: pin.top, left: pin.left, width: pin.width } : undefined;

  return (
    <aside className={`blog-toc${pin ? ' is-pinned' : ''}`} style={pinStyle} ref={asideRef}>
      <h2 className="toc-title">Table of Contents</h2>
      <ul>
        {items.map((item) => (
          <li
            key={item.id}
            className={`toc-item${item.level === 'subsub' ? ' toc-subsub' : item.level === 'sub' ? ' toc-sub' : ''}`}
          >
            <a
              className={`toc-link${activeId === item.id ? ' active' : ''}`}
              href={`#${item.id}`}
              onClick={(e) => handleLinkClick(e, item.id)}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
