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

## How it is set up

| Setting | Value | Why |
|---|---|---|
| Instances | 0 to 1 | The data file has one writer; scales to zero when idle |
| Data | `gs://PROJECT-precifarm-cms-data` mounted at `/data` (`CMS_DATA_DIR`), object versioning on | Survives restarts; any earlier version of `store.json` can be restored |
| Admin | `CMS_ADMIN_EMAIL` plus `CMS_ADMIN_PASSWORD_HASH` (Secret Manager) | No default accounts in production; a changed hash resets the password |
| Sessions | `SESSION_SECRET` (Secret Manager), 8 hours, ended for every device on sign-out | Signed cookie, never the bare agent id |
| Hosts | `CMS_ALLOWED_HOSTS`: cms.precifarm.com and the two run.app names | Any other Host header gets 421 |
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
- Analytics ingest needs `ANALYTICS_INGEST_KEY`; analytics and SEO also need PostgreSQL and answer
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
