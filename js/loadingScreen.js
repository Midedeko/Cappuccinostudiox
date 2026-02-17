/**
 * Shared loading screen: red full page, Cappuccino Studio logo (2× size),
 * bottom-to-top linear wipe driven by load progress, carousel-style "Loading (Page Name)" text.
 * Supports "first visit per session" for landing/kitchen/admin via sessionStorage.
 */
const LOGO_HEIGHT_OTHER = 83.52;
const LOGO_HEIGHT_LOADING = Math.round(LOGO_HEIGHT_OTHER * 2);
const RED_BG = '#E70017';
const YELLOW = '#FFF212';
const SESSION_VISITED_KEY = 'loadingScreen_visited';

let overlay = null;
let wipeEl = null;
let textEl = null;
let currentProgress = 0;

const styles = `
.loading-screen-overlay {
    position: fixed;
    inset: 0;
    background: ${RED_BG};
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Code Saver', sans-serif;
}
.loading-screen-logo-wrap {
    position: relative;
    width: auto;
    height: ${LOGO_HEIGHT_LOADING}px;
    flex-shrink: 0;
}
.loading-screen-logo-wrap img {
    display: block;
    height: ${LOGO_HEIGHT_LOADING}px;
    width: auto;
    vertical-align: middle;
}
.loading-screen-wipe {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc((100 - var(--loading-progress, 0)) * 1%);
    background: ${RED_BG};
    transition: height 0.35s linear;
    pointer-events: none;
}
.loading-screen-text {
    margin-top: 32px;
    color: ${YELLOW};
    font-size: clamp(14px, 2.5vw, 20px);
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    max-width: 90vw;
}
.loading-screen-text .carousel-inner {
    display: inline-block;
    animation: loading-carousel-scroll 12s linear infinite;
}
@keyframes loading-carousel-scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
}
`;

function ensureOverlay() {
    if (overlay) return overlay;
    const style = document.createElement('style');
    style.textContent = styles;
    document.head.appendChild(style);
    overlay = document.createElement('div');
    overlay.className = 'loading-screen-overlay';
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', 'Loading');
    const logoWrap = document.createElement('div');
    logoWrap.className = 'loading-screen-logo-wrap';
    const img = document.createElement('img');
    img.src = 'Studiox Logo.png';
    img.alt = 'Cappuccino Studio';
    img.setAttribute('width', String(LOGO_HEIGHT_LOADING * 2));
    img.setAttribute('height', String(LOGO_HEIGHT_LOADING));
    logoWrap.appendChild(img);
    wipeEl = document.createElement('div');
    wipeEl.className = 'loading-screen-wipe';
    wipeEl.style.setProperty('--loading-progress', '0');
    logoWrap.appendChild(wipeEl);
    overlay.appendChild(logoWrap);
    textEl = document.createElement('div');
    textEl.className = 'loading-screen-text';
    const carouselInner = document.createElement('span');
    carouselInner.className = 'carousel-inner';
    textEl.appendChild(carouselInner);
    overlay.appendChild(textEl);
    document.body.appendChild(overlay);
    return overlay;
}

function setCarouselContent(label) {
    const inner = overlay && overlay.querySelector('.carousel-inner');
    if (!inner) return;
    const text = 'Loading (' + (label || '…') + ') ';
    inner.textContent = text + text;
}

/**
 * Show the loading screen.
 * @param {string} pageOrProjectName - Display name for "Loading (Page Name)" (e.g. "Project", "Project Files", "Content Management", or project name).
 */
export function showLoadingScreen(pageOrProjectName) {
    ensureOverlay();
    currentProgress = 0;
    wipeEl.style.setProperty('--loading-progress', '0');
    setCarouselContent(pageOrProjectName || '…');
    overlay.style.display = 'flex';
}

/**
 * Update the label shown in "Loading (Label)" (e.g. when project name becomes available).
 * @param {string} label - New display name.
 */
export function setLoadingLabel(label) {
    if (!overlay || !textEl) return;
    setCarouselContent(label || '…');
}

/**
 * Set load progress 0–100. Drives the bottom-to-top wipe (0% = 0% visible, 100% = fully visible).
 * @param {number} percent - 0 to 100.
 */
export function setLoadingProgress(percent) {
    if (!wipeEl) return;
    const p = Math.min(100, Math.max(0, Number(percent)));
    currentProgress = p;
    wipeEl.style.setProperty('--loading-progress', String(p));
}

/**
 * Whether this page has already been visited in the current session (used to skip loading screen on cached/revisit).
 * @param {string} pageKey - e.g. 'index.html', 'kitchen.html', 'admin.html'
 * @returns {boolean}
 */
export function hasVisitedPage(pageKey) {
    try {
        const raw = sessionStorage.getItem(SESSION_VISITED_KEY);
        const set = raw ? JSON.parse(raw) : null;
        return Array.isArray(set) && set.includes(pageKey);
    } catch (_) {
        return false;
    }
}

/**
 * Mark the page as visited this session so the loading screen is skipped on next navigation to it.
 * @param {string} pageKey - e.g. 'index.html', 'kitchen.html', 'admin.html'
 */
export function markPageVisited(pageKey) {
    try {
        const raw = sessionStorage.getItem(SESSION_VISITED_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const set = Array.isArray(parsed) ? parsed : [];
        if (!set.includes(pageKey)) {
            set.push(pageKey);
            sessionStorage.setItem(SESSION_VISITED_KEY, JSON.stringify(set));
        }
    } catch (_) {}
}

/**
 * Show the loading screen only on first visit this session (no cached load). Use for landing, kitchen, admin.
 * @param {string} pageKey - e.g. 'index.html', 'kitchen.html', 'admin.html'
 * @param {string} label - Display name for "Loading (Label)" (e.g. "Landing", "Kitchen", "Admin")
 * @returns {boolean} - true if the loading screen was shown, false if skipped (already visited)
 */
export function showLoadingScreenIfFirstVisit(pageKey, label) {
    if (hasVisitedPage(pageKey)) return false;
    showLoadingScreen(label || pageKey);
    return true;
}

/**
 * Hide the loading screen. Optionally update label first; then animates wipe to 100% and removes overlay.
 * @param {object} [opts] - Optional: { label?: string }
 */
export function hideLoadingScreen(opts = {}) {
    if (!overlay) return;
    if (opts.label != null) setCarouselContent(opts.label);
    setLoadingProgress(100);
    const afterTransition = () => {
        overlay.style.display = 'none';
        wipeEl.removeEventListener('transitionend', afterTransition);
    };
    wipeEl.addEventListener('transitionend', afterTransition, { once: true });
}
