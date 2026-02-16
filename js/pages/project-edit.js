/**
 * Project edit page: load/save via getProject() and saveProject(), playlist UI.
 */
import { escapeHtml, init } from '../core.js';
import { getProjectIdFromURL } from '../projectLoader.js';
import { getProject, saveProject, getProjectDataSync, getProjectList, saveProjectList } from '../storage.js';

const PROJECT_STORAGE_LIMIT_BYTES = 300 * 1024 * 1024;

const projectId = getProjectIdFromURL();
if (!projectId) {
    document.body.innerHTML = '<p>Missing project id.</p><a href="content-management.html" class="back-link">← Back</a>';
    throw new Error('missing id');
}

function getProjectSizeBytes(data) {
    return new Blob([JSON.stringify(data)]).size;
}

let items = [];
let assets = [];
let thumbnailDataUrl = null;

function getItemSrc(item) {
    if (item.src) return item.src;
    if (item.assetId && assets.length) {
        const a = assets.find(aa => aa.id === item.assetId);
        return a ? a.src : '';
    }
    return '';
}

function formatTrimTime(s) {
    if (s == null || !isFinite(s)) return '';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
}

function renderItem(item, index) {
    const isFirst = index === 0;
    const isLast = index === items.length - 1;
    const src = getItemSrc(item);
    const preview = item.type === 'video'
        ? '<video class="preview-video" src="' + escapeHtml(src) + '" muted preload="metadata"></video>'
        : '<img class="preview" src="' + escapeHtml(src) + '" alt="">';
    const trimLabel = item.type === 'video' && item.trimStart != null && item.trimEnd != null
        ? '<div class="trim-label">Trim ' + formatTrimTime(item.trimStart) + ' – ' + formatTrimTime(item.trimEnd) + '</div>'
        : '';
    return '<li data-index="' + index + '">' +
        '<span class="drag-handle" title="Drag to reorder">⋮⋮</span>' +
        preview +
        '<div class="body"><div class="item-name" data-index="' + index + '" contenteditable="true" title="Click to rename">' + escapeHtml(item.name) + '</div>' + trimLabel +
        (item.storyline != null && item.storyline !== '' ? '<div class="item-storyline-preview" title="Content storyline">' + escapeHtml(String(item.storyline).slice(0, 60)) + (item.storyline.length > 60 ? '…' : '') + '</div>' : '') +
        '<div class="row"><span class="switch-label">Background roster</span>' +
        '<div class="switch ' + (item.backgroundRoster ? 'on' : '') + '" data-index="' + index + '" role="button" tabindex="0"></div></div>' +
        '<div class="row storyline-row"><label class="switch-label">Storyline (on preview)</label></div>' +
        '<textarea class="item-storyline" data-index="' + index + '" placeholder="Text shown in storyline when this content is previewed">' + escapeHtml((item.storyline != null ? item.storyline : '')) + '</textarea></div>' +
        '<div class="move-btns">' +
        '<button type="button" class="replace-item-btn" data-index="' + index + '" title="Replace media">Replace</button>' +
        (item.type === 'video' ? '<button type="button" class="retrim-item-btn" data-index="' + index + '" title="Change trim">Re-trim</button>' : '') +
        (item.type === 'video' ? '<button type="button" class="addcut-item-btn" data-index="' + index + '" title="Add another cut from this video (same file, new trim)">Add cut</button>' : '') +
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
    ul.querySelectorAll('.replace-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            if (isNaN(idx) || !items[idx]) return;
            replaceIndex = idx;
            const input = document.getElementById('replaceFileInput');
            if (input) {
                input.accept = items[idx].type === 'image' ? 'image/*' : 'video/*';
                input.value = '';
                input.click();
            }
        });
    });
    ul.querySelectorAll('.retrim-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            if (isNaN(idx) || !items[idx] || items[idx].type !== 'video') return;
            const it = items[idx];
            const src = getItemSrc(it);
            if (!src) return;
            openTrimModal(src, it.name, null, (trim) => {
                if (!trim.trimmedDataUrl) return;
                const data = getProjectDataSync(projectId);
                data.assets = assets;
                const nextItems = items.slice();
                nextItems[idx] = { ...it, src: trim.trimmedDataUrl, trimStart: 0, trimEnd: null };
                delete nextItems[idx].assetId;
                data.items = nextItems;
                if (getProjectSizeBytes(data) > PROJECT_STORAGE_LIMIT_BYTES) {
                    alert('The trimmed clip would exceed the project storage limit. Choose a shorter segment.');
                    return;
                }
                items[idx].src = trim.trimmedDataUrl;
                items[idx].trimStart = 0;
                items[idx].trimEnd = null;
                delete items[idx].assetId;
                render();
            }, () => {});
        });
    });
    ul.querySelectorAll('.addcut-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            if (isNaN(idx) || !items[idx] || items[idx].type !== 'video') return;
            const item = items[idx];
            const src = getItemSrc(item);
            if (!src) return;
            if (!item.assetId) {
                const assetId = 'a' + Date.now();
                assets.push({ id: assetId, type: 'video', src });
                item.assetId = assetId;
                delete item.src;
            }
            const newIdx = idx + 1;
            const newItem = {
                type: 'video',
                assetId: item.assetId,
                name: (item.name || 'Untitled') + ' (2)',
                trimStart: 0,
                trimEnd: null,
                storyline: '',
                backgroundRoster: false
            };
            openTrimModal(src, newItem.name, null, (trim) => {
                if (!trim.trimmedDataUrl) return;
                newItem.src = trim.trimmedDataUrl;
                delete newItem.assetId;
                const data = getProjectDataSync(projectId);
                data.items = items.slice();
                data.items.splice(newIdx, 0, newItem);
                data.assets = assets;
                if (getProjectSizeBytes(data) > PROJECT_STORAGE_LIMIT_BYTES) {
                    alert('The trimmed clip would exceed the project storage limit. Choose a shorter segment.');
                    return;
                }
                items.splice(newIdx, 0, newItem);
                render();
            }, () => {});
        });
    });
    ul.querySelectorAll('.item-name').forEach(el => {
        const idx = parseInt(el.dataset.index, 10);
        if (isNaN(idx) || !items[idx]) return;
        el.addEventListener('blur', () => {
            const name = (el.textContent || '').trim() || items[idx].name;
            items[idx].name = name;
        });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });
    });
    ul.querySelectorAll('.item-storyline').forEach(el => {
        const idx = parseInt(el.dataset.index, 10);
        if (isNaN(idx) || !items[idx]) return;
        items[idx].storyline = el.value;
        el.addEventListener('input', () => { items[idx].storyline = el.value; });
        el.addEventListener('change', () => { items[idx].storyline = el.value; });
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

document.getElementById('replaceFileInput').addEventListener('change', (e) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    const idx = replaceIndex;
    replaceIndex = null;
    if (idx == null || isNaN(idx) || !items[idx] || !file) return;
    const item = items[idx];
    if (item.type === 'image') {
        if (!file.type.startsWith('image/')) {
            alert('Please choose an image file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const newSrc = reader.result;
            const data = getProjectDataSync(projectId);
            data.assets = assets;
            const nextItems = items.slice();
            nextItems[idx] = { ...item, src: newSrc };
            data.items = nextItems;
            if (getProjectSizeBytes(data) > PROJECT_STORAGE_LIMIT_BYTES) {
                alert('Replacing would exceed the project storage limit. Choose a smaller file or remove some content.');
                return;
            }
            items[idx].src = newSrc;
            render();
        };
        reader.readAsDataURL(file);
    } else {
        if (!file.type.startsWith('video/')) {
            alert('Please choose a video file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const videoSrc = reader.result;
            openTrimModal(videoSrc, file.name || item.name, file.size, (trim) => {
                const trimmedDataUrl = trim.trimmedDataUrl;
                if (!trimmedDataUrl) return;
                const data = getProjectDataSync(projectId);
                data.assets = assets;
                const nextItems = items.slice();
                nextItems[idx] = { ...item, src: trimmedDataUrl, trimStart: 0, trimEnd: null };
                delete nextItems[idx].assetId;
                data.items = nextItems;
                if (getProjectSizeBytes(data) > PROJECT_STORAGE_LIMIT_BYTES) {
                    alert('Replacing would exceed the project storage limit. Choose a shorter segment or remove some content.');
                    return;
                }
                items[idx].src = trimmedDataUrl;
                delete items[idx].assetId;
                items[idx].trimStart = 0;
                items[idx].trimEnd = null;
                render();
            }, () => {});
        };
        reader.readAsDataURL(file);
    }
});

let videoTrimQueue = [];
let replaceIndex = null;

/**
 * Export the segment [trimStart, trimEnd] from a video source to a new WebM blob (actual trim).
 * Returns a Promise that resolves with the segment as a data URL, or rejects on error.
 */
function exportVideoSegment(videoSrc, trimStart, trimEnd) {
    return new Promise((resolve, reject) => {
        if (!window.MediaRecorder || typeof document.createElement('video').captureStream !== 'function') {
            reject(new Error('Your browser does not support recording the trimmed clip. Try Chrome or Edge.'));
            return;
        }
        const segDuration = Math.max(0.1, (trimEnd - trimStart));
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.crossOrigin = 'anonymous';
        video.src = videoSrc;

        const onError = (e) => {
            cleanup();
            reject(e && e.message ? new Error(e.message) : new Error('Failed to export clip'));
        };

        function cleanup() {
            video.removeEventListener('error', onError);
            video.removeEventListener('loadedmetadata', onMeta);
            video.removeEventListener('seeked', onSeeked);
            video.src = '';
            video.load();
        }

        function onMeta() {
            video.currentTime = trimStart;
        }

        function onSeeked() {
            video.removeEventListener('seeked', onSeeked);
            let stream;
            try {
                stream = video.captureStream ? video.captureStream(0) : video.mozCaptureStream ? video.mozCaptureStream() : null;
            } catch (err) {
                onError(err);
                return;
            }
            if (!stream) {
                onError(new Error('Could not capture video stream'));
                return;
            }
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
            const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
            const chunks = [];
            recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                cleanup();
                const blob = new Blob(chunks, { type: mimeType });
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Failed to read exported clip'));
                reader.readAsDataURL(blob);
            };
            recorder.onerror = () => {
                cleanup();
                reject(new Error('Recording failed'));
            };
            recorder.start(100);
            video.play().catch(onError);
            setTimeout(() => {
                video.pause();
                if (recorder.state === 'recording') recorder.stop();
            }, segDuration * 1000 + 200);
        }

        video.addEventListener('error', onError);
        video.addEventListener('loadedmetadata', onMeta);
        video.addEventListener('seeked', onSeeked);
        video.load();
    });
}

function openTrimModal(videoSrc, name, fileSizeBytes, onAdd, onCancel) {
    const overlay = document.getElementById('trimOverlay');
    const video = document.getElementById('trimPreviewVideo');
    const startRange = document.getElementById('trimStartRange');
    const endRange = document.getElementById('trimEndRange');
    const startLabel = document.getElementById('trimStartLabel');
    const endLabel = document.getElementById('trimEndLabel');
    const durationLabel = document.getElementById('trimDurationLabel');
    const sizeLabel = document.getElementById('trimSizeLabel');
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
    var fileSize = (fileSizeBytes != null && isFinite(fileSizeBytes)) ? fileSizeBytes : 0;

    function formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return m + ':' + String(sec).padStart(2, '0');
    }

    function formatSize(bytes) {
        if (!bytes) return '—';
        if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return bytes + ' B';
    }

    function updateLabels() {
        startLabel.textContent = 'Start: ' + formatTime(trimStart);
        endLabel.textContent = 'End: ' + formatTime(trimEnd);
        durationLabel.textContent = 'Duration: ' + formatTime(Math.max(0, trimEnd - trimStart));
        if (sizeLabel) {
            var fullSize = formatSize(fileSize);
            if (duration > 0 && fileSize > 0 && trimEnd > trimStart) {
                var segmentRatio = (trimEnd - trimStart) / duration;
                var segmentBytes = Math.round(fileSize * segmentRatio);
                sizeLabel.textContent = 'Size: ' + fullSize + ' (trimmed: ~' + formatSize(segmentBytes) + ')';
            } else {
                sizeLabel.textContent = 'Size: ' + fullSize;
            }
        }
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
        const origLabel = addBtn.textContent;
        addBtn.textContent = 'Preparing clip…';
        addBtn.disabled = true;
        exportVideoSegment(videoSrc, trimStart, trimEnd)
            .then((trimmedDataUrl) => {
                video.removeEventListener('timeupdate', trimTimeupdate);
                overlay.classList.remove('visible');
                video.src = '';
                onAdd({ trimmedDataUrl });
            })
            .catch((err) => {
                addBtn.textContent = origLabel;
                addBtn.disabled = false;
                alert(err && err.message ? err.message : 'Could not create trimmed clip. Try a shorter segment or another browser.');
            });
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
    const currentData = { name: getProjectDataSync(projectId).name, items: items.slice(), assets: assets.slice() };
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
            openTrimModal(videoSrc, name, file.size, (trim) => {
                const trimmedDataUrl = trim.trimmedDataUrl;
                if (!trimmedDataUrl) return processNextVideo();
                const newItem = {
                    type: 'video',
                    src: trimmedDataUrl,
                    name,
                    backgroundRoster: false,
                    trimStart: 0,
                    trimEnd: null
                };
                const data = getProjectDataSync(projectId);
                data.items = items.concat([newItem]);
                data.assets = assets;
                if (getProjectSizeBytes(data) > PROJECT_STORAGE_LIMIT_BYTES) {
                    alert('The trimmed clip would exceed the project storage limit. Remove some content or choose a shorter segment.');
                    processNextVideo();
                    return;
                }
                items.push(newItem);
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
    data.assets = assets;
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
    data.assets = assets;
    data.name = (document.getElementById('projectNameInput') || {}).value || data.name || ('Project ' + projectId);
    data.storyline = (document.getElementById('projectStoryline') || {}).value || '';
    data.thumbnail = thumbnailDataUrl;
    if (getProjectSizeBytes(data) > PROJECT_STORAGE_LIMIT_BYTES) {
        alert('Project size exceeds the ' + (PROJECT_STORAGE_LIMIT_BYTES / (1024 * 1024)).toFixed(0) + ' MB limit. Remove some content to save.');
        return;
    }
    btn.textContent = 'Saving…';
    btn.disabled = true;
    saveProject({ id: projectId, name: data.name, items: data.items, storyline: data.storyline, thumbnail: data.thumbnail, assets: data.assets }).then(() => {
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
            assets = Array.isArray(record.assets) ? record.assets.slice() : [];
            if (record.name) document.getElementById('pageTitle').textContent = 'Edit ' + record.name;
            const nameEl = document.getElementById('projectNameInput');
            if (nameEl && record.name != null) nameEl.value = record.name || '';
            const storyEl = document.getElementById('projectStoryline');
            if (storyEl && record.storyline != null) storyEl.value = record.storyline || '';
            if (record.thumbnail) { thumbnailDataUrl = record.thumbnail; updateThumbnailPreview(thumbnailDataUrl); }
        } else {
            const fallback = getProjectDataSync(projectId);
            items = (fallback.items || []).slice();
            assets = Array.isArray(fallback.assets) ? fallback.assets.slice() : [];
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
        assets = Array.isArray(fallback.assets) ? fallback.assets.slice() : [];
        const nameEl = document.getElementById('projectNameInput');
        if (nameEl && fallback.name != null) nameEl.value = fallback.name || '';
        const storyEl = document.getElementById('projectStoryline');
        if (storyEl && fallback.storyline != null) storyEl.value = fallback.storyline || '';
        if (fallback.thumbnail) { thumbnailDataUrl = fallback.thumbnail; updateThumbnailPreview(thumbnailDataUrl); }
        render();
    });
})();

init();
