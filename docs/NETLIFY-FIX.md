# Netlify — where to find settings (2026 UI)

Netlify renamed/moved things. There is often **no top-level “Plugins” menu**.

## Where to look

### A) Next.js Runtime (most important)

1. Open your site **precifarm-cms**
2. Left sidebar → **Project configuration**
3. **Build & deploy** → **Continuous deployment** → **Build settings**
4. Scroll to **Runtime** — you should see **Next.js**
5. **Keep this** — do not remove unless Netlify support tells you to

This *is* the Next.js integration (not a separate “Plugins” page).

### B) Build plugins (if your account has it)

Same path: **Project configuration** → **Build & deploy** → **Build plugins**

Or try direct URL (replace `YOUR-SITE-NAME`):

```
https://app.netlify.com/sites/YOUR-SITE-NAME/configuration/plugins
```

If that 404s, your team uses Runtime-only (path A) — that is normal.

### C) Environment variables

**Project configuration** → **Environment variables**

Add only if builds still fail with duplicate plugin errors:

| Key | Value |
|-----|------|
| `NETLIFY_NEXT_PLUGIN_SKIP` | `true` |

Use this only as a last resort — it disables the legacy plugin so Netlify’s OpenNext runtime handles the build.

---

## Correct build settings (precifarm-cms)

| Field | Value |
|-------|--------|
| **Runtime** | **Remove** (click red Remove) — the repo plugin replaces this |
| Build command | `npm run build:netlify` |
| Publish directory | `.next` (set in `netlify.toml`; leave UI blank so toml wins) |
| Node | 20 |

**Important:** You must have **either** Runtime **or** the repo plugin — **not both**.  
If Runtime = Next.js stays on AND plugin is in `netlify.toml`, build may fail.  
If Runtime is on with NO plugin, deploy succeeds but every page shows **Netlify 404** (your current issue).

Then: **Deploys** → **Trigger deploy** → **Clear cache and deploy site**

### Test URLs after deploy

- `https://YOUR-SITE.netlify.app/login` — agent login page
- `https://YOUR-SITE.netlify.app/api/v1/health` — JSON health check

Root `/` redirects to `/dashboard` (requires login).

---

## Repo change

We **removed** `@netlify/plugin-nextjs` from `netlify.toml` and `package.json` so it does not fight the built-in **Next.js Runtime** in your build settings.

Pull latest `main` or wait for Netlify to auto-deploy commit `7d9dc23` or newer.

---

## Still failing?

Open the failed deploy → **Deploy log** → expand the error → copy the **full red text** (not just “plugin failed”) and share it.
