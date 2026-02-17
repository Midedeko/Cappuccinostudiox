/**
 * Page transition: fade out current page, navigate, then new page fades in.
 * - Body class "page-entering": content starts at opacity 0; remove to fade in.
 * - navigateTo(url): add "page-exiting", fade out, then location.href = url.
 * - Internal link clicks are intercepted and use navigateTo.
 */
const FADE_MS = 400;

const styles = `
body.page-entering > *:not(#loadingScreenOverlay):not(.text-carousel) {
    opacity: 0;
    transition: opacity ${FADE_MS}ms ease-out;
}
body:not(.page-entering) > *:not(#loadingScreenOverlay) {
    opacity: 1;
    transition: opacity ${FADE_MS}ms ease-out;
}
body.page-exiting > *:not(#loadingScreenOverlay):not(.text-carousel) {
    opacity: 0;
    transition: opacity ${FADE_MS}ms ease-out;
}
`;

(function injectStyles() {
    if (document.getElementById('page-transition-styles')) return;
    const el = document.createElement('style');
    el.id = 'page-transition-styles';
    el.textContent = styles;
    document.head.appendChild(el);
})();

function sameOrigin(href) {
    try {
        const u = new URL(href, window.location.href);
        return u.origin === window.location.origin && u.pathname !== window.location.pathname || (u.pathname === window.location.pathname && u.search !== window.location.search);
    } catch (_) {
        return false;
    }
}

/**
 * Navigate to url after fading out the current page.
 * @param {string} url
 */
export function navigateTo(url) {
    if (!url || typeof url !== 'string') return;
    const target = new URL(url, window.location.href);
    if (target.origin !== window.location.origin) {
        window.location.href = url;
        return;
    }
    if (document.body.classList.contains('page-exiting')) return;
    document.body.classList.add('page-exiting');
    let done = false;
    const onEnd = () => {
        if (done) return;
        done = true;
        /* Do not remove page-exiting: keep page faded out until navigation completes */
        window.location.href = url;
    };
    requestAnimationFrame(() => requestAnimationFrame(() => {})); // force reflow so transition runs
    setTimeout(onEnd, FADE_MS + 50);
}

/**
 * Remove page-entering so the current page fades in. Call when the page is ready to be shown
 * (e.g. after loading screen is dismissed or on revisit when loading screen is skipped).
 */
export function revealPage() {
    document.body.classList.remove('page-entering');
}

function init() {
    if (!document.body.classList.contains('loading-active')) {
        requestAnimationFrame(() => requestAnimationFrame(() => revealPage()));
    }
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]');
        if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
        const href = a.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
        try {
            const u = new URL(a.href, window.location.href);
            if (u.origin !== window.location.origin) return;
            if (u.pathname === window.location.pathname && u.search === window.location.search) return;
        } catch (_) {
            return;
        }
        e.preventDefault();
        navigateTo(a.href);
    }, true);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
