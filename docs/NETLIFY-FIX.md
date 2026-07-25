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
| Runtime | Next.js |
| Build command | `npm run build:netlify` |
| Publish directory | **empty** |
| Node | 20 |

Then: **Deploys** → **Trigger deploy** → **Clear cache and deploy site**

---

## Repo change

We **removed** `@netlify/plugin-nextjs` from `netlify.toml` and `package.json` so it does not fight the built-in **Next.js Runtime** in your build settings.

Pull latest `main` or wait for Netlify to auto-deploy commit `7d9dc23` or newer.

---

## Still failing?

Open the failed deploy → **Deploy log** → expand the error → copy the **full red text** (not just “plugin failed”) and share it.
