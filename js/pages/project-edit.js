/**
 * Project edit page: load/save via getProject() and saveProject(), playlist UI.
 */
import { escapeHtml, init } from '../core.js';
import { getProjectIdFromURL } from '../projectLoader.js';
import { getProject, saveProject, getProjectDataSync, getProjectList, saveProjectList } from '../storage.js';

const PROJECT_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024;

const projectId = getProjectIdFromURL();
if (!projectId) {
    document.body.innerHTML = '<p>Missing project id.</p><a href="content-management.html" class="back-link">← Back</a>';
    throw new Error('missing id');
}

function getProjectSizeBytes(data) {
    return new Blob([JSON.stringify(data)]).size;
}

let items = [];
let thumbnailDataUrl = null;

function formatTrimTime(s) {
    if (s == null || !isFinite(s)) return '';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
}

function renderItem(item, index) {
    const isFirst = index === 0;
    const isLast = index === items.length - 1;
    const preview = item.type === 'video'
        ? '<video class="preview-video" src="' + escapeHtml(item.src) + '" muted preload="metadata"></video>'
        : '<img class="preview" src="' + escapeHtml(item.src) + '" alt="">';
    const trimLabel = item.type === 'video' && item.trimStart != null && item.trimEnd != null
        ? '<div class="trim-label">Trim ' + formatTrimTime(item.trimStart) + ' – ' + formatTrimTime(item.trimEnd) + '</div>'
        : '';
    return '<li data-index="' + index + '">' +
        '<span class="drag-handle" title="Drag to reorder">⋮⋮</span>' +
        preview +
        '<div class="body"><div class="name">' + escapeHtml(item.name) + '</div>' + trimLabel +
        '<div class="row"><span class="switch-label">Background roster</span>' +
        '<div class="switch ' + (item.backgroundRoster ? 'on' : '') + '" data-index="' + index + '" role="button" tabindex="0"></div></div></div>' +
        '<div class="move-btns">' +
        '<button type="button" class="move-btn" data-dir="up" data-index="' + index + '"' + (isFirst ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="move-btn" data-dir="down" data-index="' + index + '"' + (isLast ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="delete-item-btn" data-index="' + index + '" title="Remove from project">&#128465;</button></div></li>';
}

function render() {
    const ul = document.getElementById('playlist');
    ul.innerHTML = items.map((item, i) => renderItem(item, i)).join('');
    ul.querySelectorAll('.switch').forEach(el => {
        el.addEventListener('click', () => {
            items[parseInt(el.dataset.index, 10)].backgroundRoster = !items[parseInt(el.dataset.index, 10)].backgroundRoster;
            render();
        });
    });
    ul.querySelectorAll('.move-btn').forEach(btn => {
        if (btn.disabled) return;
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            const dir = btn.dataset.dir;
            if (dir === 'up' && idx > 0) {
                [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
            } else if (dir === 'down' && idx < items.length - 1) {
                [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
            }
            render();
        });
    });
    ul.querySelectorAll('.delete-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            const itemName = items[idx] && items[idx].name ? items[idx].name : 'this item';
            if (!confirm('Remove "' + itemName + '" from the project?')) return;
            items.splice(idx, 1);
            render();
        });
    });
    makeSortable(ul);
    updateStorageDisplay();
}

function makeSortable(ul) {
    let draggedIndex = null;
    ul.querySelectorAll('li').forEach((li, index) => {
        const handle = li.querySelector('.drag-handle');
        if (handle) {
            handle.setAttribute('draggable', 'true');
            handle.addEventListener('dragstart', (e) => {
                draggedIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
                e.stopPropagation();
            });
        }
        li.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (draggedIndex === null) return;
            const to = index;
            if (draggedIndex === to) return;
            const moved = items.splice(draggedIndex, 1)[0];
            items.splice(to, 0, moved);
            draggedIndex = to;
            render();
        });
    });
    ul.addEventListener('dragend', () => { draggedIndex = null; });
}

document.getElementById('uploadZone').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('uploadZone').addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
document.getElementById('uploadZone').addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    addFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')));
});
document.getElementById('fileInput').addEventListener('change', (e) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = '';
});

let videoTrimQueue = [];

function openTrimModal(videoSrc, name, onAdd, onCancel) {
    const overlay = document.getElementById('trimOverlay');
    const video = document.getElementById('trimPreviewVideo');
    const startRange = document.getElementById('trimStartRange');
    const endRange = document.getElementById('trimEndRange');
    const startLabel = document.getElementById('trimStartLabel');
    const endLabel = document.getElementById('trimEndLabel');
    const durationLabel = document.getElementById('trimDurationLabel');
    const playPauseBtn = document.getElementById('trimPlayPauseBtn');
    const addBtn = document.getElementById('trimAddBtn');
    const cancelBtn = document.getElementById('trimCancelBtn');
    if (!overlay || !video || !startRange || !endRange) return;

    video.src = videoSrc;
    video.load();
    let duration = 0;
    let trimStart = 0;
    let trimEnd = 10;
    let trimTimeupdate = null;

    function formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return m + ':' + String(sec).padStart(2, '0');
    }

    function updateLabels() {
        startLabel.textContent = 'Start: ' + formatTime(trimStart);
        endLabel.textContent = 'End: ' + formatTime(trimEnd);
        durationLabel.textContent = 'Duration: ' + formatTime(Math.max(0, trimEnd - trimStart));
    }

    function applyTrimToInputs() {
        startRange.value = trimStart;
        endRange.value = trimEnd;
        updateLabels();
    }

    video.addEventListener('loadedmetadata', () => {
        duration = video.duration;
        if (!isFinite(duration) || duration <= 0) duration = 60;
        trimEnd = Math.min(trimEnd, duration);
        startRange.max = duration;
        startRange.value = 0;
        endRange.max = duration;
        endRange.value = trimEnd;
        trimStart = 0;
        applyTrimToInputs();
    });

    startRange.addEventListener('input', () => {
        trimStart = parseFloat(startRange.value) || 0;
        if (trimStart >= trimEnd) trimEnd = Math.min(trimStart + 1, duration);
        endRange.min = trimStart;
        endRange.value = trimEnd;
        video.currentTime = trimStart;
        updateLabels();
    });
    endRange.addEventListener('input', () => {
        trimEnd = parseFloat(endRange.value) || duration;
        if (trimEnd <= trimStart) trimStart = Math.max(0, trimEnd - 1);
        startRange.max = trimEnd;
        startRange.value = trimStart;
        updateLabels();
    });

    trimTimeupdate = () => {
        if (video.currentTime >= trimEnd) {
            video.pause();
            video.currentTime = trimStart;
            playPauseBtn.textContent = 'Play';
        }
    };
    video.addEventListener('timeupdate', trimTimeupdate);

    playPauseBtn.onclick = () => {
        if (video.paused) {
            video.currentTime = Math.max(trimStart, video.currentTime);
            if (video.currentTime >= trimEnd) video.currentTime = trimStart;
            video.play();
            playPauseBtn.textContent = 'Pause';
        } else {
            video.pause();
            playPauseBtn.textContent = 'Play';
        }
    };

    addBtn.onclick = () => {
        video.pause();
        video.removeEventListener('timeupdate', trimTimeupdate);
        overlay.classList.remove('visible');
        video.src = '';
        onAdd({ trimStart, trimEnd });
    };

    cancelBtn.onclick = () => {
        video.pause();
        video.removeEventListener('timeupdate', trimTimeupdate);
        overlay.classList.remove('visible');
        video.src = '';
        onCancel();
    };

    overlay.classList.add('visible');
    updateLabels();
}

function addFiles(files) {
    if (files.length === 0) return;
    const currentData = { name: getProjectDataSync(projectId).name, items: items.slice() };
    let addSize = 0;
    for (let i = 0; i < files.length; i++) addSize += files[i].size || 0;
    if (getProjectSizeBytes(currentData) + addSize > PROJECT_STORAGE_LIMIT_BYTES) {
        alert('Adding these files would exceed the project storage limit of ' + (PROJECT_STORAGE_LIMIT_BYTES / (1024 * 1024)).toFixed(0) + ' MB. Remove some content or add smaller files.');
        return;
    }
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    imageFiles.forEach(file => {
        const name = file.name || 'Untitled';
        const reader = new FileReader();
        reader.onload = () => {
            items.push({ type: 'image', src: reader.result, name, backgroundRoster: false });
            render();
        };
        reader.readAsDataURL(file);
    });
    if (videoFiles.length === 0) return;
    videoTrimQueue = videoFiles.slice();
    function processNextVideo() {
        if (videoTrimQueue.length === 0) {
            render();
            return;
        }
        const file = videoTrimQueue.shift();
        const name = file.name || 'Untitled';
        const reader = new FileReader();
        reader.onload = () => {
            const videoSrc = reader.result;
            openTrimModal(videoSrc, name, (trim) => {
                items.push({
                    type: 'video',
                    src: videoSrc,
                    name,
                    backgroundRoster: false,
                    trimStart: trim.trimStart,
                    trimEnd: trim.trimEnd
                });
                processNextVideo();
            }, () => {
                processNextVideo();
            });
        };
        reader.onerror = () => processNextVideo();
        reader.readAsDataURL(file);
    }
    processNextVideo();
}

function updateStorageDisplay() {
    const data = getProjectDataSync(projectId);
    data.items = items;
    const bytes = getProjectSizeBytes(data);
    const el = document.getElementById('storageUsage');
    if (el) el.textContent = 'Storage: ' + (bytes / (1024 * 1024)).toFixed(1) + ' / ' + (PROJECT_STORAGE_LIMIT_BYTES / (1024 * 1024)).toFixed(0) + ' MB';
}

function updateThumbnailPreview(src) {
    const preview = document.getElementById('thumbnailPreview');
    const placeholder = document.getElementById('thumbnailPlaceholder');
    const clearBtn = document.getElementById('thumbnailClearBtn');
    if (preview) { preview.src = src || ''; preview.style.display = src ? 'block' : 'none'; }
    if (placeholder) placeholder.style.display = src ? 'none' : 'block';
    if (clearBtn) clearBtn.style.display = src ? 'inline-block' : 'none';
}

document.getElementById('thumbnailChooseBtn').addEventListener('click', () => document.getElementById('thumbnailInput').click());
document.getElementById('thumbnailInput').addEventListener('change', (e) => {
    const file = (e.target.files || [])[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
        thumbnailDataUrl = reader.result;
        updateThumbnailPreview(thumbnailDataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});
document.getElementById('thumbnailClearBtn').addEventListener('click', () => {
    thumbnailDataUrl = null;
    updateThumbnailPreview(null);
});

document.getElementById('saveBtn').addEventListener('click', () => {
    const btn = document.getElementById('saveBtn');
    const originalText = btn.textContent;
    const data = getProjectDataSync(projectId);
    data.items = items;
    data.name = (document.getElementById('projectNameInput') || {}).value || data.name || ('Project ' + projectId);
    data.storyline = (document.getElementById('projectStoryline') || {}).value || '';
    data.thumbnail = thumbnailDataUrl;
    if (getProjectSizeBytes(data) > PROJECT_STORAGE_LIMIT_BYTES) {
        alert('Project size exceeds the 100 MB limit. Remove some content to save.');
        return;
    }
    btn.textContent = 'Saving…';
    btn.disabled = true;
    saveProject({ id: projectId, name: data.name, items: data.items, storyline: data.storyline, thumbnail: data.thumbnail }).then(() => {
        const list = getProjectList();
        const idx = list.findIndex(p => String(p.id) === String(projectId));
        const entry = { id: projectId, name: data.name, thumbnail: data.thumbnail || null };
        if (idx >= 0) {
            list[idx] = Object.assign(list[idx], entry);
        } else {
            list.push(entry);
        }
        saveProjectList(list);
        btn.textContent = 'Saved';
        setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 1500);
    }).catch((e) => {
        btn.textContent = e.name === 'QuotaExceededError' ? 'Storage full' : 'Error';
        btn.disabled = false;
        setTimeout(() => { btn.textContent = originalText; }, 2000);
    });
});

document.getElementById('pageTitle').textContent = 'Edit Project ' + projectId;

(function init() {
    getProject(projectId).then(record => {
        if (record && record.items && record.items.length >= 0) {
            items = record.items.slice();
            if (record.name) document.getElementById('pageTitle').textContent = 'Edit ' + record.name;
            const nameEl = document.getElementById('projectNameInput');
            if (nameEl && record.name != null) nameEl.value = record.name || '';
            const storyEl = document.getElementById('projectStoryline');
            if (storyEl && record.storyline != null) storyEl.value = record.storyline || '';
            if (record.thumbnail) { thumbnailDataUrl = record.thumbnail; updateThumbnailPreview(thumbnailDataUrl); }
        } else {
            const fallback = getProjectDataSync(projectId);
            items = (fallback.items || []).slice();
            const nameEl = document.getElementById('projectNameInput');
            if (nameEl && fallback.name != null) nameEl.value = fallback.name || '';
            const storyEl = document.getElementById('projectStoryline');
            if (storyEl && fallback.storyline != null) storyEl.value = fallback.storyline || '';
            if (fallback.thumbnail) { thumbnailDataUrl = fallback.thumbnail; updateThumbnailPreview(thumbnailDataUrl); }
        }
        render();
    }).catch(() => {
        const fallback = getProjectDataSync(projectId);
        items = (fallback.items || []).slice();
        const nameEl = document.getElementById('projectNameInput');
        if (nameEl && fallback.name != null) nameEl.value = fallback.name || '';
        const storyEl = document.getElementById('projectStoryline');
        if (storyEl && fallback.storyline != null) storyEl.value = fallback.storyline || '';
        if (fallback.thumbnail) { thumbnailDataUrl = fallback.thumbnail; updateThumbnailPreview(thumbnailDataUrl); }
        render();
    });
})();

init();
