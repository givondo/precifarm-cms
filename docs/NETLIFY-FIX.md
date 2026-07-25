# Netlify deploy failed — @netlify/plugin-nextjs

## Fix in 2 minutes

### Step 1 — Remove duplicate plugin (most common cause)

1. Netlify → **precifarm-cms** → **Project configuration** → **Plugins**
2. If **Next.js Runtime** or **@netlify/plugin-nextjs** appears with **Origin: UI**, click it → **Remove** / **Uninstall**
3. The repo now installs the plugin from `package.json` — having both causes this exact error

### Step 2 — Build settings

| Field | Value |
|-------|--------|
| Build command | `npm run build:netlify` |
| Publish directory | **Leave empty** |
| Node | 20 |

### Step 3 — Redeploy

**Deploys** → **Trigger deploy** → **Clear cache and deploy site**

---

## If it still fails

Open the failed deploy → expand the **Plugin** section in the log. Common messages:

| Log says | Fix |
|----------|-----|
| `does not contain a Next.js production build` | Build command must be `npm run build:netlify` (not `npm run build`) |
| `wrong publish directory` | Publish directory must be **empty** in Netlify UI |
| Plugin version outdated | Pull latest `main` (pins `@netlify/plugin-nextjs@5.15.12`) |

Paste the full red error block from the deploy log if you need help.

---

## CMS on Netlify limitation

The CMS uses a file-based store (`data/`). On Netlify serverless, **bookings do not persist** across deploys unless you add `DATABASE_URL` (PostgreSQL). For production, consider **Railway** or **Render** for the CMS long term; the website can stay on Netlify.
