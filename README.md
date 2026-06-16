UniPlanner is a student task management web application built with HTML, CSS, JavaScript, and Supabase. It supports user authentication, task creation, task filtering, task completion, and task deletion.

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

   The app reads these values from `.env`. If they are missing or the project URL is wrong, signup/login will not be able to connect to Supabase.

4. Run the SQL in `supabase-schema.sql` in the Supabase SQL Editor.

5. In Supabase → Authentication → Providers, enable Email.

   To stop users from signing in with an email inbox they do not own, turn on email confirmations in Supabase:

   - Go to Authentication → Providers → Email.
   - Enable Confirm email / email confirmation.
   - Add your auth page URL in Authentication → URL Configuration if Supabase asks for an allowed redirect URL, for example `http://localhost:5173/index.html`.

   The app blocks login until the email confirmation link has been opened.
   Supabase's built-in email sender has a rate limit, so repeated tests can show `email rate limit exceeded`; wait a few minutes or configure a custom SMTP provider in Authentication → SMTP Settings.

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
