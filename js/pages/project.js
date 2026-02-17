/**
 * Project page: state, callbacks, runInits; init() loads project and runs runAfterLoad.
 */
import { init } from '../core.js';
import { getProjectIdFromURL } from '../projectLoader.js';
import { createStorylineController } from '../animations.js';
import { setupMenuSimple } from '../ui.js';
import { showLoadingScreen, hideLoadingScreen } from '../loadingScreen.js';
import { initBackgroundVideos as rendererInitBg, initGallery as rendererInitGallery, DEFAULT_GALLERY_ITEMS, DEFAULT_BACKGROUND_VIDEOS } from '../projectRenderer.js';

const projectId = getProjectIdFromURL();
if (!projectId) {
    document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif;">Missing project id.</p><a href="project-files.html" style="color:#FFF212;">Back to Project Files</a>';
    throw new Error('missing id');
}

const state = {
    galleryItems: DEFAULT_GALLERY_ITEMS.slice(),
    backgroundVideos: DEFAULT_BACKGROUND_VIDEOS.slice(),
    projectStoryline: '',
    projectStorylineTitle: '',
    projectName: 'Project ' + projectId
};

let currentVideoIndex = 0;
let activeItemIndex = null;
const storylineController = createStorylineController();
const contentViewOverlay = document.getElementById('contentViewOverlay');
const contentViewInner = document.getElementById('contentViewInner');
let contentViewMedia = null;
let backgroundController = { restartCycle: () => {} };

const ref = {
    get currentVideoIndex() { return currentVideoIndex; },
    set currentVideoIndex(v) { currentVideoIndex = v; },
    getActiveItemIndex: () => activeItemIndex
};

function buildExpandedMedia(item) {
    let el;
    if (item.type === 'video') {
        el = document.createElement('video');
        el.src = item.src;
        el.autoplay = true;
        el.loop = true;
        el.muted = true;
        el.playsInline = true;
        const trimStart = item.trimStart != null && isFinite(item.trimStart) ? item.trimStart : 0;
        const trimEnd = item.trimEnd != null && isFinite(item.trimEnd) ? item.trimEnd : null;
        el.addEventListener('loadeddata', () => { el.currentTime = trimStart; });
        if (trimEnd != null) {
            el.addEventListener('timeupdate', () => { if (el.currentTime >= trimEnd) el.currentTime = trimStart; });
        }
    } else if (item.type === 'pdf') {
        el = document.createElement('img');
        el.src = item.thumbnail || item.src || '';
        el.alt = item.name;
    } else {
        el = document.createElement('img');
        el.src = item.src;
        el.alt = item.name;
    }
    return el;
}

/** Caption text = storyline title (fallback item name). For PDF in preview we show TAP/CLICK TO OPEN PDF. Blank if item name contains 6969. */
function getCaptionText(item, usePdfCta) {
    if (!item) return '';
    if (item.name != null && String(item.name).includes('6969')) return '';
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (usePdfCta && item.type === 'pdf') return isMobile ? 'TAP TO OPEN PDF' : 'CLICK TO OPEN PDF';
    return (item.storylineTitle != null && String(item.storylineTitle).trim() !== '') ? String(item.storylineTitle).trim() : (item.name || '');
}
/** Set caption for one gallery item. */
function setGalleryCaptionForIndex(index, usePdfCta) {
    const el = document.querySelector('.gallery-item[data-index="' + index + '"]');
    const item = state.galleryItems[index];
    const cap = el && el.querySelector('.gallery-caption-text');
    if (!cap || !item) return;
    cap.textContent = getCaptionText(item, usePdfCta);
}
/** Restore all gallery captions to storyline title / name. */
function restoreGalleryCaptions() {
    state.galleryItems.forEach((item, i) => setGalleryCaptionForIndex(i, false));
}

const DEFAULT_RED_BG = '#E70017';

/** Desktop only: show item in expanded background (or red if item not on background roster). No-op when in preview mode. */
function setHoverPreview(index) {
    if (window.matchMedia('(max-width: 768px)').matches) return;
    if (activeItemIndex !== null) return; /* don't hijack preview mode */
    const item = state.galleryItems[index];
    if (!item) return;
    const expandedBg = document.getElementById('expandedBackground');
    if (!expandedBg) return;
    document.querySelectorAll('.background-video').forEach(v => { v.classList.remove('active'); if (v.pause) v.pause(); });
    expandedBg.innerHTML = '';
    expandedBg.style.backgroundColor = '';
    if (item.backgroundRoster) {
        expandedBg.appendChild(buildExpandedMedia(item));
    } else {
        expandedBg.style.backgroundColor = DEFAULT_RED_BG;
    }
    expandedBg.classList.add('active');
    document.querySelectorAll('.gallery-item').forEach(el => {
        if (String(el.dataset.index) !== String(index)) el.classList.add('gallery-item-hover-hidden');
        else el.classList.remove('gallery-item-hover-hidden');
    });
    state.galleryItems.forEach((_, i) => setGalleryCaptionForIndex(i, i === index));
}

/** Clear hover preview when leaving gallery; no-op if in full preview mode. */
function clearHoverPreview() {
    if (activeItemIndex !== null) return;
    restoreGalleryCaptions();
    document.querySelectorAll('.gallery-item').forEach(el => el.classList.remove('gallery-item-hover-hidden'));
    const expandedBg = document.getElementById('expandedBackground');
    if (!expandedBg) return;
    expandedBg.innerHTML = '';
    expandedBg.style.backgroundColor = '';
    expandedBg.classList.remove('active');
    const videos = document.querySelectorAll('.background-video');
    let foundActive = false;
    videos.forEach((el, i) => {
        if (el.classList.contains('active')) { foundActive = true; currentVideoIndex = i; if (el.play) el.play(); }
    });
    if (!foundActive && videos.length > 0) {
        currentVideoIndex = 0;
        videos[0].classList.add('active');
        if (videos[0].currentTime !== undefined) videos[0].currentTime = 0;
        if (videos[0].play) videos[0].play();
    }
    backgroundController.restartCycle();
}

/** First click/tap = preview mode; second on same item = content view. */
function onGalleryItemClick(index, e) {
    if (e) e.stopPropagation();
    if (activeItemIndex === index) {
        openContentView(index);
    } else {
        setActiveItem(index);
    }
}

function setActiveItem(index) {
    const item = state.galleryItems[index];
    if (!item) return;
    activeItemIndex = index;
    const expandedBg = document.getElementById('expandedBackground');
    const allItems = document.querySelectorAll('.gallery-item');
    const storylineEl = document.getElementById('storylineOverlay');
    document.querySelectorAll('.background-video').forEach(v => { v.classList.remove('active'); if (v.pause) v.pause(); });
    expandedBg.innerHTML = '';
    expandedBg.style.backgroundColor = '';
    if (item.backgroundRoster) {
        expandedBg.appendChild(buildExpandedMedia(item));
    } else {
        expandedBg.style.backgroundColor = DEFAULT_RED_BG;
    }
    expandedBg.classList.add('active');
    /* Clear all state classes so Chrome applies the new active item correctly when switching preview */
    allItems.forEach(el => {
        el.classList.remove('hidden', 'gallery-item-hover-hidden', 'gallery-item-media-reveal');
    });
    allItems.forEach((el, i) => { el.classList.toggle('hidden', i !== index); });
    state.galleryItems.forEach((_, i) => setGalleryCaptionForIndex(i, i === index));
    /* Force Chrome to apply visibility: read layout so next paint shows the correct item */
    const activeEl = allItems[index];
    if (activeEl) void activeEl.offsetHeight;
    if (storylineEl) {
        storylineEl.classList.add('visible');
        /* Storyline title = item caption (title/name), not the PDF instruction; gallery caption alone shows TAP/CLICK TO OPEN PDF */
        const storylineTitleStr = getCaptionText(item, false);
        const hasTitle = storylineTitleStr !== '' && !String(storylineTitleStr).includes('6969');
        const itemStory = (item.storyline != null && String(item.storyline).trim() !== '') ? String(item.storyline).trim() : '';
        const body = itemStory || formatProjectStoryline();
        const text = hasTitle ? (body ? storylineTitleStr + '\n\n' + body : storylineTitleStr) : body;
        storylineController.run(storylineEl, (text || '').toUpperCase());
        storylineController.setupHoverReveal(storylineEl);
    }
}

function formatProjectStoryline() {
    const title = (state.projectStorylineTitle || '').trim();
    const body = (state.projectStoryline || '').trim();
    return title ? (body ? title + '\n\n' + body : title) : body;
}

function resetToBackground() {
    if (activeItemIndex === null) return;
    activeItemIndex = null;
    const expandedBg = document.getElementById('expandedBackground');
    const allItems = document.querySelectorAll('.gallery-item');
    const videos = document.querySelectorAll('.background-video');
    let foundActive = false;
    videos.forEach((el, index) => {
        if (el.classList.contains('active')) { foundActive = true; currentVideoIndex = index; if (el.play) el.play(); }
    });
    if (!foundActive && videos.length > 0) {
        currentVideoIndex = 0;
        videos[0].classList.add('active');
        if (videos[0].currentTime !== undefined) videos[0].currentTime = 0;
        if (videos[0].play) videos[0].play();
    }
    expandedBg.classList.remove('active');
    expandedBg.style.backgroundColor = '';
    allItems.forEach(item => item.classList.remove('hidden'));
    restoreGalleryCaptions();
    backgroundController.restartCycle();
    const storylineEl = document.getElementById('storylineOverlay');
    if (storylineEl && (state.projectStorylineTitle || state.projectStoryline)) {
        storylineEl.classList.add('visible');
        storylineController.run(storylineEl, formatProjectStoryline().toUpperCase());
        storylineController.setupHoverReveal(storylineEl);
    }
}

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149';
let pdfjsLib = null;

/**
 * Load PDF.js from CDN and render the PDF into the container (for mobile inline view).
 * Falls back to iframe if import or render fails.
 */
async function loadAndRenderPdfWithPdfJs(pdfUrl, container, loadingEl) {
    if (!pdfjsLib) {
        const mod = await import(/* webpackIgnore: true */ PDFJS_CDN + '/pdf.min.mjs');
        pdfjsLib = mod.default ?? mod;
        if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN + '/pdf.worker.min.mjs';
        }
    }
    const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const firstPage = await pdf.getPage(1);
    const baseViewport = firstPage.getViewport({ scale: 1 });
    const containerWidth = container.clientWidth || 400;
    const scale = Math.min(2.5, (containerWidth - 24) / baseViewport.width);

    for (let i = 1; i <= numPages; i++) {
        const page = i === 1 ? firstPage : await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.className = 'content-view-pdf-page-canvas';
        const ctx = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: ctx, viewport }).promise;
        container.appendChild(canvas);
    }
    if (loadingEl && loadingEl.parentNode) loadingEl.remove();
    requestAnimationFrame(() => initPdfScrollbar());
}

let pdfScrollbarAbort = null;

function initPdfScrollbar() {
    const scrollOuter = document.getElementById('contentViewPdfScrollOuter');
    const scrollbarEl = scrollOuter?.querySelector('.content-view-custom-scrollbar');
    const track = scrollOuter?.querySelector('.content-view-scrollbar-track');
    const thumb = scrollOuter?.querySelector('.content-view-scrollbar-thumb');
    if (!scrollOuter || !scrollbarEl || !track || !thumb || !contentViewInner) return;

    pdfScrollbarAbort?.abort();
    pdfScrollbarAbort = new AbortController();
    const { signal } = pdfScrollbarAbort;

    const thumbSize = 6;

    function update() {
        const canScroll = contentViewInner.scrollHeight > contentViewInner.clientHeight;
        scrollbarEl.style.display = canScroll ? 'block' : 'none';
        if (!canScroll) return;
        const maxScroll = contentViewInner.scrollHeight - contentViewInner.clientHeight;
        const trackHeight = track.clientHeight;
        const thumbTop = maxScroll <= 0 ? 0 : (contentViewInner.scrollTop / maxScroll) * (trackHeight - thumbSize);
        thumb.style.top = thumbTop + 'px';
    }

    contentViewInner.addEventListener('scroll', update, { signal });
    const ro = new ResizeObserver(update);
    ro.observe(contentViewInner);
    signal.addEventListener('abort', () => ro.disconnect(), { once: true });

    track.addEventListener('click', (e) => {
        if (e.target === thumb) return;
        const maxScroll = contentViewInner.scrollHeight - contentViewInner.clientHeight;
        if (maxScroll <= 0) return;
        const trackRect = track.getBoundingClientRect();
        const y = (e.clientY - trackRect.top - thumbSize / 2) / (trackRect.height - thumbSize);
        const rel = Math.max(0, Math.min(1, y));
        contentViewInner.scrollTop = rel * maxScroll;
    }, { signal });

    function drag(startY, startScrollTop) {
        const maxScroll = contentViewInner.scrollHeight - contentViewInner.clientHeight;
        if (maxScroll <= 0) return;
        function move(e) {
            const y = e.touches ? e.touches[0].clientY : e.clientY;
            const trackRect = track.getBoundingClientRect();
            const rel = (trackRect.height - thumbSize) > 0
                ? (y - trackRect.top - thumbSize / 2) / (trackRect.height - thumbSize)
                : 0;
            contentViewInner.scrollTop = Math.max(0, Math.min(maxScroll, rel * maxScroll));
        }
        function end() {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', end);
            document.removeEventListener('touchmove', move, { passive: false });
            document.removeEventListener('touchend', end);
            document.removeEventListener('touchcancel', end);
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', end);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', end);
        document.addEventListener('touchcancel', end);
    }

    thumb.addEventListener('mousedown', (e) => { e.preventDefault(); drag(e.clientY, contentViewInner.scrollTop); }, { signal });
    thumb.addEventListener('touchstart', (e) => { e.preventDefault(); drag(e.touches[0].clientY, contentViewInner.scrollTop); }, { passive: false, signal });

    update();
}

function openContentView(index) {
    const item = state.galleryItems[index];
    if (!item) return;
    contentViewInner.innerHTML = '';
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    if (item.type === 'pdf') {
        const wrap = document.createElement('div');
        wrap.className = 'content-view-pdf-wrap';
        const pdfUrl = item.src || '';
        const isMobilePdf = isMobile;

        if (isMobilePdf) {
            /* On mobile, iframe often triggers download or external viewer; use PDF.js to render inline */
            const container = document.createElement('div');
            container.className = 'content-view-pdf-canvas-container';
            const loadingEl = document.createElement('div');
            loadingEl.className = 'content-view-pdf-loading';
            loadingEl.textContent = 'Loading PDF…';
            wrap.appendChild(loadingEl);
            wrap.appendChild(container);
            contentViewInner.appendChild(wrap);
            const closeBtn = document.createElement('button');
            closeBtn.className = 'content-view-close-fixed';
            closeBtn.type = 'button';
            closeBtn.title = 'Close';
            closeBtn.textContent = 'Close';
            closeBtn.addEventListener('click', closeContentView);
            contentViewOverlay.appendChild(closeBtn);
            contentViewOverlay.classList.add('active');
            contentViewOverlay.classList.add('content-view-pdf-active');
            requestAnimationFrame(() => initPdfScrollbar());

            loadAndRenderPdfWithPdfJs(pdfUrl, container, loadingEl).catch(() => {
                /* Fallback to iframe if PDF.js fails (e.g. CORS, script load) */
                loadingEl.remove();
                container.innerHTML = '';
                const iframe = document.createElement('iframe');
                iframe.src = pdfUrl;
                iframe.title = item.name || 'PDF';
                iframe.className = 'content-view-pdf-iframe';
                container.appendChild(iframe);
            });
            return;
        }

        const iframe = document.createElement('iframe');
        const sep = pdfUrl.indexOf('#') >= 0 ? '&' : '#';
        iframe.src = pdfUrl + sep + 'toolbar=0&navpanes=0';
        iframe.title = item.name || 'PDF';
        iframe.className = 'content-view-pdf-iframe';
        wrap.appendChild(iframe);
        contentViewInner.appendChild(wrap);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'content-view-close-fixed';
        closeBtn.type = 'button';
        closeBtn.title = 'Close';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', closeContentView);
        contentViewOverlay.appendChild(closeBtn);
        contentViewOverlay.classList.add('active');
        contentViewOverlay.classList.add('content-view-pdf-active');
        requestAnimationFrame(() => initPdfScrollbar());
        return;
    }

    const isVideo = item.type === 'video';
    const media = isVideo ? document.createElement('video') : document.createElement('img');
    media.src = item.src;
    if (isVideo) {
        media.controls = false;
        media.muted = false;
        media.playsInline = true;
        media.loop = true;
        const trimStart = item.trimStart != null && isFinite(item.trimStart) ? item.trimStart : 0;
        const trimEnd = item.trimEnd != null && isFinite(item.trimEnd) ? item.trimEnd : null;
        media.addEventListener('loadeddata', () => { media.currentTime = trimStart; });
        if (trimEnd != null) {
            media.addEventListener('timeupdate', () => {
                if (media.currentTime >= trimEnd) media.currentTime = trimStart;
            });
        }
    } else { media.alt = item.name; }
    contentViewMedia = media;
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    if (isMobile) {
        wrap.className = 'content-view-mobile-wrap';
        media.style.maxWidth = '100%';
        media.style.width = 'calc(100% - 1rem)';
        media.style.margin = '0 auto';
        media.style.display = 'block';
    }
    wrap.appendChild(media);
    const actions = document.createElement('div');
    actions.className = 'content-view-actions';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'content-view-btn';
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    closeBtn.innerHTML = '&#10005;';
    closeBtn.addEventListener('click', closeContentView);
    actions.appendChild(closeBtn);
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'content-view-btn';
    fullscreenBtn.type = 'button';
    fullscreenBtn.title = 'Full screen';
    fullscreenBtn.innerHTML = '&#9744;';
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) contentViewOverlay.requestFullscreen().catch(() => {});
        else document.exitFullscreen();
    });
    actions.appendChild(fullscreenBtn);
    if (isVideo) {
        const playBtn = document.createElement('button');
        playBtn.className = 'content-view-btn';
        playBtn.type = 'button';
        playBtn.title = 'Play / Pause';
        playBtn.innerHTML = '&#9658;';
        playBtn.addEventListener('click', () => {
            if (media.paused) { media.play(); playBtn.innerHTML = '&#10074;&#10074;'; } else { media.pause(); playBtn.innerHTML = '&#9658;'; }
        });
        media.addEventListener('play', () => { playBtn.innerHTML = '&#10074;&#10074;'; });
        media.addEventListener('pause', () => { playBtn.innerHTML = '&#9658;'; });
        actions.appendChild(playBtn);
        media.play();
    }
    wrap.appendChild(actions);
    contentViewInner.appendChild(wrap);
    contentViewOverlay.classList.add('active');
}

function closeContentView() {
    if (contentViewMedia && contentViewMedia.pause) contentViewMedia.pause();
    contentViewMedia = null;
    contentViewOverlay.classList.remove('active');
    contentViewOverlay.classList.remove('content-view-pdf-active');
    contentViewOverlay.querySelectorAll('.content-view-close-fixed').forEach(el => el.remove());
    pdfScrollbarAbort?.abort();
    pdfScrollbarAbort = null;
    if (document.fullscreenElement) document.exitFullscreen();
}

function runInits() {
    try {
        const out = rendererInitBg('backgroundVideos', state.backgroundVideos, ref);
        if (out && out.restartCycle) backgroundController = out;
    } catch (e) { console.error('initBackgroundVideos', e); }
    try {
        rendererInitGallery('galleryTrack', 'galleryContainer', state.galleryItems, {
            setHoverPreview,
            clearHoverPreview,
            onItemClick: onGalleryItemClick
        });
    } catch (e) { console.error('initGallery', e); }
    const menuText = document.getElementById('projectMenuText');
    if (menuText) menuText.textContent = (state.projectName || ('Project ' + projectId)).toUpperCase();
    document.title = (state.projectName || ('Project ' + projectId)) + ' - Portfolio';
    if (state.projectStorylineTitle || state.projectStoryline) {
        const el = document.getElementById('storylineOverlay');
        if (el) {
            el.classList.add('visible');
            storylineController.run(el, formatProjectStoryline().toUpperCase());
            storylineController.setupHoverReveal(el);
        }
    }

    const galleryContainer = document.getElementById('galleryContainer');
    if (galleryContainer) {
        galleryContainer.addEventListener('mouseleave', () => {
            if (activeItemIndex !== null) return; /* keep preview mode when leaving gallery; only click-away or another item deactivates */
            clearHoverPreview();
        });
        /* mouseover fallback for browsers where mouseenter doesn't fire on gallery items (e.g. Cursor) */
        galleryContainer.addEventListener('mouseover', (e) => {
            const item = e.target.closest('.gallery-item');
            if (item && activeItemIndex === null) setHoverPreview(Number(item.dataset.index));
        });
        galleryContainer.addEventListener('mouseenter', (e) => {
            const item = e.target.closest('.gallery-item');
            if (item && activeItemIndex !== null && Number(item.dataset.index) !== activeItemIndex) {
                item.classList.add('gallery-item-media-reveal');
            }
        }, true);
        galleryContainer.addEventListener('mouseleave', (e) => {
            const item = e.target.closest('.gallery-item');
            if (item) item.classList.remove('gallery-item-media-reveal');
        }, true);
    }
    document.addEventListener('wheel', (e) => {
        const gallery = document.getElementById('galleryContainer');
        if (!gallery || !gallery.contains(e.target)) return;
        const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        gallery.scrollLeft += delta;
        e.preventDefault();
    }, { passive: false });
    document.addEventListener('click', (e) => {
        if (activeItemIndex !== null && !e.target.closest('.gallery-item') && !e.target.closest('.expanded-background') && !e.target.closest('.gallery-container')) resetToBackground();
    });
    document.addEventListener('touchend', (e) => {
        if (activeItemIndex !== null && !e.target.closest('.gallery-item') && !e.target.closest('.expanded-background') && !e.target.closest('.gallery-container')) resetToBackground();
    });

    contentViewOverlay.addEventListener('click', (e) => { if (e.target === contentViewOverlay) closeContentView(); });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !contentViewOverlay.classList.contains('active')) return;
        if (document.fullscreenElement) document.exitFullscreen();
        else closeContentView();
    });

    setupMenuSimple('projectMenuContainer', 'projectMenuButton');
    hideLoadingScreen({ label: state.projectName || ('Project ' + projectId) });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        showLoadingScreen('Project');
        init({ projectPage: { projectId, state, runAfterLoad: runInits } });
    });
} else {
    showLoadingScreen('Project');
    init({ projectPage: { projectId, state, runAfterLoad: runInits } });
}
