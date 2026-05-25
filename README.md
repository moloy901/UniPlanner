# UniPlanner

Study task planner with Supabase auth and database.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project at [supabase.com](https://supabase.com).

3. Copy env template and add your keys (Dashboard → Project Settings → API):

   ```bash
   copy .env.example .env
   ```

   Edit `.env`:

   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbG...
   ```

4. Run the SQL in `supabase-schema.sql` in the Supabase SQL Editor.

5. In Supabase → Authentication → Providers, enable Email. If email confirmation is on, confirm your account before logging in.

6. Start the dev server (do not open `index.html` directly in the browser):

   ```bash
   npm run dev
   ```

   Open the URL Vite prints (usually `http://localhost:5173`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server with env vars |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
