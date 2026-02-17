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

function setActiveItem(index) {
    activeItemIndex = index;
    const item = state.galleryItems[index];
    const expandedBg = document.getElementById('expandedBackground');
    const allItems = document.querySelectorAll('.gallery-item');
    const storylineEl = document.getElementById('storylineOverlay');
    document.querySelectorAll('.background-video').forEach(v => { v.classList.remove('active'); if (v.pause) v.pause(); });
    expandedBg.innerHTML = '';
    let expandedMedia;
    if (item.type === 'video') {
        expandedMedia = document.createElement('video');
        expandedMedia.src = item.src;
        expandedMedia.autoplay = true;
        expandedMedia.loop = true;
        expandedMedia.muted = true;
        expandedMedia.playsInline = true;
        const trimStart = item.trimStart != null && isFinite(item.trimStart) ? item.trimStart : 0;
        const trimEnd = item.trimEnd != null && isFinite(item.trimEnd) ? item.trimEnd : null;
        expandedMedia.addEventListener('loadeddata', () => { expandedMedia.currentTime = trimStart; });
        if (trimEnd != null) {
            expandedMedia.addEventListener('timeupdate', () => {
                if (expandedMedia.currentTime >= trimEnd) expandedMedia.currentTime = trimStart;
            });
        }
    } else {
        expandedMedia = document.createElement('img');
        expandedMedia.src = item.src;
        expandedMedia.alt = item.name;
    }
    expandedBg.appendChild(expandedMedia);
    expandedBg.classList.add('active');
    allItems.forEach((el, i) => { el.classList.toggle('hidden', i !== index); });
    if (storylineEl) {
        storylineEl.classList.add('visible');
        var text = (item.storyline != null && String(item.storyline).trim() !== '') ? String(item.storyline).trim() : (state.projectStoryline || '');
        storylineController.run(storylineEl, text.toUpperCase());
        storylineController.setupHoverReveal(storylineEl);
    }
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
    allItems.forEach(item => item.classList.remove('hidden'));
    backgroundController.restartCycle();
    const storylineEl = document.getElementById('storylineOverlay');
    if (storylineEl && state.projectStoryline) {
        storylineEl.classList.add('visible');
        storylineController.run(storylineEl, (state.projectStoryline || '').toUpperCase());
        storylineController.setupHoverReveal(storylineEl);
    }
}

function openContentView(index) {
    const item = state.galleryItems[index];
    if (!item) return;
    contentViewInner.innerHTML = '';
    const isVideo = item.type === 'video';
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
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
    var hasStoryline = item.storyline != null && String(item.storyline).trim() !== '';
    var hasName = item.name != null && String(item.name).trim() !== '';
    if (isMobile && (hasStoryline || hasName)) {
        const info = document.createElement('div');
        info.className = 'content-view-mobile-info';
        if (hasName) {
            const nameEl = document.createElement('h3');
            nameEl.className = 'content-view-mobile-name';
            nameEl.textContent = item.name;
            info.appendChild(nameEl);
        }
        if (hasStoryline) {
            const body = document.createElement('p');
            body.className = 'content-view-mobile-storyline';
            body.textContent = item.storyline;
            info.appendChild(body);
        }
        contentViewInner.appendChild(info);
    }
    contentViewOverlay.classList.add('active');
}

function closeContentView() {
    if (contentViewMedia && contentViewMedia.pause) contentViewMedia.pause();
    contentViewMedia = null;
    contentViewOverlay.classList.remove('active');
    if (document.fullscreenElement) document.exitFullscreen();
}

function runInits() {
    try {
        const out = rendererInitBg('backgroundVideos', state.backgroundVideos, ref);
        if (out && out.restartCycle) backgroundController = out;
    } catch (e) { console.error('initBackgroundVideos', e); }
    try {
        rendererInitGallery('galleryTrack', 'galleryContainer', state.galleryItems, {
            setActiveItem,
            openContentView
        });
    } catch (e) { console.error('initGallery', e); }
    const menuText = document.getElementById('projectMenuText');
    if (menuText) menuText.textContent = (state.projectName || ('Project ' + projectId)).toUpperCase();
    document.title = (state.projectName || ('Project ' + projectId)) + ' - Portfolio';
    if (state.projectStoryline) {
        const el = document.getElementById('storylineOverlay');
        if (el) {
            el.classList.add('visible');
            storylineController.run(el, (state.projectStoryline || '').toUpperCase());
            storylineController.setupHoverReveal(el);
        }
    }

    const galleryContainer = document.getElementById('galleryContainer');
    if (galleryContainer) {
        galleryContainer.addEventListener('mouseleave', () => { if (activeItemIndex !== null) resetToBackground(); });
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
