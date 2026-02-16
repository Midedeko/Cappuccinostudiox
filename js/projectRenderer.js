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
 * Mutate state with CMS data. state: { galleryItems, backgroundVideos, projectStoryline, projectName }
 */
export function applyCmsData(data, state, projectId) {
    if (data.storyline != null) state.projectStoryline = data.storyline || '';
    if (data.name != null) state.projectName = data.name || ('Project ' + projectId);
    if (data.items != null && Array.isArray(data.items)) {
        state.galleryItems = data.items.map(it => ({
            type: it.type || 'image',
            src: it.src || '',
            name: it.name || 'Untitled',
            trimStart: it.trimStart,
            trimEnd: it.trimEnd
        })).filter(it => it.src);
        if (state.galleryItems.length > 0) {
            state.backgroundVideos = data.items
                .filter(it => it.backgroundRoster && (it.type === 'video' || (it.src && (it.src.startsWith('data:video') || it.src.startsWith('http')))))
                .map(it => ({ src: it.src, trimStart: it.trimStart, trimEnd: it.trimEnd }));
            if (state.backgroundVideos.length === 0) state.backgroundVideos = [];
        }
    }
    if (state.galleryItems.length === 0) state.galleryItems = DEFAULT_GALLERY_ITEMS.slice();
    if (state.backgroundVideos.length === 0) state.backgroundVideos = DEFAULT_BACKGROUND_VIDEOS.slice();
}

/**
 * Init background videos in container. backgroundVideos: array of { src, trimStart?, trimEnd? } or legacy string src.
 * ref: { currentVideoIndex, getActiveItemIndex }.
 */
export function initBackgroundVideos(containerId, backgroundVideos, ref) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const list = Array.isArray(backgroundVideos) ? backgroundVideos : [];
    list.forEach((entry, index) => {
        const src = typeof entry === 'string' ? entry : (entry && entry.src);
        const trimStart = typeof entry === 'object' && entry != null ? entry.trimStart : undefined;
        const trimEnd = typeof entry === 'object' && entry != null ? entry.trimEnd : undefined;
        if (!src) return;
        const video = document.createElement('video');
        video.src = src;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.className = 'background-video';
        if (index === 0) video.classList.add('active');
        container.appendChild(video);
        function clampToTrim() {
            if (trimStart != null && isFinite(trimStart)) video.currentTime = Math.max(trimStart, video.currentTime);
            if (trimEnd != null && isFinite(trimEnd) && video.currentTime >= trimEnd) video.currentTime = trimStart != null ? trimStart : 0;
        }
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
                const nextIndex = (index + 1) % list.length;
                ref.currentVideoIndex = nextIndex;
                const nextVideo = container.children[nextIndex];
                if (nextVideo) {
                    nextVideo.classList.add('active');
                    const nextEntry = list[nextIndex];
                    const nextStart = typeof nextEntry === 'object' && nextEntry && nextEntry.trimStart != null ? nextEntry.trimStart : 0;
                    nextVideo.currentTime = nextStart;
                    nextVideo.play();
                }
            }
        });
    });
}

/**
 * Init gallery track. callbacks: { setActiveItem(index), openContentView(index) }
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
        let mediaElement;
        if (item.type === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.src = item.src;
            mediaElement.muted = true;
            mediaElement.playsInline = true;
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = item.src;
            mediaElement.alt = item.name;
        }
        const caption = document.createElement('div');
        caption.className = 'gallery-caption';
        const inner = document.createElement('div');
        inner.className = 'gallery-caption-inner';
        const number = String(index + 1).padStart(2, '0');
        const numberSpan = document.createElement('span');
        numberSpan.className = 'gallery-caption-number';
        numberSpan.textContent = number;
        const captionText = document.createElement('span');
        captionText.className = 'gallery-caption-text';
        captionText.textContent = item.name;
        inner.appendChild(numberSpan);
        inner.appendChild(captionText);
        caption.appendChild(inner);
        galleryItem.appendChild(caption);
        const mediaWrap = document.createElement('div');
        mediaWrap.className = 'gallery-item-media';
        mediaWrap.appendChild(mediaElement);
        galleryItem.appendChild(mediaWrap);
        galleryItem.addEventListener('mouseenter', () => callbacks.setActiveItem(index));
        galleryItem.addEventListener('click', (e) => { e.stopPropagation(); callbacks.openContentView(index); });
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
