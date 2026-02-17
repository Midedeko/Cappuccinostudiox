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
const LOADING_ACTIVE_CLASS = 'loading-active';
const DEFAULT_MIN_DISPLAY_MS = 6000;

let overlay = null;
let wipeEl = null;
let textEl = null;
let currentProgress = 0;
let showTime = 0;
let minDisplayMs = DEFAULT_MIN_DISPLAY_MS;
let currentLoadingLabel = null;

const styles = `
.loading-screen-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100vw;
    height: 100vh;
    min-width: 100vw;
    min-height: 100vh;
    overflow: hidden;
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
    left: 0; right: 0; bottom: 0;
    height: calc((100 - var(--loading-progress, 0)) * 1%);
    background: ${RED_BG};
    transition: height 0.35s linear;
    pointer-events: none;
}
.loading-screen-carousel-strip {
    position: absolute;
    top: 75%; left: 0;
    width: 100vw;
    height: 12.5vh;
    overflow: hidden;
    display: flex;
    align-items: center;
    white-space: nowrap;
    pointer-events: none;
}
.loading-screen-carousel-strip .carousel-inner {
    display: inline-block;
    color: ${YELLOW};
    font-size: 20px;
    text-transform: uppercase;
    white-space: nowrap;
    animation: loading-carousel-scroll 50s linear infinite;
}
@keyframes loading-carousel-scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
}
@media (max-width: 768px) {
    .loading-screen-carousel-strip .carousel-inner { font-size: 16px; }
}
body.loading-active .text-carousel { z-index: 100000; }
body.loading-with-page-carousel #loadingScreenOverlay .loading-screen-carousel-strip { display: none; }
`;

function ensureOverlay() {
    if (overlay) return overlay;
    const existing = document.getElementById('loadingScreenOverlay');
    if (existing) {
        overlay = existing;
        wipeEl = overlay.querySelector('.loading-screen-wipe');
        const strip = overlay.querySelector('.loading-screen-carousel-strip');
        textEl = strip ? strip.querySelector('.carousel-inner') : overlay.querySelector('.carousel-inner');
        if (wipeEl) wipeEl.style.setProperty('--loading-progress', '0');
        return overlay;
    }
    const style = document.createElement('style');
    style.textContent = styles;
    document.head.appendChild(style);
    overlay = document.createElement('div');
    overlay.id = 'loadingScreenOverlay';
    overlay.className = 'loading-screen-overlay';
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', 'Loading');
    const logoWrap = document.createElement('div');
    logoWrap.className = 'loading-screen-logo-wrap';
    const img = document.createElement('img');
    img.src = 'Studiox Logo.svg';
    img.alt = 'Cappuccino Studio';
    img.setAttribute('width', String(LOGO_HEIGHT_LOADING * 2));
    img.setAttribute('height', String(LOGO_HEIGHT_LOADING));
    logoWrap.appendChild(img);
    wipeEl = document.createElement('div');
    wipeEl.className = 'loading-screen-wipe';
    wipeEl.style.setProperty('--loading-progress', '0');
    logoWrap.appendChild(wipeEl);
    overlay.appendChild(logoWrap);
    const strip = document.createElement('div');
    strip.className = 'loading-screen-carousel-strip';
    const carouselInner = document.createElement('span');
    carouselInner.className = 'carousel-inner';
    strip.appendChild(carouselInner);
    overlay.appendChild(strip);
    textEl = carouselInner;
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
 * @param {string} pageOrProjectName - Display name for "Loading (Page Name)".
 * @param {object} [options] - Optional: { minDisplayMs } e.g. 3000 for project-files so loader shows at least 3s.
 */
/**
 * Returns the current loading label (e.g. 'Project Files') while the loader is showing, so the page carousel can use it as the first set. Null when not loading.
 */
export function getCurrentLoadingLabel() {
    return currentLoadingLabel;
}

export function showLoadingScreen(pageOrProjectName, options = {}) {
    ensureOverlay();
    currentProgress = 0;
    showTime = Date.now();
    minDisplayMs = options.minDisplayMs != null ? options.minDisplayMs : DEFAULT_MIN_DISPLAY_MS;
    currentLoadingLabel = pageOrProjectName || null;
    if (document.getElementById('carouselTrack')) document.body.classList.add('loading-with-page-carousel');
    if (wipeEl) wipeEl.style.setProperty('--loading-progress', '0');
    setCarouselContent(pageOrProjectName || '…');
    overlay.style.display = 'flex';
    document.body.classList.add(LOADING_ACTIVE_CLASS);
}

/**
 * Dismiss the loading screen without animation (e.g. on revisit when we skip showing it).
 * Removes loading-active from body and hides the overlay.
 */
export function dismissLoadingScreen() {
    currentLoadingLabel = null;
    document.body.classList.remove(LOADING_ACTIVE_CLASS);
    document.body.classList.remove('loading-with-page-carousel');
    const el = overlay || document.getElementById('loadingScreenOverlay');
    if (el) el.style.display = 'none';
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
 * @param {object} [options] - Optional: { minDisplayMs } e.g. 3000 for project-files
 * @returns {boolean} - true if the loading screen was shown, false if skipped (already visited)
 */
export function showLoadingScreenIfFirstVisit(pageKey, label, options = {}) {
    if (hasVisitedPage(pageKey)) {
        dismissLoadingScreen();
        return false;
    }
    showLoadingScreen(label || pageKey, options);
    return true;
}

/**
 * Hide the loading screen after at least minDisplayMs (default 2s). Optionally update label; then camera flash and remove overlay.
 * @param {object} [opts] - Optional: { label?: string, minDisplayMs?: number }
 */
export function hideLoadingScreen(opts = {}) {
    const el = overlay || document.getElementById('loadingScreenOverlay');
    if (!el) return;
    if (opts.label != null) setCarouselContent(opts.label);
    setLoadingProgress(100);
    const effectiveMin = opts.minDisplayMs != null ? opts.minDisplayMs : minDisplayMs;
    const doFlashAndHide = () => {
        currentLoadingLabel = null;
        document.body.classList.remove('loading-with-page-carousel');
        const flash = document.createElement('div');
        flash.setAttribute('aria-hidden', 'true');
        flash.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:100000;pointer-events:none;opacity:0;transition:opacity 0.15s ease;';
        document.body.appendChild(flash);
        requestAnimationFrame(() => { flash.style.opacity = '1'; });
        setTimeout(() => {
            flash.style.opacity = '0';
            flash.addEventListener('transitionend', () => {
                flash.remove();
                document.body.classList.remove(LOADING_ACTIVE_CLASS);
                el.style.display = 'none';
            }, { once: true });
        }, 180);
    };
    const elapsed = Date.now() - showTime;
    if (elapsed >= effectiveMin) {
        doFlashAndHide();
    } else {
        setTimeout(doFlashAndHide, effectiveMin - elapsed);
    }
}
