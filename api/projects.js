import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return createClient(url, key);
}

/**
 * POST /api/projects — upsert a project into Supabase.
 * Body: { id, name, items, storyline, thumbnail }
 */
export async function POST(request) {
    if (request.headers.get('Content-Type')?.toLowerCase().includes('application/json') !== true) {
        return new Response(JSON.stringify({ error: 'Content-Type: application/json required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    const id = body.id != null ? String(body.id) : '';
    if (!id) {
        return new Response(JSON.stringify({ error: 'Project id required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    const payload = {
        id,
        name: body.name ?? `Project ${id}`,
        items: Array.isArray(body.items) ? body.items : [],
        storyline: body.storyline ?? '',
        thumbnail: body.thumbnail ?? null
    };
    try {
        const supabase = getSupabase();
        const { error } = await supabase
            .from('projects')
            .upsert(payload, { onConflict: 'id' });
        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e.message) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
