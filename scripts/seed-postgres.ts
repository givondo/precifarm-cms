/**
 * Seeds PostgreSQL from the JSON file store (run after db:push).
 * Usage: DATABASE_URL=... npx tsx scripts/seed-postgres.ts
 */
import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const storePath = path.join(process.cwd(), "data", "store.json");
if (!fs.existsSync(storePath)) {
  console.log("No data/store.json yet — seeding defaults only.");
}

async function main() {
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });

  const existing = await db.select().from(schema.routes).limit(1);
  if (existing.length > 0) {
    console.log("Database already seeded.");
    await client.end();
    return;
  }

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

  console.log("PostgreSQL seeded: route, departures, agents.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
