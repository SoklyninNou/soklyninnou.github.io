(function () {
    const NAVBAR_HEIGHT = 64;
    const OFFSET = 16;
    const STICK_AT_Y = NAVBAR_HEIGHT + OFFSET;
    const STACK_BREAKPOINT = 1024;

    function slugify(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');
    }

    function uniqueId(base) {
        if (!document.getElementById(base)) return base;
        let i = 2;
        while (document.getElementById(`${base}-${i}`)) i++;
        return `${base}-${i}`;
    }

    document.addEventListener('DOMContentLoaded', function () {
        const tocList = document.getElementById('toc-list');
        const tocAside = document.querySelector('.blog-toc');
        const layout = document.querySelector('.blog-layout');
        const postBody = document.querySelector('.post-body');
        if (!tocList || !tocAside || !postBody || !layout) return;

        const headings = postBody.querySelectorAll('.post-subtitle');
        if (headings.length === 0) {
            tocAside.style.display = 'none';
            return;
        }

        // ---- Build the ToC list ----
        const items = [];
        headings.forEach(h => {
            if (!h.id) h.id = uniqueId(slugify(h.textContent));

            const li = document.createElement('li');
            li.className = 'toc-item';
            if (h.tagName.toLowerCase() === 'h2') li.classList.add('toc-sub');

            const a = document.createElement('a');
            a.href = `#${h.id}`;
            a.textContent = h.textContent;
            a.className = 'toc-link';

            a.addEventListener('click', e => {
                e.preventDefault();
                const targetY = h.getBoundingClientRect().top + window.scrollY - STICK_AT_Y;
                window.scrollTo({ top: targetY, behavior: 'smooth' });
                history.replaceState(null, '', `#${h.id}`);
            });

            li.appendChild(a);
            tocList.appendChild(li);
            items.push({ link: a, heading: h });
        });

        // ---- Active-section highlighting ----
        function updateActive() {
            const cutoff = window.scrollY + STICK_AT_Y + 40;
            let active = items[0];
            for (const it of items) {
                const top = it.heading.getBoundingClientRect().top + window.scrollY;
                if (top <= cutoff) active = it;
                else break;
            }
            items.forEach(it => it.link.classList.toggle('active', it === active));
        }

        // ---- JS-driven sticky ----
        let natural = { top: 0, left: 0, width: 0 };

        function clearPinned() {
            tocAside.classList.remove('is-pinned');
            tocAside.style.position = '';
            tocAside.style.top = '';
            tocAside.style.left = '';
            tocAside.style.width = '';
        }

        function measureNatural() {
            clearPinned();
            const rect = tocAside.getBoundingClientRect();
            natural = {
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
            };
        }

        function updatePinned() {
            if (window.innerWidth <= STACK_BREAKPOINT) {
                clearPinned();
                return;
            }

            if (natural.top <= STICK_AT_Y) {
                clearPinned();
                return;
            }

            const tocHeight = tocAside.offsetHeight;
            const layoutBottom = layout.getBoundingClientRect().bottom + window.scrollY;

            const tocViewportTop = natural.top - window.scrollY;
            if (tocViewportTop > STICK_AT_Y) {
                clearPinned();
                return;
            }

            tocAside.classList.add('is-pinned');
            tocAside.style.position = 'fixed';
            tocAside.style.left = (natural.left - window.scrollX) + 'px';
            tocAside.style.width = natural.width + 'px';

            const pinnedBottomIfFlat = window.scrollY + STICK_AT_Y + tocHeight;
            if (pinnedBottomIfFlat > layoutBottom) {
                const top = layoutBottom - tocHeight - window.scrollY;
                tocAside.style.top = top + 'px';
            } else {
                tocAside.style.top = STICK_AT_Y + 'px';
            }
        }

        function update() {
            updatePinned();
            updateActive();
        }

        function remeasure() {
            measureNatural();
            update();
        }

        measureNatural();
        update();

        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', remeasure);
        window.addEventListener('load', remeasure);
    });
})();
