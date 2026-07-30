# SEO / AISO (Answer Engine Optimization)

CMS-backed SEO content powers website guides, FAQ, location pages, and Kiswahili locale. Requires **PostgreSQL** and optionally **OpenAI** for embeddings and generation.

Architecture: [`kenya-ebus-ecosystem/website/docs/SEO-AISO-ARCHITECTURE.md`](../../kenya-ebus-ecosystem/website/docs/SEO-AISO-ARCHITECTURE.md)

---

## Setup

```bash
npm run supabase:seo       # schema + seed entities, guides, Swahili FAQ, local drafts
npm run seo:embeddings     # OpenAI embeddings (requires OPENAI_API_KEY)
npm run seo:local-pages    # generate location page drafts
```

**Env vars** (`.env` — see `.env.example`):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical links in seeded content |
| `OPENAI_API_KEY` | Embeddings + content generation |
| `SEO_CRON_KEY` | Protect scheduled metrics/report endpoints |
| `SEO_STALE_DAYS` | Stale content threshold (default 90) |

---

## Public API (website consumes)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/seo/content` | List/filter guides and FAQ |
| `GET /api/v1/seo/content/[slug]` | Single content item |
| `GET /api/v1/seo/entities` | Location and hub entities |
| `GET /api/v1/seo/entities/[slug]` | Single entity |
| `GET /api/v1/seo/search?q=&mode=semantic` | Keyword or embedding search |
| `GET /api/v1/seo/health` | SEO subsystem health |
| `GET /api/v1/seo/agent` | Agent/MCP tool manifest |
| `GET /api/v1/seo/report` | Stale/gap report (cron or admin) |

Website proxy: `GET /api/search?q=` → CMS semantic search.

---

## Admin desk (`/seo/*`, admin role)

| Path | Purpose |
|---|---|
| `/seo` | SEO dashboard |
| `/seo/content` | Manage guides and FAQ |
| `/seo/entities` | Hub and city entities |
| `/seo/review` | Review queue |
| `/seo/local` | Local page factory |
| `/seo/gaps` | Content gap analysis |
| `/seo/competitors` | Competitor snapshots |
| `/seo/automation` | Batch jobs |

---

## Website routes powered by CMS

| Website | CMS source |
|---|---|
| `/guides`, `/guides/[slug]` | `seo_content` |
| `/faq`, `/faq/[slug]` | `seo_content` |
| `/locations`, `/locations/[slug]` | `seo_entities` |
| `/sw/faq/[slug]` | Swahili locale content |

Client: `kenya-ebus-ecosystem/website/lib/seo/cms-client.ts`

Registry: `website/lib/seo/pages/registry.ts` includes all public SEO routes.

---

## npm scripts

| Script | Purpose |
|---|---|
| `npm run supabase:seo` | Full SEO schema + seed pipeline |
| `npm run seo:embeddings` | Batch OpenAI embeddings |
| `npm run seo:local-pages` | Generate local SEO drafts |
| `npm run seo:report` | CLI stale/gap report |
| `npm run db:seed-seo` | Content seed only |

---

## Scheduled jobs (production)

On GCP, use Cloud Scheduler instead of Netlify cron:

```text
POST /api/v1/seo/metrics   (optional daily metrics ingest)
GET  /api/v1/seo/report    (stale content scan)
Header: X-Seo-Cron-Key: <SEO_CRON_KEY>
```

---

## Related

- [STORAGE.md](./STORAGE.md) — `seo_*` tables
- [ANALYTICS.md](./ANALYTICS.md) — behavioural events (separate from SEO content)
- [DEPLOY-SUPABASE.md](./DEPLOY-SUPABASE.md) — database setup
