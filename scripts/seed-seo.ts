/**
 * Seeds SEO entities and sample content after db:push.
 * Usage: DATABASE_URL=... npx tsx scripts/seed-seo.ts
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

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

Precifarm operates scheduled electric coach service between Nairobi and Kisumu. This guide explains how to book online at precifarm.com or via the Android passenger app.

## Before you book

- Have a valid National ID or passport ready for boarding
- Use an M-Pesa registered phone number
- Fares are fixed at **KSh 1,550** per seat

## Steps

1. Open the booking form at precifarm.com/#book
2. Select your travel date and departure time
3. Choose your seat on the coach layout
4. Enter passenger name, phone and ID number
5. Confirm and pay with M-Pesa STK push
6. Save your SMS ticket with reference **PF-XXXXXX**

## After booking

Arrive at the departure point before boarding time. Present your ID and booking reference to the operator.`,
    aisoBlocks: [
      {
        id: "summary",
        type: "executive_summary",
        title: "Summary",
        content:
          "Book Nairobi–Kisumu online in six steps: pick date, seat, passenger details, M-Pesa pay, SMS ticket.",
      },
      {
        id: "facts",
        type: "key_facts",
        title: "Key facts",
        items: [
          "Fixed fare KSh 1,550 per seat",
          "Journey ~4h 45m, ~345 km",
          "Yutong U18 electric coach",
          "M-Pesa + SMS ticket at checkout",
        ],
      },
    ],
  },
  {
    slug: "precifarm-booking-faq",
    title: "Precifarm booking FAQ",
    description:
      "Answers to common questions about booking Nairobi–Kisumu electric coach travel, M-Pesa payment, tickets and charging hubs.",
    contentType: "faq",
    bodyMd: "Frequently asked questions about Precifarm passenger booking and the Nairobi–Kisumu route.",
    aisoBlocks: [
      {
        id: "faq",
        type: "faq",
        title: "Frequently asked questions",
        items: [
          {
            question: "What is Precifarm?",
            answer:
              "Precifarm builds charging hubs and the operating network for dependable electric travel between Kenyan cities. Licensed partners operate the coaches.",
          },
          {
            question: "How much is Nairobi–Kisumu?",
            answer: "KSh 1,550 per seat on the Yutong U18 electric coach.",
          },
          {
            question: "Can I pay with M-Pesa?",
            answer: "Yes. M-Pesa STK push is supported on the website and Android app.",
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

A Precifarm hub combines DC fast charging, solar generation and battery storage at locations where intercity electric vehicles actually need energy — not vanity coverage on a map.

## Why reserved windows matter

Operators run timetables. An occupied or offline charger breaks the schedule. Precifarm assigns reserved charging sessions aligned to every departure.

## Partner services

Fleet operators and site hosts can access hub charging, home DC installation and private-site stations through precifarm.com/charging.`,
    aisoBlocks: [],
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
    bodyMd: "Maswali ya mara kwa mara kuhusu kuhifadhi safari na njia ya Nairobi–Kisumu.",
    aisoBlocks: [
      {
        id: "faq",
        type: "faq",
        title: "Maswali ya mara kwa mara",
        items: [
          {
            question: "Precifarm ni nini?",
            answer:
              "Precifarm inajenga vituo vya kuchaji na mtandao wa usafiri wa umeme kati ya miji mikuu nchini Kenya.",
          },
          {
            question: "Bei ya Nairobi–Kisumu ni kiasi gani?",
            answer: "KSh 1,550 kwa kila kiti kwenye basi la umeme Yutong U18.",
          },
          {
            question: "Je, naweza kulipa kwa M-Pesa?",
            answer: "Ndiyo. M-Pesa STK inapatikana kwenye tovuti na programu ya Android.",
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
