/**
 * Shared loading screen: red full page, Cappuccino Studio logo (half of previous 2× size),
 * wipe bottom-to-top: 0→10→20% during load; on ready 50% then 50→80% over 3.5s, 80→100% over 0.5s; then fade out/in.
 * Carousel text "Loading Page Name" (no parentheses). First-visit per session for some pages.
 */
const LOGO_HEIGHT_OTHER = 83.52;
const LOGO_HEIGHT_LOADING = Math.round(LOGO_HEIGHT_OTHER); /* half of previous 2× size */
const RED_BG = '#E70017';
const YELLOW = '#FFF212';
const SESSION_VISITED_KEY = 'loadingScreen_visited';
const LOADING_ACTIVE_CLASS = 'loading-active';
const WIPE_PHASE2_MS = 3500;  // 50% → 80%
const WIPE_PHASE3_MS = 500;   // 80% → 100%
const FADE_DURATION_MS = 400;

let overlay = null;
let wipeEl = null;
let textEl = null;
let currentProgress = 0;
let currentLoadingLabel = null;
let loadPhaseTimeouts = [];

const CAROUSEL_REPETITIONS = 10;

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
    transition: opacity ${FADE_DURATION_MS}ms ease-out;
}
body.loading-active > *:not(#loadingScreenOverlay):not(.text-carousel) {
    opacity: 0;
    transition: opacity ${FADE_DURATION_MS}ms ease-out;
}
body:not(.loading-active) > *:not(#loadingScreenOverlay) {
    opacity: 1;
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
    left: 0; right: 0; top: 0;
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
.loading-screen-carousel-strip .carousel-track {
    display: inline-flex;
    white-space: nowrap;
    align-items: center;
    animation: scrollCarousel 50s linear infinite;
}
.loading-screen-carousel-strip .carousel-item {
    display: inline-block;
    font-family: 'Code Saver', sans-serif;
    font-size: 20px;
    color: ${YELLOW};
    text-transform: uppercase;
    white-space: nowrap;
}
.loading-screen-carousel-strip .carousel-separator {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${YELLOW};
    margin: 0 20px;
    flex-shrink: 0;
}
@keyframes scrollCarousel {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
}
@media (max-width: 768px) {
    .loading-screen-carousel-strip .carousel-item { font-size: 16px; }
}
body.loading-active .text-carousel { z-index: 100000; }
body.loading-with-page-carousel #loadingScreenOverlay .loading-screen-carousel-strip { display: none; }
`;

let styleInjected = false;
function ensureStyles() {
    if (styleInjected) return;
    const style = document.createElement('style');
    style.id = 'loading-screen-styles';
    style.textContent = styles;
    document.head.appendChild(style);
    styleInjected = true;
}

function ensureOverlay() {
    ensureStyles();
    if (overlay) return overlay;
    const existing = document.getElementById('loadingScreenOverlay');
    if (existing) {
        overlay = existing;
        wipeEl = overlay.querySelector('.loading-screen-wipe');
        const strip = overlay.querySelector('.loading-screen-carousel-strip');
        if (strip) {
            let track = strip.querySelector('.carousel-track');
            if (!track) {
                track = document.createElement('div');
                track.className = 'carousel-track';
                const oldInner = strip.querySelector('.carousel-inner');
                if (oldInner) oldInner.replaceWith(track);
                else strip.appendChild(track);
            }
            textEl = track;
        } else textEl = overlay.querySelector('.carousel-track');
        if (wipeEl) wipeEl.style.setProperty('--loading-progress', '0');
        return overlay;
    }
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
    const track = document.createElement('div');
    track.className = 'carousel-track';
    strip.appendChild(track);
    overlay.appendChild(strip);
    textEl = track;
    document.body.appendChild(overlay);
    styleInjected = true;
    return overlay;
}

function setCarouselContent(label) {
    const track = overlay && overlay.querySelector('.loading-screen-carousel-strip .carousel-track');
    if (!track) return;
    const text = 'Loading ' + (label || '…') + ' ';
    let html = '<span class="carousel-separator"></span>';
    for (let i = 0; i < CAROUSEL_REPETITIONS; i++) {
        html += '<span class="carousel-item">' + text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
        html += '<span class="carousel-separator"></span>';
    }
    track.innerHTML = html + html;
}

/**
 * Returns the current loading label (e.g. 'Project Files') while the loader is showing, so the page carousel can use it as the first set. Null when not loading.
 */
export function getCurrentLoadingLabel() {
    return currentLoadingLabel;
}

export function showLoadingScreen(pageOrProjectName) {
    ensureOverlay();
    loadPhaseTimeouts.forEach(t => clearTimeout(t));
    loadPhaseTimeouts = [];
    currentProgress = 0;
    currentLoadingLabel = pageOrProjectName || null;
    if (document.getElementById('carouselTrack')) document.body.classList.add('loading-with-page-carousel');
    if (wipeEl) {
        wipeEl.style.transition = 'height 0.35s linear';
        wipeEl.style.setProperty('--loading-progress', '0');
    }
    setCarouselContent(pageOrProjectName || '…');
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    document.body.classList.add(LOADING_ACTIVE_CLASS);
    loadPhaseTimeouts.push(setTimeout(() => setLoadingProgress(10), 150));
    loadPhaseTimeouts.push(setTimeout(() => setLoadingProgress(20), 350));
}

/**
 * Dismiss the loading screen without animation (e.g. on revisit when we skip showing it).
 * Removes loading-active from body and hides the overlay; reveals page (fade-in) via page transition.
 */
export function dismissLoadingScreen() {
    currentLoadingLabel = null;
    document.body.classList.remove(LOADING_ACTIVE_CLASS);
    document.body.classList.remove('loading-with-page-carousel');
    const el = overlay || document.getElementById('loadingScreenOverlay');
    if (el) el.style.display = 'none';
    import('./pageTransition.js').then(m => { if (m.revealPage) m.revealPage(); });
}

/**
 * Update the label shown in "Loading Label" (e.g. when project name becomes available).
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
 * @param {string} label - Display name for "Loading Label" (e.g. "Landing", "Kitchen", "Admin")
 * @returns {boolean} - true if the loading screen was shown, false if skipped (already visited)
 */
export function showLoadingScreenIfFirstVisit(pageKey, label) {
    if (hasVisitedPage(pageKey)) {
        dismissLoadingScreen();
        return false;
    }
    showLoadingScreen(label || pageKey);
    return true;
}

/**
 * Hide the loading screen: jump to 50%, wipe 50→80% over 3.5s, then 80→100% over 0.5s, then fade out overlay and fade in page.
 * @param {object} [opts] - Optional: { label?: string }
 */
export function hideLoadingScreen(opts = {}) {
    loadPhaseTimeouts.forEach(t => clearTimeout(t));
    loadPhaseTimeouts = [];
    const el = overlay || document.getElementById('loadingScreenOverlay');
    if (!el) return;
    if (opts.label != null) setCarouselContent(opts.label);
    if (!wipeEl) return;

    const doFadeAndHide = () => {
        currentLoadingLabel = null;
        document.body.classList.remove('loading-with-page-carousel');
        el.style.opacity = '0';
        el.addEventListener('transitionend', function onFadeOut() {
            el.removeEventListener('transitionend', onFadeOut);
            document.body.classList.remove(LOADING_ACTIVE_CLASS);
            el.style.display = 'none';
            el.style.opacity = '1';
            import('./pageTransition.js').then(m => { if (m.revealPage) m.revealPage(); });
        }, { once: true });
    };

    wipeEl.style.transition = 'none';
    wipeEl.style.setProperty('--loading-progress', '50');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            wipeEl.style.transition = 'height ' + (WIPE_PHASE2_MS / 1000) + 's linear';
            wipeEl.style.setProperty('--loading-progress', '80');
            wipeEl.addEventListener('transitionend', function phase2Done() {
                wipeEl.removeEventListener('transitionend', phase2Done);
                wipeEl.style.transition = 'height ' + (WIPE_PHASE3_MS / 1000) + 's linear';
                wipeEl.style.setProperty('--loading-progress', '100');
                wipeEl.addEventListener('transitionend', doFadeAndHide, { once: true });
            }, { once: true });
        });
    });
}
