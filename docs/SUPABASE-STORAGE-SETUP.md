# Supabase Storage setup for project media

So that project media (images, videos, thumbnails) are stored in Supabase instead of in the project JSON, the app uploads files to a **Supabase Storage** bucket and saves only URLs in the database. That keeps the payload under the 4.5 MB API limit and lets projects sync across devices.

## 1. Create the bucket

1. In **Supabase** go to **Storage** in the left sidebar.
2. Click **New bucket**.
3. Name: **project-media** (must match the app).
4. Turn **Public bucket** **ON** so the project page can load images/videos by URL.
5. Click **Create bucket**.

## 2. Allow uploads (RLS policies)

The frontend uses the **anon** key to upload. You need a policy that allows inserts (uploads) into this bucket.

1. In **Storage**, open the **project-media** bucket.
2. Go to **Policies** (or **Configuration** → Policies).
3. Add a policy to allow uploads. In the SQL editor you can run:

**Option A – Policy for “Anyone can upload and read” (simple for a portfolio):**

```sql
-- Allow anyone to upload (insert) into project-media
create policy "Allow public uploads"
on storage.objects for insert
to public
with check (bucket_id = 'project-media');

-- Allow anyone to read from project-media (public bucket)
create policy "Allow public read"
on storage.objects for select
to public
using (bucket_id = 'project-media');
```

**Option B – If your project already has storage policies**, add one that allows `insert` and `select` for bucket `project-media` for the role(s) you use (e.g. `anon` or `public`).

## 3. Environment variables

The app needs Supabase URL and anon key for the **API** (already used for the `projects` table) and for the **frontend** (so it can upload to Storage).

- **Vercel**: In your project → **Settings** → **Environment Variables**, set:
  - `SUPABASE_URL` = your Supabase project URL  
  - `SUPABASE_ANON_KEY` = your Supabase anon (public) key  
  and enable these for **Preview** and **Production** so both staging and production can upload.

The frontend gets these via **GET /api/config**, which your API serves from the same env vars. No extra env vars are needed for Storage.

## 4. Flow after setup

- **Add image**: file is uploaded to `project-media/{projectId}/{unique}-filename`, item gets the public URL.
- **Add video (trimmed)**: trimmed WebM is uploaded to Storage, item gets the public URL.
- **Thumbnail**: image is uploaded to Storage, project thumbnail is stored as URL.
- **Replace / Re-trim / Add cut**: same idea – new file/blob is uploaded, item or asset gets the new URL.

The **projects** table only stores URLs and metadata, so the JSON stays small and syncs correctly.

## 5. If uploads fail

- Check the bucket name is exactly **project-media** and that it is **public**.
- Check the two policies above (or equivalent) exist for `storage.objects` and bucket `project-media`.
- In the browser console you may see “Supabase upload error” with the exact error from Supabase.
