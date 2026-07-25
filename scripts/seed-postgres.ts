/**
 * Seeds Supabase/PostgreSQL after db:push.
 * Usage: DATABASE_URL=... npx tsx scripts/seed-postgres.ts
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { seedStore } from "../src/db/store";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const STORE_ID = "default";

function pgClient(url: string) {
  return postgres(url, {
    max: 1,
    prepare: false,
    ssl: url.includes("supabase") ? "require" : undefined,
  });
}

async function main() {
  const client = pgClient(DATABASE_URL);
  const db = drizzle(client, { schema });

  const existingStore = await db.select().from(schema.appStore).where(eq(schema.appStore.id, STORE_ID)).limit(1);
  if (existingStore.length === 0) {
    const store = seedStore();
    await db.insert(schema.appStore).values({ id: STORE_ID, data: store });
    console.log("Seeded app_store: route, agents, riders (CMS runtime data).");
  } else {
    console.log("app_store already seeded.");
  }

  const existingRoute = await db.select().from(schema.routes).limit(1);
  if (existingRoute.length === 0) {
    await db.insert(schema.routes).values({
      id: "nairobi-kisumu",
      label: "Nairobi – Kisumu",
      origin: "Nairobi",
      destination: "Kisumu",
      distanceKm: 345,
      durationMinutes: 285,
      vehicleModel: "Yutong U18",
      farePerSeat: 1550,
      status: "current",
    });

    for (const time of ["06:00", "08:00", "10:00", "14:00", "16:00"]) {
      await db.insert(schema.routeDepartures).values({
        routeId: "nairobi-kisumu",
        departureTime: time,
      });
    }

    await db.insert(schema.agents).values([
      {
        email: "agent@precifarm.com",
        passwordHash: "precifarm2026",
        name: "Jane Agent",
        role: "agent",
        branch: "Nairobi",
      },
      {
        email: "admin@precifarm.com",
        passwordHash: "precifarm2026",
        name: "System Admin",
        role: "admin",
        branch: "Nairobi",
      },
    ]);

    console.log("Seeded relational tables: routes, departures, agents.");
  } else {
    console.log("Relational tables already seeded.");
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
