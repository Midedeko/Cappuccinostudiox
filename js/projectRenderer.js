/**
 * Render project content: apply CMS data, init gallery, init background videos.
 */
export const DEFAULT_GALLERY_ITEMS = [
    { type: 'image', src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop', name: 'MOUNTAIN LANDSCAPE.JPG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1200&h=600&fit=crop', name: 'OCEAN VIEW.PNG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=600&h=800&fit=crop', name: 'PORTRAIT SHOT.JPG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&h=900&fit=crop', name: 'SQUARE IMAGE.PNG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1600&h=900&fit=crop', name: 'WIDE FORMAT.JPG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=700&h=1000&fit=crop', name: 'VERTICAL SHOT.PNG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1511497584788-876760111969?w=1000&h=600&fit=crop', name: 'HORIZONTAL VIEW.JPG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=1200&fit=crop', name: 'TALL PORTRAIT.PNG', storyline: '' }
];

export const DEFAULT_BACKGROUND_VIDEOS = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
];

/**
 * Mutate state with CMS data. state: { galleryItems, backgroundVideos, projectStoryline, projectStorylineTitle, projectName }
 */
export function applyCmsData(data, state, projectId) {
    if (data.storyline != null) state.projectStoryline = data.storyline || '';
    if (data.storylineTitle != null) state.projectStorylineTitle = data.storylineTitle || '';
    if (data.name != null) state.projectName = data.name || ('Project ' + projectId);
    const resolveSrc = (it) => it.src || (data.assets && (data.assets.find(a => a.id === it.assetId) || {}).src) || '';
    if (data.items != null && Array.isArray(data.items)) {
        state.galleryItems = data.items.map(it => {
            const src = resolveSrc(it);
            const type = it.type || 'image';
            const base = { type, src, name: it.name || 'Untitled', trimStart: it.trimStart, trimEnd: it.trimEnd, storyline: it.storyline, storylineTitle: it.storylineTitle ?? '', backgroundRoster: !!it.backgroundRoster };
            if (type === 'pdf') base.thumbnail = it.thumbnail || null;
            return base;
        }).filter(it => it.src);
        if (state.galleryItems.length > 0) {
            state.backgroundVideos = data.items
                .filter(it => it.type !== 'pdf' && it.backgroundRoster && (it.type === 'video' || (resolveSrc(it) && (resolveSrc(it).startsWith('data:video') || resolveSrc(it).startsWith('http')))))
                .map(it => ({ src: resolveSrc(it), trimStart: it.trimStart, trimEnd: it.trimEnd }));
            if (state.backgroundVideos.length === 0) {
                // No designated background: use only roster items as background; images last 5s.
                const rosterItems = state.galleryItems.filter(it => it.backgroundRoster);
                state.backgroundVideos = rosterItems.length > 0 ? rosterItems.map(it => ({
                    type: it.type,
                    src: it.src,
                    duration: it.type === 'image' ? 5000 : undefined,
                    trimStart: it.trimStart,
                    trimEnd: it.trimEnd
                })) : state.backgroundVideos;
            }
        }
    }
    if (state.galleryItems.length === 0) state.galleryItems = DEFAULT_GALLERY_ITEMS.slice();
    if (state.backgroundVideos.length === 0) state.backgroundVideos = DEFAULT_BACKGROUND_VIDEOS.slice();
}

const STACK_IMAGE_DURATION_MS = 5000;

/**
 * Init background media in container. backgroundVideos: array of { src, trimStart?, trimEnd?, type?: 'video'|'image', duration?: number } or legacy string src.
 * Images (type === 'image' or entry.duration) are shown in a loop, each for duration ms (default 5s).
 * ref: { currentVideoIndex, getActiveItemIndex }.
 * @returns {{ restartCycle: () => void }} - call restartCycle() when returning to background (e.g. from expanded view) to restart image timer.
 */
export function initBackgroundVideos(containerId, backgroundVideos, ref) {
    const container = document.getElementById(containerId);
    if (!container) return { restartCycle: () => {} };
    container.innerHTML = '';
    const list = Array.isArray(backgroundVideos) ? backgroundVideos : [];
    let imageAdvanceTimer = null;

    function showNext(index) {
        if (ref.getActiveItemIndex && ref.getActiveItemIndex() !== null) return;
        const nextIndex = (index + 1) % list.length;
        ref.currentVideoIndex = nextIndex;
        const children = container.children;
        for (let i = 0; i < children.length; i++) children[i].classList.toggle('active', i === nextIndex);
        const nextEl = children[nextIndex];
        const nextEntry = list[nextIndex];
        if (nextEl && nextEntry) {
            if (nextEl.tagName === 'VIDEO') {
                const nextStart = typeof nextEntry === 'object' && nextEntry && nextEntry.trimStart != null ? nextEntry.trimStart : 0;
                nextEl.currentTime = nextStart;
                nextEl.play();
            } else {
                scheduleImageAdvance(nextIndex);
            }
        }
    }

    function scheduleImageAdvance(index) {
        if (imageAdvanceTimer) clearTimeout(imageAdvanceTimer);
        const entry = list[index];
        const duration = (typeof entry === 'object' && entry != null && entry.duration) ? entry.duration : STACK_IMAGE_DURATION_MS;
        imageAdvanceTimer = setTimeout(() => showNext(index), duration);
    }

    function restartCycle() {
        if (ref.getActiveItemIndex && ref.getActiveItemIndex() !== null) return;
        const idx = ref.currentVideoIndex != null ? ref.currentVideoIndex : 0;
        const el = container.children[idx];
        const entry = list[idx];
        if (el && entry && el.tagName !== 'VIDEO') scheduleImageAdvance(idx);
    }

    list.forEach((entry, index) => {
        const src = typeof entry === 'string' ? entry : (entry && entry.src);
        const trimStart = typeof entry === 'object' && entry != null ? entry.trimStart : undefined;
        const trimEnd = typeof entry === 'object' && entry != null ? entry.trimEnd : undefined;
        const isImage = (typeof entry === 'object' && entry != null && entry.type === 'image') || (typeof entry === 'object' && entry != null && entry.duration != null);
        if (!src) return;

        if (isImage) {
            const img = document.createElement('img');
            img.src = src;
            img.alt = '';
            img.className = 'background-video background-image';
            if (index === 0) {
                img.classList.add('active');
                scheduleImageAdvance(0);
            }
            container.appendChild(img);
            return;
        }

        const video = document.createElement('video');
        video.src = src;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.className = 'background-video';
        if (index === 0) video.classList.add('active');
        container.appendChild(video);
        video.addEventListener('timeupdate', () => {
            if (trimEnd != null && isFinite(trimEnd) && video.currentTime >= trimEnd) {
                video.currentTime = trimStart != null && isFinite(trimStart) ? trimStart : 0;
            }
        });
        video.addEventListener('loadeddata', () => {
            if (trimStart != null && isFinite(trimStart)) video.currentTime = trimStart;
            if (video.classList.contains('active') && ref.getActiveItemIndex && ref.getActiveItemIndex() === null) video.play();
        });
        video.addEventListener('ended', () => {
            if (ref.getActiveItemIndex && ref.getActiveItemIndex() === null) {
                video.classList.remove('active');
                showNext(index);
            }
        });
    });
    return { restartCycle };
}

/**
 * Init gallery track. callbacks: { setHoverPreview(index), clearHoverPreview(), onItemClick(index, e?) }
 */
export function initGallery(trackId, containerId, galleryItems, callbacks) {
    const track = document.getElementById(trackId);
    const container = document.getElementById(containerId);
    if (!track || !container) return;
    track.innerHTML = '';
    const spacerStart = document.createElement('div');
    spacerStart.className = 'gallery-track-spacer gallery-track-spacer-start';
    track.appendChild(spacerStart);
    galleryItems.forEach((item, index) => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        galleryItem.dataset.index = index;
        if (item.type === 'pdf') galleryItem.dataset.type = 'pdf';
        let mediaElement;
        if (item.type === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.src = item.src;
            mediaElement.muted = true;
            mediaElement.playsInline = true;
        } else if (item.type === 'pdf') {
            mediaElement = document.createElement('img');
            mediaElement.src = item.thumbnail || item.src || '';
            mediaElement.alt = item.name;
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = item.src;
            mediaElement.alt = item.name;
        }
        const caption = document.createElement('div');
        caption.className = 'gallery-caption';
        const inner = document.createElement('div');
        inner.className = 'gallery-caption-inner';
        const captionText = document.createElement('span');
        captionText.className = 'gallery-caption-text';
        captionText.textContent = (item.storylineTitle != null && String(item.storylineTitle).trim() !== '') ? String(item.storylineTitle).trim() : (item.name || '');
        inner.appendChild(captionText);
        caption.appendChild(inner);
        galleryItem.appendChild(caption);
        const mediaWrap = document.createElement('div');
        mediaWrap.className = 'gallery-item-media';
        mediaWrap.appendChild(mediaElement);
        galleryItem.appendChild(mediaWrap);
        galleryItem.addEventListener('mouseenter', () => callbacks.setHoverPreview(index));
        galleryItem.addEventListener('click', (e) => callbacks.onItemClick(index, e));
        track.appendChild(galleryItem);
    });
    const spacerEnd = document.createElement('div');
    spacerEnd.className = 'gallery-track-spacer gallery-track-spacer-end';
    track.appendChild(spacerEnd);
    requestAnimationFrame(() => {
        const firstItem = track.querySelector('.gallery-item');
        if (firstItem) spacerStart.style.minWidth = (container.clientWidth / 2 - firstItem.offsetWidth / 2) + 'px';
        container.scrollLeft = 0;
    });
}
