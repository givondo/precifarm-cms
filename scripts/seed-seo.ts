/**
 * Seeds SEO entities and sample content after db:push.
 * Usage: npm run db:seed-seo  (loads DATABASE_URL from .env)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

function loadEnvFile() {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://precifarm.com";

const entities = [
  {
    slug: "precifarm",
    type: "organization",
    name: "Precifarm",
    description:
      "Kenyan company building charging hubs and operating network for intercity electric travel.",
    url: SITE_URL,
    metadata: {},
    aliases: [],
  },
  {
    slug: "nairobi-kisumu",
    type: "route",
    name: "Nairobi – Kisumu",
    description: "Live intercity electric coach route on the Precifarm network.",
    url: `${SITE_URL}/#book`,
    metadata: { duration: "4h 45m", distance: "345 km", fare: 1550, currency: "KES" },
    aliases: ["Nairobi Kisumu", "Nairobi to Kisumu"],
  },
  {
    slug: "yutong-u18",
    type: "equipment",
    name: "Yutong U18",
    description: "Electric intercity coach used on Nairobi–Kisumu scheduled service.",
    metadata: {},
    aliases: [],
  },
  {
    slug: "ev-fast-charger",
    type: "equipment",
    name: "DC Fast Charger",
    description: "Hub fast charging for intercity electric coaches and fleets.",
    metadata: {},
    aliases: ["EV charger", "fast charger"],
  },
  {
    slug: "hub-charging",
    type: "service",
    name: "Route Hub Charging",
    description: "Reserved fast-charging windows for partner operators at intercity hubs.",
    url: `${SITE_URL}/charging`,
    metadata: {},
    aliases: [],
  },
  {
    slug: "nairobi",
    type: "location",
    name: "Nairobi",
    description: "Kenya's capital and primary departure hub for Precifarm intercity electric routes.",
    metadata: { county: "Nairobi County", region: "Central Kenya", lat: -1.2921, lng: 36.8219 },
    aliases: ["Nairobi City"],
  },
  {
    slug: "kisumu",
    type: "location",
    name: "Kisumu",
    description: "Lake Victoria city and western terminus of the Nairobi–Kisumu electric coach route.",
    metadata: { county: "Kisumu County", region: "Western Kenya", lat: -0.1022, lng: 34.7617 },
    aliases: [],
  },
  {
    slug: "nakuru",
    type: "location",
    name: "Nakuru",
    description: "Rift Valley hub city on major corridors for electric intercity travel in Kenya.",
    metadata: { county: "Nakuru County", region: "Rift Valley", lat: -0.3031, lng: 36.08 },
    aliases: [],
  },
  {
    slug: "mombasa",
    type: "location",
    name: "Mombasa",
    description: "Coastal Kenya city — expansion target for renewable-powered transport infrastructure.",
    metadata: { county: "Mombasa County", region: "Coast", lat: -4.0435, lng: 39.6682 },
    aliases: [],
  },
  {
    slug: "solar-panel-array",
    type: "equipment",
    name: "Solar Panel Array",
    description: "Grid-tied and off-grid solar generation at Precifarm charging hubs.",
    metadata: { category: "renewable", capacityKw: 50 },
    aliases: ["solar panels", "PV array"],
  },
  {
    slug: "water-pump-system",
    type: "equipment",
    name: "Solar Water Pump System",
    description: "Solar-powered pumping for hub sites and partner agricultural operations.",
    metadata: { category: "water", application: "irrigation" },
    aliases: ["solar pump", "water pump"],
  },
  {
    slug: "hybrid-inverter",
    type: "equipment",
    name: "Hybrid Solar Inverter",
    description: "Battery-backed inverter systems for hub resilience and fleet depot power.",
    metadata: { category: "power", type: "hybrid" },
    aliases: ["inverter", "solar inverter"],
  },
];

const content = [
  {
    slug: "book-nairobi-kisumu-coach",
    title: "How to book Nairobi–Kisumu electric coach tickets",
    description:
      "Step-by-step guide to booking a reserved seat on Precifarm's Nairobi–Kisumu Yutong U18 service with M-Pesa payment and SMS ticket delivery.",
    contentType: "guide",
    bodyMd: `## Overview

Precifarm operates scheduled electric coach service between Nairobi and Kisumu on the Yutong U18. Book online at precifarm.com or through the Android passenger app.

## Before you book

- Have a valid **National ID or passport** ready for boarding
- Use an **M-Pesa registered phone number**
- Fixed fare: **KSh 1,550** per seat
- Journey: **~4h 45m** · **~345 km**
- Daily departures: **06:00, 08:00, 10:00, 14:00, 16:00**

## Steps

1. Open the booking form at [precifarm.com/#book](https://precifarm.com/#book)
2. Select your travel date and departure time
3. Choose your seat on the coach layout
4. Enter passenger name, phone number and ID number
5. Confirm details and pay with **M-Pesa STK push**
6. Save your SMS ticket with reference **PF-XXXXXX**

## After booking

Arrive at the departure point before boarding time. Present your ID and booking reference to the operator. Precifarm sends an SMS if the departure time or boarding point changes.

## Why hub charging matters

Every departure has **reserved hub charging** locked in before the coach leaves — energy you can plan around, not a charger you hope is free.`,
    aisoBlocks: [
      {
        id: "summary",
        type: "executive_summary",
        title: "Summary",
        content:
          "Book Nairobi–Kisumu in six steps: pick date and time, choose a seat, enter passenger details, pay with M-Pesa, receive SMS ticket.",
      },
      {
        id: "how-to-book",
        type: "how_to",
        title: "How to book a seat",
        items: [
          "Open precifarm.com and scroll to the booking form",
          "Select travel date, departure time and number of passengers",
          "Choose your seat on the Yutong U18 coach",
          "Enter full name, phone number and National ID or passport",
          "Confirm details and pay with M-Pesa STK push",
          "Save your SMS ticket with the PF booking reference",
        ],
      },
      {
        id: "facts",
        type: "key_facts",
        title: "Key facts",
        items: [
          "Fixed fare KSh 1,550 per seat",
          "Journey ~4h 45m, ~345 km",
          "Yutong U18 electric intercity coach",
          "M-Pesa checkout + SMS ticket delivery",
          "Hub charging reserved before every departure",
        ],
      },
    ],
  },
  {
    slug: "precifarm-booking-faq",
    title: "Precifarm booking FAQ",
    description:
      "Answers to common questions about booking Nairobi–Kisumu electric coach travel, M-Pesa payment, tickets, boarding and charging hubs.",
    contentType: "faq",
    bodyMd: `Answers to the most common questions about booking on Precifarm — Nairobi–Kisumu electric coach travel, M-Pesa tickets and hub charging.`,
    aisoBlocks: [
      {
        id: "faq",
        type: "faq",
        title: "Frequently asked questions",
        items: [
          {
            question: "What is Precifarm?",
            answer:
              "Precifarm builds charging hubs and the operating network that make electric travel between Kenyan cities dependable and bookable. Licensed partners operate the coaches; Precifarm provides energy, schedules, M-Pesa tickets and passenger service data.",
          },
          {
            question: "How do I book a seat on Nairobi–Kisumu?",
            answer:
              "Visit precifarm.com/#book, choose your departure date and time, select a seat, enter passenger details and pay with M-Pesa. You receive an SMS ticket with your booking reference (PF-XXXXXX).",
          },
          {
            question: "How much does Nairobi–Kisumu cost?",
            answer: "The fixed fare is KSh 1,550 per seat on the Yutong U18 electric coach.",
          },
          {
            question: "What payment methods are accepted?",
            answer:
              "M-Pesa STK push is supported at checkout on precifarm.com and the Android passenger app. Demo mode may be active in test environments.",
          },
          {
            question: "What ID do I need at boarding?",
            answer:
              "Bring the same National ID or passport number you entered when booking. The operator verifies it against your booking reference.",
          },
          {
            question: "What are the departure times?",
            answer:
              "Scheduled daily departures on Nairobi–Kisumu are 06:00, 08:00, 10:00, 14:00 and 16:00. Confirm your time on your SMS ticket.",
          },
          {
            question: "Where does Precifarm operate charging hubs?",
            answer:
              "Precifarm operates intercity charging hubs along live and planned routes. View current hub locations on the Charge Map at precifarm.com/network.",
          },
          {
            question: "Is there a Precifarm mobile app?",
            answer:
              "Yes. Download the Android passenger app at precifarm.com/download to book seats and pay with M-Pesa on your phone.",
          },
          {
            question: "Who operates the coaches?",
            answer:
              "Licensed partner operators run the Yutong U18 coaches on the published schedule. Precifarm provides the energy, booking network and operating standards.",
          },
        ],
      },
    ],
  },
  {
    slug: "ev-charging-hubs-kenya",
    title: "EV charging hubs for intercity routes in Kenya",
    description:
      "How Precifarm designs and operates route charging hubs with reserved windows for scheduled electric coaches and fleet partners.",
    contentType: "guide",
    bodyMd: `## What is a route charging hub?

A Precifarm hub combines **DC fast charging**, **solar generation** and **battery storage** at locations where intercity electric vehicles actually need energy — not vanity coverage on a map.

## Four layers, one hub

1. **Grid + solar + storage** — dependable energy with predictable costs
2. **DC fast charging (CCS2)** — modular chargers with reserved windows for scheduled coaches
3. **Passenger dwell** — safe circulation, shade and amenities aligned to timetables
4. **Live monitoring** — 24/7 status, OCPP telemetry and honest recovery when something fails

## Why reserved windows matter

Operators run timetables. An occupied or offline charger breaks the schedule. Precifarm assigns **reserved charging sessions** aligned to every departure on Nairobi–Kisumu and partner routes.

## Who can use Precifarm hubs?

- **Passengers** — book scheduled intercity coaches at precifarm.com/#book
- **Fleet operators** — reserved hub sessions and network services via precifarm.com/partners
- **Site hosts** — revenue share and O&M partnerships via precifarm.com/charging

## Home and private-site charging

Precifarm also installs **residential DC fast chargers** and **private in-house charging stations** for estates, schools and industrial sites — engineered and serviced by the same regional teams that operate route hubs.`,
    aisoBlocks: [
      {
        id: "summary",
        type: "executive_summary",
        title: "Summary",
        content:
          "Precifarm hubs are energy stops on intercity routes — fast charging, solar, storage and reserved windows sized to real timetables, not lone chargers in car parks.",
      },
      {
        id: "facts",
        type: "key_facts",
        title: "Hub facts",
        items: [
          "≤150 km planning guide between dependable charges",
          "24/7 hub monitoring and status updates",
          "CCS2 open fast-charging standard",
          "Nairobi–Kisumu proves the model before the next route is financed",
        ],
      },
    ],
  },
  {
    slug: "download-precifarm-android-app",
    title: "How to download and install the Precifarm Android app",
    description:
      "Install the Precifarm passenger app on Android to book Nairobi–Kisumu seats, pay with M-Pesa and receive SMS tickets.",
    contentType: "howto",
    bodyMd: `## Download the APK

1. Open [precifarm.com/download](https://precifarm.com/download) on your Android phone
2. Tap **Download APK** — the file is served directly from precifarm.com
3. When prompted, allow installation from your browser if needed

## Install on Android

1. Open the downloaded **precifarm.apk** file
2. If Android blocks unknown sources, go to **Settings → Security** and allow installation for your browser
3. Confirm install and open **Precifarm**

## Book with the app

1. Sign in with your phone number
2. Select Nairobi–Kisumu, date, departure and seat
3. Pay with M-Pesa STK push
4. Save your SMS ticket with booking reference **PF-XXXXXX**

The app uses the same fares and schedule as precifarm.com.`,
    aisoBlocks: [
      {
        id: "how-to-install",
        type: "how_to",
        title: "Install steps",
        items: [
          "Visit precifarm.com/download on your Android device",
          "Download precifarm.apk from the official site",
          "Allow installation from unknown sources if Android prompts you",
          "Open the APK and complete installation",
          "Launch Precifarm and book with M-Pesa",
        ],
      },
    ],
  },
];

const swahiliContent = [
  {
    slug: "precifarm-booking-faq",
    locale: "sw-KE",
    title: "Maswali ya mara kwa mara kuhusu kuhifadhi nafasi Precifarm",
    description:
      "Majibu kuhusu kuhifadhi safari ya basi la umeme Nairobi–Kisumu, malipo ya M-Pesa, tiketi na vituo vya kuchaji.",
    contentType: "faq",
    bodyMd: "Maswali ya mara kwa mara kuhusu kuhifadhi safari na njia ya Nairobi–Kisumu kwenye Precifarm.",
    aisoBlocks: [
      {
        id: "faq",
        type: "faq",
        title: "Maswali ya mara kwa mara",
        items: [
          {
            question: "Precifarm ni nini?",
            answer:
              "Precifarm inajenga vituo vya kuchaji na mtandao wa usafiri wa umeme kati ya miji mikuu nchini Kenya. Washirika wenye leseni huendesha mabasi; Precifarm inatoa nishati, ratiba na tiketi za M-Pesa.",
          },
          {
            question: "Nawezaje kuhifadhi nafasi ya Nairobi–Kisumu?",
            answer:
              "Tembelea precifarm.com/#book, chagua tarehe na muda wa kuondoka, chagua kiti, weka maelezo ya abiria na lipa kwa M-Pesa. Utapokea tiketi ya SMS na nambari ya kumbukumbu PF-XXXXXX.",
          },
          {
            question: "Bei ya Nairobi–Kisumu ni kiasi gani?",
            answer: "KSh 1,550 kwa kila kiti kwenye basi la umeme Yutong U18.",
          },
          {
            question: "Je, naweza kulipa kwa M-Pesa?",
            answer: "Ndiyo. M-Pesa STK inapatikana kwenye tovuti na programu ya Android.",
          },
          {
            question: "Ninahitaji kitambulisho gani wakati wa kupanda?",
            answer:
              "Beba Kitambulisho cha Taifa au pasipoti uliyoweka wakati wa kuhifadhi nafasi. Opereta anathibitisha dhidi ya nambari yako ya kuhifadhi.",
          },
          {
            question: "Je, kuna programu ya simu ya Precifarm?",
            answer:
              "Ndiyo. Pakua programu ya Android kwenye precifarm.com/download ili kuhifadhi nafasi na kulipa kwa M-Pesa.",
          },
        ],
      },
    ],
  },
];

async function main() {
  const client = postgres(DATABASE_URL, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  for (const entity of entities) {
    await db
      .insert(schema.seoEntities)
      .values({ ...entity, published: true })
      .onConflictDoUpdate({
        target: schema.seoEntities.slug,
        set: { ...entity, updatedAt: new Date() },
      });
  }
  console.log(`Seeded ${entities.length} SEO entities.`);

  for (const item of content) {
    await db
      .insert(schema.seoContent)
      .values({
        ...item,
        locale: "en-KE",
        status: "published",
        entityIds: [],
        publishedAt: new Date(),
        authorName: "Precifarm",
        reviewerName: "Precifarm Editorial",
        reviewedAt: new Date(),
        reviewStatus: "approved",
        sources: [
          { title: "Precifarm", url: SITE_URL, accessedAt: new Date().toISOString().slice(0, 10) },
        ],
      })
      .onConflictDoUpdate({
        target: [schema.seoContent.slug, schema.seoContent.locale],
        set: {
          title: item.title,
          description: item.description,
          bodyMd: item.bodyMd,
          contentType: item.contentType,
          aisoBlocks: item.aisoBlocks,
          status: "published",
          publishedAt: new Date(),
          updatedAt: new Date(),
        },
      });
  }
  console.log(`Seeded ${content.length} SEO content items (en-KE).`);

  for (const item of swahiliContent) {
    await db
      .insert(schema.seoContent)
      .values({
        ...item,
        status: "published",
        entityIds: [],
        publishedAt: new Date(),
        authorName: "Precifarm",
        reviewerName: "Precifarm Editorial",
        reviewedAt: new Date(),
        reviewStatus: "approved",
        sources: [{ title: "Precifarm", url: SITE_URL }],
      })
      .onConflictDoUpdate({
        target: [schema.seoContent.slug, schema.seoContent.locale],
        set: {
          title: item.title,
          description: item.description,
          bodyMd: item.bodyMd,
          aisoBlocks: item.aisoBlocks,
          status: "published",
          updatedAt: new Date(),
        },
      });
  }
  console.log(`Seeded ${swahiliContent.length} Swahili content item(s).`);

  const entityRows = await db.select().from(schema.seoEntities);
  const route = entityRows.find((e) => e.slug === "nairobi-kisumu");
  const vehicle = entityRows.find((e) => e.slug === "yutong-u18");
  if (route && vehicle) {
    const existing = await db
      .select()
      .from(schema.seoEntityRelations)
      .where(eq(schema.seoEntityRelations.fromEntityId, route.id))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(schema.seoEntityRelations).values({
        fromEntityId: route.id,
        toEntityId: vehicle.id,
        relationType: "uses",
      });
      console.log("Linked route → vehicle relation.");
    }
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
