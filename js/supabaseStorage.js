/**
 * Upload project media to Supabase Storage so the project JSON stays under the API body limit.
 * Uses GET /api/config for Supabase URL and anon key, then uploads to bucket "project-media".
 */

const BUCKET = 'project-media';
let clientPromise = null;

async function getClient() {
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
        const res = await fetch('/api/config');
        const { supabaseUrl, supabaseAnonKey } = await res.json();
        if (!supabaseUrl || !supabaseAnonKey) return null;
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        return createClient(supabaseUrl, supabaseAnonKey);
    })();
    return clientPromise;
}

function makePath(projectId, filename) {
    const safe = String(projectId).replace(/[^a-zA-Z0-9-_]/g, '_');
    const unique = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const base = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${safe}/${unique}-${base}`;
}

/**
 * Upload a File (e.g. image) to Supabase Storage. Returns public URL or null on failure.
 * @param {string} projectId
 * @param {File} file
 * @param {{ onStart?: (bytes: number) => void, onDone?: (bytes: number) => void }} [progress]
 * @returns {Promise<string|null>}
 */
export async function uploadFile(projectId, file, progress) {
    const size = file && file.size || 0;
    if (progress && progress.onStart) progress.onStart(size);
    const supabase = await getClient();
    if (!supabase) {
        if (progress && progress.onDone) progress.onDone(size);
        return null;
    }
    const path = makePath(projectId, file.name || 'file');
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false
    });
    if (progress && progress.onDone) progress.onDone(size);
    if (error) {
        console.warn('Supabase upload error:', error);
        return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

/**
 * Upload a Blob (e.g. trimmed video WebM) to Supabase Storage. Returns public URL or null.
 * @param {string} projectId
 * @param {Blob} blob
 * @param {string} filename - e.g. 'clip.webm'
 * @param {{ onStart?: (bytes: number) => void, onDone?: (bytes: number) => void }} [progress]
 * @returns {Promise<string|null>}
 */
export async function uploadBlob(projectId, blob, filename, progress) {
    const size = blob && blob.size || 0;
    if (progress && progress.onStart) progress.onStart(size);
    const supabase = await getClient();
    if (!supabase) {
        if (progress && progress.onDone) progress.onDone(size);
        return null;
    }
    const path = makePath(projectId, filename);
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: blob.type || undefined,
        upsert: false
    });
    if (progress && progress.onDone) progress.onDone(size);
    if (error) {
        console.warn('Supabase upload error:', error);
        return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

/**
 * Upload a data URL (e.g. from FileReader or thumbnail) to Supabase Storage. Returns public URL or null.
 * @param {string} projectId
 * @param {string} dataUrl
 * @param {string} filename - e.g. 'thumbnail.jpg', 'clip.webm'
 * @param {{ onStart?: (bytes: number) => void, onDone?: (bytes: number) => void }} [progress]
 * @returns {Promise<string|null>}
 */
export async function uploadDataUrl(projectId, dataUrl, filename, progress) {
    if (!dataUrl || !dataUrl.startsWith('data:')) return null;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return uploadBlob(projectId, blob, filename, progress);
}

/**
 * Check if Supabase Storage is available (config returns keys).
 * @returns {Promise<boolean>}
 */
export async function isStorageAvailable() {
    const supabase = await getClient();
    return supabase != null;
}
