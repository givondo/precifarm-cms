# Hosting at cms.precifarm.com

The operations CMS runs on Google Cloud Run in europe-west1, behind https://cms.precifarm.com.
Approval: AP-023 (tier C), 21 October 2026, in the kenya-ebus-ecosystem records.

## First deploy and every settings change

From this folder, in Windows PowerShell, after `gcloud auth login`:

    powershell -ExecutionPolicy Bypass -File deploy\deploy-cms.ps1 -Project skilled-orbit-460722-h9

The script asks once for the admin password (12 characters or more) and stores only its scrypt
hash. Then add one DNS record at Hostinger: `CNAME cms ghs.googlehosted.com`. Google issues the
certificate 15 to 60 minutes after the record resolves.

To change the admin password later, run the script again with `-NewPassword`. That signs everyone out.

## When the service already runs with a database

The live `precifarm-cms` (behind api.precifarm.com, used by the website and the app) runs with a
PostgreSQL database. The script then updates it in place: the data stays in the database, every
existing setting is kept (payment mode included), the service keeps its own account, and only the
image, the admin, session and callback secrets, the host list and `BOOKING_ENABLED=false` change.
It shows the current traffic split and changes nothing until you type `UPDATE`.

Before its first change to the data, the new code saves the record untouched as a row named
`bak-<time>` in the same `app_store` table. To undo, in this order:

1. `gcloud run services update-traffic precifarm-cms --region europe-west1 --to-revisions <printed split>`
2. In the database SQL editor:
   `UPDATE app_store SET data = (SELECT data FROM app_store WHERE id LIKE 'bak-%' ORDER BY id DESC LIMIT 1) WHERE id = 'default';`

After the update, accounts still on the password published in early versions are switched off and
other existing accounts sign in only after a reset (`scripts/set-agent-password.ts`). The admin
signs in with the email and password chosen in the script.

## How it is set up

| Setting | Value | Why |
|---|---|---|
| Instances | 0 to 1 | The data file has one writer; scales to zero when idle |
| Data | The existing database when there is one; otherwise `gs://PROJECT-precifarm-cms-data` mounted at `/data` (`CMS_DATA_DIR`), object versioning on | Survives restarts; earlier versions can be restored |
| Admin | `CMS_ADMIN_EMAIL` plus `CMS_ADMIN_PASSWORD_HASH` (Secret Manager) | No default accounts in production; a changed hash resets the password |
| Sessions | `SESSION_SECRET` (Secret Manager), 8 hours, ended for every device on sign-out | Signed cookie, never the bare agent id |
| Hosts | `CMS_ALLOWED_HOSTS`: cms.precifarm.com, api.precifarm.com, the run.app names and any domain mapped to the service | Any other Host header gets 421, except `/api/v1/health` |
| Payments | `DEMO_PAYMENT=true` | No real M-Pesa charge until live credentials are approved |
| Booking | `BOOKING_ENABLED=false` | Passenger booking is retired (Canon); its routes return 410 |
| M-Pesa callback | `MPESA_CALLBACK_TOKEN` (Secret Manager) | Callbacks without `?token=` are refused |

Every response carries `X-Robots-Tag: noindex`, frame and content-type protections, and HSTS over
https. Writes that carry a session cookie from another site are refused.

## Rules the code enforces in production

- No storage configured (no database and no `CMS_DATA_DIR`): the CMS refuses to run.
- An empty or unreadable `store.json`: the CMS stops and leaves the file for repair; it never
  replaces it with seed data. Restore the previous object version from the bucket.
- No demo installs, sessions or riders unless `CMS_DEMO_DATA=true`.
- Any account still on the password published in early versions is deactivated.
- Analytics ingest is open unless `ANALYTICS_INGEST_KEY` is set (the website and app send no key today); analytics and SEO also need PostgreSQL and answer
  503 on the file store.
- `/api/v1/health` answers `{ ok }` to everyone and the configuration summary to an admin only.
- Public survey intake: 5 requests a minute per address, and at most 60 saved surveys an hour in
  total (rejected requests do not count), because each saved survey rewrites the data file.
- Failed sign-ins: 10 per address in 15 minutes; successful sign-ins do not count.

## Restoring the data file

    gcloud storage ls --all-versions gs://PROJECT-precifarm-cms-data/store.json
    gcloud storage cp gs://PROJECT-precifarm-cms-data/store.json#GENERATION gs://PROJECT-precifarm-cms-data/store.json

## Merging main

`cloudbuild.yaml` builds the image and rolls it onto the existing service without touching these
settings. Merging to `main` is a production deploy and needs its own approval (AP-002).
