/**
 * Load/save project data. Primary: GET/POST /api/projects. Fallback: IndexedDB + localStorage.
 */
import { IDB_NAME, IDB_STORE, CMS_PROJECT_PREFIX, CMS_LIST_KEY } from './core.js';

export function openDB() {
    return new Promise((resolve, reject) => {
        const r = indexedDB.open(IDB_NAME, 1);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => resolve(r.result);
        r.onupgradeneeded = (e) => {
            if (!e.target.result.objectStoreNames.contains(IDB_STORE)) {
                e.target.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
            }
        };
    });
}

function getProjectFromIDB(id) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(id);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result || null);
    }));
}

function setProjectInIDB(id, data) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put({ id: id, name: data.name, items: data.items || [], storyline: data.storyline || '', storylineTitle: data.storylineTitle || '', thumbnail: data.thumbnail || null, assets: data.assets || [], defaultBackgroundUrl: data.defaultBackgroundUrl || null });
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve();
    }));
}

/**
 * Load a project by id. Tries GET /api/projects/:id, then IndexedDB, then localStorage.
 * @param {string} id - Project id.
 * @returns {Promise<object|null>} Resolves with { id, name, items, storyline } or null.
 */
export function getProject(id) {
    const idStr = String(id);
    return fetch(`/api/projects/${encodeURIComponent(idStr)}`)
        .then(res => {
            if (res.ok) return res.json();
            throw new Error(res.statusText || 'get failed');
        })
        .then(data => ({
            id: data.id != null ? data.id : idStr,
            name: data.name ?? `Project ${idStr}`,
            items: Array.isArray(data.items) ? data.items : [],
            storyline: data.storyline ?? '',
            storylineTitle: data.storylineTitle ?? '',
            thumbnail: data.thumbnail ?? null,
            assets: Array.isArray(data.assets) ? data.assets : [],
            defaultBackgroundUrl: data.defaultBackgroundUrl ?? null
        }))
        .catch(() => getProjectFromIDB(idStr)
            .then(record => record ? { id: record.id, name: record.name, items: record.items || [], storyline: record.storyline || '', storylineTitle: record.storylineTitle || '', thumbnail: record.thumbnail || null, assets: record.assets || [], defaultBackgroundUrl: record.defaultBackgroundUrl || null } : null)
            .catch(() => null))
        .then(data => {
            if (data) return data;
            try {
                const raw = localStorage.getItem(CMS_PROJECT_PREFIX + idStr);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    return { id: idStr, name: parsed.name, items: parsed.items || [], storyline: parsed.storyline || '', storylineTitle: parsed.storylineTitle || '', thumbnail: parsed.thumbnail || null, assets: Array.isArray(parsed.assets) ? parsed.assets : [], defaultBackgroundUrl: parsed.defaultBackgroundUrl || null };
                }
            } catch (e) {}
            return null;
        });
}

/**
 * Save a project. Tries POST /api/projects, then fallback: IndexedDB + localStorage.
 * @param {object} project - { id, name, items, storyline }.
 * @returns {Promise<void>}
 */
export function saveProject(project) {
    const id = project.id != null ? String(project.id) : '';
    const payload = { id, name: project.name ?? `Project ${id}`, items: project.items || [], storyline: project.storyline ?? '', storylineTitle: project.storylineTitle ?? '', thumbnail: project.thumbnail ?? null, assets: project.assets || [], defaultBackgroundUrl: project.defaultBackgroundUrl ?? null };
    return fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(async (res) => {
            if (res.ok) {
                // Keep IndexedDB and localStorage in sync with the server after successful save
                return setProjectInIDB(id, payload).then(() => {
                    try { localStorage.setItem(CMS_PROJECT_PREFIX + id, JSON.stringify(payload)); } catch (e) {}
                });
            }
            const msg = res.status === 413
                ? 'Project too large to sync (over 4.5 MB). Save works on this device only.'
                : (await res.text()) || res.statusText || 'Save failed';
            throw new Error(msg);
        })
        .catch((err) => {
            return setProjectInIDB(id, payload).then(() => {
                try { localStorage.setItem(CMS_PROJECT_PREFIX + id, JSON.stringify(payload)); } catch (e) {}
            }).then(() => { throw err; });
        });
}

export function deleteProjectFromIDB(id) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(String(id));
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve();
    }));
}

/** Sync read from localStorage only (for UI that needs current name/size without async). */
export function getProjectDataSync(projectId) {
    try {
        const raw = localStorage.getItem(CMS_PROJECT_PREFIX + projectId);
        const def = { name: `Project ${projectId}`, items: [], storyline: '', storylineTitle: '', thumbnail: null, defaultBackgroundUrl: null, assets: [] };
        return raw ? Object.assign(def, JSON.parse(raw)) : def;
    } catch (e) {
        return { name: `Project ${projectId}`, items: [], storyline: '', storylineTitle: '', thumbnail: null, defaultBackgroundUrl: null, assets: [] };
    }
}

export function getProjectList() {
    try {
        const raw = localStorage.getItem(CMS_LIST_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

/**
 * Fetch project list from API (id, name, thumbnail). Use on load so project cards and CMS list show on all devices.
 * @returns {Promise<Array<{id, name, thumbnail}>>}
 */
export function fetchProjectList() {
    return fetch('/api/projects')
        .then(res => res.ok ? res.json() : [])
        .catch(() => []);
}

export function saveProjectList(list) {
    localStorage.setItem(CMS_LIST_KEY, JSON.stringify(list));
}
