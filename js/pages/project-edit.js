/**
 * Project edit page: load/save via getProject() and saveProject(), playlist UI.
 */
import { escapeHtml, init } from '../core.js';
import { getProjectIdFromURL } from '../projectLoader.js';
import { getProject, saveProject, getProjectDataSync } from '../storage.js';

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

function renderItem(item, index) {
    const isFirst = index === 0;
    const isLast = index === items.length - 1;
    const preview = item.type === 'video'
        ? '<video class="preview-video" src="' + escapeHtml(item.src) + '" muted preload="metadata"></video>'
        : '<img class="preview" src="' + escapeHtml(item.src) + '" alt="">';
    return '<li data-index="' + index + '">' +
        '<span class="drag-handle" title="Drag to reorder">⋮⋮</span>' +
        preview +
        '<div class="body"><div class="name">' + escapeHtml(item.name) + '</div>' +
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

function addFiles(files) {
    if (files.length === 0) return;
    const currentData = { name: getProjectDataSync(projectId).name, items: items.slice() };
    let addSize = 0;
    for (let i = 0; i < files.length; i++) addSize += files[i].size || 0;
    if (getProjectSizeBytes(currentData) + addSize > PROJECT_STORAGE_LIMIT_BYTES) {
        alert('Adding these files would exceed the project storage limit of ' + (PROJECT_STORAGE_LIMIT_BYTES / (1024 * 1024)).toFixed(0) + ' MB. Remove some content or add smaller files.');
        return;
    }
    let pending = files.length;
    files.forEach(file => {
        const type = file.type.startsWith('video/') ? 'video' : 'image';
        const name = file.name || 'Untitled';
        const reader = new FileReader();
        reader.onload = () => {
            items.push({ type, src: reader.result, name, backgroundRoster: false });
            if (--pending === 0) render();
        };
        reader.onerror = () => { if (--pending === 0) render(); };
        reader.readAsDataURL(file);
    });
}

function updateStorageDisplay() {
    const data = getProjectDataSync(projectId);
    data.items = items;
    const bytes = getProjectSizeBytes(data);
    const el = document.getElementById('storageUsage');
    if (el) el.textContent = 'Storage: ' + (bytes / (1024 * 1024)).toFixed(1) + ' / ' + (PROJECT_STORAGE_LIMIT_BYTES / (1024 * 1024)).toFixed(0) + ' MB';
}

document.getElementById('saveBtn').addEventListener('click', () => {
    const btn = document.getElementById('saveBtn');
    const originalText = btn.textContent;
    const data = getProjectDataSync(projectId);
    data.items = items;
    data.name = (document.getElementById('projectNameInput') || {}).value || data.name || ('Project ' + projectId);
    data.storyline = (document.getElementById('projectStoryline') || {}).value || '';
    if (getProjectSizeBytes(data) > PROJECT_STORAGE_LIMIT_BYTES) {
        alert('Project size exceeds the 100 MB limit. Remove some content to save.');
        return;
    }
    btn.textContent = 'Saving…';
    btn.disabled = true;
    saveProject({ id: projectId, name: data.name, items: data.items, storyline: data.storyline }).then(() => {
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
        } else {
            const fallback = getProjectDataSync(projectId);
            items = (fallback.items || []).slice();
            const nameEl = document.getElementById('projectNameInput');
            if (nameEl && fallback.name != null) nameEl.value = fallback.name || '';
            const storyEl = document.getElementById('projectStoryline');
            if (storyEl && fallback.storyline != null) storyEl.value = fallback.storyline || '';
        }
        render();
    }).catch(() => {
        const fallback = getProjectDataSync(projectId);
        items = (fallback.items || []).slice();
        const nameEl = document.getElementById('projectNameInput');
        if (nameEl && fallback.name != null) nameEl.value = fallback.name || '';
        const storyEl = document.getElementById('projectStoryline');
        if (storyEl && fallback.storyline != null) storyEl.value = fallback.storyline || '';
        render();
    });
})();

init();
