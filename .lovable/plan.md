## Goal
Add a login screen (matching the uploaded mockup) that gates the entire app. Only the exact credentials `kvasconcellos@mba2027.hbs.edu` / `DSAIL2026!` get in. No real auth — just a simple front-end check with a session flag in `sessionStorage`.

## Honest caveat
This is **not real security**. Anyone who views the JS bundle in their browser dev tools can see the password. That's fine for a demo / soft gate to keep casual visitors out, but please don't treat it as protecting sensitive data. If/when this matters, we swap in real Supabase auth — same UI, just wired differently.

## What gets built

### 1. New `/login` page (`src/pages/Login.tsx`)
A 1-to-1 React port of your mockup:
- Two-panel layout: left side with logo, animated mesh/grid background, floating teal nodes, headline "Find the right business. Own the process.", stats row (30K / 6+ / 8), and the Paul Thomson quote at the bottom.
- Right side: "Welcome back" eyebrow, "Sign in to Acquira" title, email + password fields, show/hide password toggle, Sign in button, divider, "Continue with Google" button (visual only — disabled, no-op), invitation-only footer.
- Version tag bottom-right (`v0.9.4 · private beta`).
- Fonts: Instrument Serif + DM Sans (already loaded in the project) + Geist Mono (will add via Google Fonts link in `index.html`).
- Mockup uses a teal palette (`#0fd4c0`) which differs from the Acquira Blue brand. We'll keep it teal **on the login page only** to match your mockup exactly, since the mockup is intentional. The rest of the app stays on the existing brand.

### 2. Auth check logic
- On Sign in click: if email === `kvasconcellos@mba2027.hbs.edu` AND password === `DSAIL2026!`, set `sessionStorage.setItem('acquira_auth', '1')` and navigate to `/`. Otherwise show an inline error ("Invalid credentials") and shake the button (matches mockup behavior).
- "Forgot password?" and "Continue with Google" are decorative — clicking does nothing (or shows a small "Contact the team" toast).

### 3. Route protection (`src/App.tsx`)
- Add a `RequireAuth` wrapper component that checks `sessionStorage.getItem('acquira_auth')`. If absent, redirect to `/login`.
- Wrap the existing `<AppLayout />` route with `<RequireAuth>` so Dashboard, Map, CRM, Library, Email Hub, DD Agent all require login.
- `/login` stays public.

### 4. Logout
- Add a small "Sign out" item in the existing top-nav user menu (or as a new icon button) that clears the session flag and routes back to `/login`. Tell me if you'd prefer it somewhere specific.

### 5. Session behavior
- `sessionStorage` (not `localStorage`) → user stays logged in while the tab is open, but closing the tab/browser logs them out. Tell me if you'd prefer "stay logged in across browser restarts" — easy swap to `localStorage`.

## Files touched
- **New:** `src/pages/Login.tsx`
- **New:** `src/components/auth/RequireAuth.tsx`
- **Edited:** `src/App.tsx` (add `/login` route, wrap protected routes)
- **Edited:** `index.html` (add Geist Mono font link)
- **Edited:** `src/components/AppLayout.tsx` (add Sign out action)

## Out of scope
- No Supabase auth, no `auth.users`, no profiles table, no RLS changes. Pure front-end gate.
