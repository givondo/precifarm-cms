/**
 * Netlify scheduled function — daily analytics aggregation.
 * Runs via POST /api/v1/analytics/aggregate with ANALYTICS_CRON_KEY.
 */
export default async (req) => {
  const base =
    process.env.URL?.replace(/\/$/, "") ||
    process.env.DEPLOY_PRIME_URL?.replace(/\/$/, "");
  const cronKey = process.env.ANALYTICS_CRON_KEY?.trim();

  if (!base) {
    console.error("[analytics-daily] URL / DEPLOY_PRIME_URL not set.");
    return new Response(JSON.stringify({ ok: false, error: "missing_site_url" }), {
      status: 500,
    });
  }

  if (!cronKey) {
    console.error("[analytics-daily] ANALYTICS_CRON_KEY not set — skipping.");
    return new Response(JSON.stringify({ ok: false, error: "missing_cron_key" }), {
      status: 200,
    });
  }

  let nextRun;
  try {
    const body = await req.json();
    nextRun = body?.next_run;
  } catch {
    /* manual invoke */
  }

  console.log("[analytics-daily] starting aggregation", nextRun ? `(next: ${nextRun})` : "");

  const res = await fetch(`${base}/api/v1/analytics/aggregate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Analytics-Cron-Key": cronKey,
    },
    body: "{}",
  });

  const text = await res.text();
  console.log("[analytics-daily] status", res.status, text.slice(0, 500));

  return new Response(text, {
    status: res.ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  schedule: "0 3 * * *",
};
