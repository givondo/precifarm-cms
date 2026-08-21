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
      "Kenyan company that installs, finances and runs EV charging — from home charging to highway charging, paid with M-Pesa.",
    url: SITE_URL,
    metadata: {},
    aliases: [],
  },
  {
    slug: "nairobi-kisumu",
    type: "route",
    name: "Nairobi – Kisumu",
    description: "Live intercity electric bus route on the Precifarm network.",
    url: `${SITE_URL}/#book`,
    metadata: { duration: "4h 45m", distance: "345 km", fare: 1550, currency: "KES" },
    aliases: ["Nairobi Kisumu", "Nairobi to Kisumu"],
  },
  {
    slug: "yutong-u18",
    type: "equipment",
    name: "Yutong U18",
    description: "Electric intercity bus used on Nairobi–Kisumu scheduled service.",
    metadata: {},
    aliases: [],
  },
  {
    slug: "ev-fast-charger",
    type: "equipment",
    name: "DC Fast Charger",
    description: "Hub fast charging for Corridor charging, fleets and public DC sessions.",
    metadata: {},
    aliases: ["EV charger", "fast charger"],
  },
  {
    slug: "hub-charging",
    type: "service",
    name: "Highway charging",
    description: "Corridor charging at Precifarm hubs — about 60 kWh in 30 minutes, paid with M-Pesa.",
    url: `${SITE_URL}/charging`,
    metadata: {},
    aliases: [],
  },
  {
    slug: "nairobi",
    type: "location",
    name: "Nairobi",
    description: "Kenya's capital — Pulse and Pod home charging, Depot charging and the Charging Hub.",
    metadata: { county: "Nairobi County", region: "Central Kenya", lat: -1.2921, lng: 36.8219 },
    aliases: ["Nairobi City"],
  },
  {
    slug: "kisumu",
    type: "location",
    name: "Kisumu",
    description: "Lake Victoria city on the Nairobi–Kisumu corridor — Charging Hub and home charging coverage.",
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
  {
    slug: "pulse-charger",
    type: "equipment",
    name: "Pulse charger",
    description:
      "7 kW home wallbox. A typical 60 km day refills in about 90 minutes. From KES 79,000 with Lipa Pole Pole on M-Pesa.",
    url: `${SITE_URL}/charging/private-house`,
    metadata: { powerKw: 7, priceFromKes: 79000 },
    aliases: ["Pulse", "Pulse home charger"],
  },
  {
    slug: "pod-charger",
    type: "equipment",
    name: "Pod charger",
    description:
      "Home wallbox with 5 or 10 kWh storage for weak-grid evenings. From KES 295,000 with Lipa Pole Pole on M-Pesa.",
    url: `${SITE_URL}/charging/private-house`,
    metadata: { priceFromKes: 295000 },
    aliases: ["Pod", "Pod home charger"],
  },
  {
    slug: "spark-charger",
    type: "equipment",
    name: "Spark charger",
    description:
      "Portable 3.3 kW charger for the boot. A typical 60 km day refills in about 180 minutes. From KES 25,000.",
    url: `${SITE_URL}/charging`,
    metadata: { powerKw: 3.3, priceFromKes: 25000 },
    aliases: ["Spark"],
  },
  {
    slug: "corridor-charging",
    type: "equipment",
    name: "Corridor charging",
    description:
      "120 kW+ highway DC. Adds about 60 kWh in 30 minutes. Public DC from KES 39/kWh.",
    url: `${SITE_URL}/network`,
    metadata: { powerKw: 120, publicDcFromKesPerKwh: 39 },
    aliases: ["Corridor", "highway DC"],
  },
];

const content = [
  {
    slug: "book-nairobi-kisumu-coach",
    title: "How to book Nairobi–Kisumu electric bus tickets",
    description:
      "Step-by-step guide to booking a reserved seat on Precifarm's Nairobi–Kisumu Yutong U18 service with M-Pesa payment and SMS ticket delivery.",
    contentType: "guide",
    bodyMd: `## Overview

Precifarm operates scheduled electric bus service between Nairobi and Kisumu on the Yutong U18. Book online at precifarm.com or through the Android passenger app.

## Before you book

- Have a valid **National ID or passport** ready for boarding
- Use an **M-Pesa registered phone number**
- Fixed fare: **KSh 1,550** per seat
- Journey: **~4h 45m** · **~345 km**
- Daily departures: **06:00, 08:00, 10:00, 14:00, 16:00**

## Steps

1. Open the booking form at [precifarm.com/#book](https://precifarm.com/#book)
2. Select your travel date and departure time
3. Choose your seat on the bus layout
4. Enter passenger name, phone number and ID number
5. Confirm details and pay with **M-Pesa STK push**
6. Save your SMS ticket with reference **PF-XXXXXX**

## After booking

Arrive at the departure point before boarding time. Present your ID and booking reference to the operator. Precifarm sends an SMS if the departure time or boarding point changes.

## Why hub charging matters

Every departure has **reserved hub charging** locked in before the bus leaves — energy you can plan around, not a charger you hope is free.`,
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
          "Choose your seat on the Yutong U18 bus",
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
          "Yutong U18 electric intercity bus",
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
      "Answers to common questions about booking Nairobi–Kisumu electric bus travel, M-Pesa payment, tickets, boarding and charging hubs.",
    contentType: "faq",
    bodyMd: `Answers to the most common questions about booking on Precifarm — Nairobi–Kisumu electric bus travel, M-Pesa tickets and hub charging. For home Pulse prices, public DC kWh rates and typical daily cost versus petrol, see the charging economics FAQ.`,
    aisoBlocks: [
      {
        id: "faq",
        type: "faq",
        title: "Frequently asked questions",
        items: [
          {
            question: "What is Precifarm?",
            answer:
              "Precifarm designs, finances, installs and operates EV charging for homes, fleets and highway corridors in Kenya, with M-Pesa on every product. Licensed partners operate buses; passenger booking on Nairobi–Kisumu is a companion surface.",
          },
          {
            question: "How do I book a seat on Nairobi–Kisumu?",
            answer:
              "Visit precifarm.com/#book, choose your departure date and time, select a seat, enter passenger details and pay with M-Pesa. You receive an SMS ticket with your booking reference (PF-XXXXXX).",
          },
          {
            question: "How much does Nairobi–Kisumu cost?",
            answer: "The fixed fare is KSh 1,550 per seat on the Yutong U18 electric bus.",
          },
          {
            question: "What payment methods are accepted?",
            answer:
              "M-Pesa STK push for Nairobi–Kisumu tickets on precifarm.com and the Android app. M-Pesa also pays home Pulse instalments (Lipa Pole Pole) and public charging sessions. Demo mode may be active in test environments.",
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
              "View Precifarm hubs and partner networks on the Charging Hub at precifarm.com/network. Public DC at Depot and Corridor sites is from KES 39/kWh; session price is shown before you start.",
          },
          {
            question: "How much does EV charging cost?",
            answer:
              "Home Pulse starts from KES 79,000 with Lipa Pole Pole on M-Pesa. A typical Nairobi driving day of about 60 km is roughly KES 140 in home electricity versus about KES 850 in petrol. Public DC is from KES 39/kWh. See the charging economics FAQ for what a house install includes.",
          },
          {
            question: "Is there a Precifarm mobile app?",
            answer:
              "Yes. Download the Android app at precifarm.com/download to find chargers, request a home install and pay with M-Pesa. iOS is not available yet.",
          },
          {
            question: "Who operates the buses?",
            answer:
              "Licensed partner operators run the Yutong U18 buses on the published schedule. Precifarm provides the energy, booking network and operating standards.",
          },
        ],
      },
    ],
  },
  {
    slug: "ev-charging-hubs-kenya",
    title: "From home charging to highway charging in Kenya",
    description:
      "How Precifarm charging works — Pulse and Pod at home, Depot and Boda Hub for fleets, Corridor charging on the highway, paid with M-Pesa.",
    contentType: "guide",
    bodyMd: `## From home charging to highway charging

Precifarm installs, finances and runs EV charging in Kenya. Choose Pulse and Pod at home, Depot and Boda Hub for fleets, or Corridor charging on the highway — pay with M-Pesa on every product.

## Home charging

Start with the **Pulse charger** on your wall (typical 60 km day in about 90 minutes, from KES 79,000), add the **Pod charger** when you want storage for weak-grid evenings (from KES 295,000), or keep the **Spark charger** in the boot (about 180 minutes from a normal socket). A **home charging day** costs about **KES 140** instead of about **KES 850** in petrol.

Request a survey at [precifarm.com/charging/private-house](https://precifarm.com/charging/private-house).

## Fleet charging

The **Depot charging station** adds 40+ kWh in about 120 minutes while vehicles are parked. **Boda Hub** swaps a fresh battery in under 5 minutes.

## Highway charging

**Corridor charging** adds about 60 kWh in 30 minutes at highway hubs. Public DC is **from KES 39/kWh**. Find live sites on the [Charging Hub](https://precifarm.com/network). Live sites are labelled live; planned corridors stay labelled planned.

## Four layers at a highway hub

1. **Grid + solar + storage** — dependable energy with predictable costs
2. **Corridor DC (CCS2)** — about 60 kWh in 30 minutes, paid with M-Pesa
3. **Dwell** — safe circulation, shade and amenities
4. **Live monitoring** — 24/7 status, OCPP telemetry and honest recovery

Solar on a hub canopy does **not** replace Kenya Power. Planning figures: a 40–80 kWp canopy yields roughly 180–440 kWh/day and covers about 12–30% of an illustrative 1,500 kWh/day hub. Utilisation and tariff classification move payback more than charger brochure efficiency.`,
    aisoBlocks: [
      {
        id: "summary",
        type: "executive_summary",
        title: "Summary",
        content:
          "Precifarm charging runs from home Pulse and Pod to highway Corridor DC — M-Pesa on every product. A home charging day costs about KES 140 versus about KES 850 in petrol. Public DC is from KES 39/kWh.",
      },
      {
        id: "facts",
        type: "key_facts",
        title: "Key facts",
        items: [
          "Pulse charger from KES 79,000 · typical day in about 90 minutes",
          "A home charging day (~60 km) about KES 140 vs ~KES 850 petrol",
          "Public DC from KES 39/kWh · Corridor about 60 kWh in 30 minutes",
          "Lipa Pole Pole finances Pulse and Pod on M-Pesa — not a charger",
          "Live Charging Hub sites labelled live; planned corridors stay planned",
        ],
      },
    ],
  },
  {
    slug: "download-precifarm-android-app",
    title: "How to download the Precifarm Android charging app",
    description:
      "Install the Precifarm Android app to find chargers, request Pulse or Pod home charging, and pay with M-Pesa. iOS is not available yet.",
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

Charging is the primary app: find public chargers, browse Spark to Corridor, and request a Pulse or Pod survey. Nairobi–Kisumu seat booking is a companion surface on the same M-Pesa rail.

The app uses the same published charging prices as precifarm.com.`,
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
          "Launch Precifarm to find chargers or request home charging",
        ],
      },
    ],
  },
  {
    slug: "ev-charging-economics-faq",
    title: "EV charging costs in Kenya — Precifarm FAQ",
    description:
      "Pulse charger from KES 79,000, public DC from KES 39/kWh, a home charging day about KES 140 versus petrol, Lipa Pole Pole on M-Pesa, Charging Hub and what a home install includes.",
    contentType: "faq",
    bodyMd: `Published starting prices for Precifarm charging in Kenya. Session price is always shown in the app and at the charger before you start. Typical daily figures depend on your tariff, vehicle and kilometres driven. Hub solar and payback numbers in the engineering package are planning assumptions, not quotations.

See also [private house charging](https://precifarm.com/charging/private-house), the [Charging Hub](https://precifarm.com/network) and the [engineering design package](https://precifarm.com/charging/engineering).`,
    aisoBlocks: [
      {
        id: "faq",
        type: "faq",
        title: "Charging economics",
        items: [
          {
            question: "How much does home charging cost per day?",
            answer:
              "A typical Nairobi driving day of about 60 km — a home charging day — costs roughly KES 140 in electricity at home versus about KES 850 in petrol — a typical saving of about KES 700 a day. On a Pulse charger, that day refills in about 90 minutes. Actual cost depends on your Kenya Power tariff, vehicle efficiency and kilometres driven.",
          },
          {
            question: "How much is a Pulse charger?",
            answer:
              "The Pulse charger starts from KES 79,000, with Lipa Pole Pole instalments on M-Pesa. A typical 60 km day refills in about 90 minutes at 7 kW. The quoted price follows a house survey — consumer-unit upgrades, extra cabling or civil works are priced separately if they are needed.",
          },
          {
            question: "How long does home charging take?",
            answer:
              "A typical Nairobi day of about 60 km is roughly 10 kWh. On a Pulse charger at 7 kW, that refills in about 90 minutes. Plug in overnight and most drivers wake up full. A Spark charger from a normal socket takes about 180 minutes for the same day.",
          },
          {
            question: "How much is public DC charging?",
            answer:
              "Public DC at Precifarm Depot and Corridor sites is from KES 39/kWh. The session price is shown in the app and at the charger before you start. Charging on your own home meter is usually cheaper per kWh than public DC.",
          },
          {
            question: "What is the Charging Hub?",
            answer:
              "The Charging Hub at precifarm.com/network is Precifarm's map of route charging hubs, partner chargers (including EVChaja and ChargeNet) and planned corridor sites across Kenya. Filter DC fast chargers, check status and navigate to a site.",
          },
          {
            question: "Why is home charging cheaper than public DC?",
            answer:
              "At home you pay your household electricity tariff on your own meter. Public Depot and Corridor sites recover charger hardware, Kenya Power demand, monitoring and uptime — so the published public rate starts from KES 39/kWh, still typically far below petrol for the same kilometres.",
          },
          {
            question: "What is Lipa Pole Pole?",
            answer:
              "Lipa Pole Pole is Precifarm instalment financing on M-Pesa. Pay a deposit and spread the balance on any phone — no bank account required. It applies to Pulse and Pod home installs.",
          },
          {
            question: "How do I get a home charger?",
            answer:
              "Visit precifarm.com/charging/private-house or open the Precifarm app, request a Pulse or Pod survey, and pay the deposit via M-Pesa. Certified install and commissioning typically take one day after survey approval. Five-year engineering care is included on every home unit.",
          },
          {
            question: "What is the difference between the Pulse and Pod chargers?",
            answer:
              "The Pulse charger is a 7 kW wall unit that refills a typical 60 km day in about 90 minutes on your home meter. The Pod charger adds 5 or 10 kWh of storage, and optional rooftop solar, so you can keep charging when the grid is weak or when the roof is producing.",
          },
          {
            question: "What is the Spark charger?",
            answer:
              "The Spark charger is a 3.3 kW portable unit that refills a typical day in about 180 minutes from a normal socket and travels in the boot. Use it where you have a suitable outlet. It is not a public Corridor charging session, and you pay the electricity at that site.",
          },
          {
            question: "How do I pay at a public charger?",
            answer:
              "Start the session in the Precifarm Android app or at the charger and pay with M-Pesa. The price per kWh is shown before you start. Public DC at Depot and Corridor sites is from KES 39/kWh.",
          },
          {
            question: "What is included in a private house install?",
            answer:
              "Remote intake and property survey, a written quote and single-line diagram, charger supply and install (CCS2 or Type 2 for your vehicle), commissioning, handover, remote monitoring and five-year engineering support. Optional Pod solar and LiFePO₄ storage. Kenya Power service upgrades and unusual civil works are not included unless they appear on the quote.",
          },
          {
            question: "Does rooftop solar replace Kenya Power at home?",
            answer:
              "No. Pod solar and home storage cut grid cost and add backup; they do not replace a working supply or a site survey. House charging stays on your meter. Solar is sized to your roof and daily mileage, not as a substitute for the grid.",
          },
          {
            question: "Does solar power a charging hub on its own?",
            answer:
              "No. A 40–80 kWp canopy in Kenya yields roughly 180–440 kWh/day. Against an illustrative 1,500 kWh/day hub, PV covers about 12–30% of daily energy. Solar is for cost, shade and resilience — it does not replace a Kenya Power feeder study. These figures are planning assumptions.",
          },
          {
            question: "What payment methods are accepted?",
            answer:
              "M-Pesa for home instalments (Lipa Pole Pole) and public charging sessions. USSD and SMS work on basic phones — no bank account required.",
          },
          {
            question: "Where are Precifarm public chargers?",
            answer:
              "See the Charging Hub at precifarm.com/network for Precifarm hubs and partner networks including EVChaja and ChargeNet across Kenya.",
          },
          {
            question: "What is Precifarm?",
            answer:
              "Precifarm is Kenya's electric mobility infrastructure company. We design, finance, install and operate charging and energy systems for homes, fleets and highway corridors, with M-Pesa on every product.",
          },
        ],
      },
    ],
  },
  {
    slug: "home-ev-charging-cost-kenya",
    title: "Home EV charging cost in Kenya — daily electricity vs petrol",
    description:
      "What a typical Nairobi driving day costs on a home Pulse charger versus petrol, Kenya Power tariffs, and when public DC from KES 39/kWh makes sense.",
    contentType: "guide",
    bodyMd: `## What does home EV charging cost in Kenya?

For many Nairobi drivers, a **typical day of about 60 km** uses roughly **10 kWh**. On your **home meter**, that day often costs about **KES 140** in electricity versus about **KES 850** in petrol — a typical saving of about **KES 700 per day**. Actual cost depends on your Kenya Power tariff, vehicle efficiency and kilometres driven.

## Pulse charger at home

The **Pulse charger** (7 kW, from **KES 79,000** with Lipa Pole Pole on M-Pesa) refills that typical day in about **90 minutes**. Plug in overnight and most drivers wake up full.

## When public DC is different

**Public DC** at Precifarm Depot and Corridor sites starts from **KES 39/kWh**. The session price is shown in the app and at the charger before you start. Public DC recovers hardware, demand charges and uptime — home charging on your own meter is usually cheaper per kWh.

## Get a quote

Request a house survey at [precifarm.com/charging/private-house](https://precifarm.com/charging/private-house). Consumer-unit upgrades, extra cabling or civil works are priced separately if needed.`,
    aisoBlocks: [
      {
        id: "summary",
        type: "executive_summary",
        title: "Summary",
        content:
          "A typical 60 km Nairobi day costs about KES 140 at home versus about KES 850 in petrol. Pulse from KES 79,000 refills in about 90 minutes. Public DC from KES 39/kWh.",
      },
      {
        id: "facts",
        type: "key_facts",
        title: "Key facts",
        items: [
          "Typical 60 km day ~ KES 140 home electricity vs ~ KES 850 petrol",
          "Pulse 7 kW from KES 79,000 · ~90 minutes for a typical day",
          "Public DC from KES 39/kWh · price shown before session starts",
          "Lipa Pole Pole instalments on M-Pesa for Pulse and Pod",
        ],
      },
    ],
  },
  {
    slug: "ev-charger-installation-kenya",
    title: "EV charger installation in Kenya — survey to commissioning",
    description:
      "How Precifarm installs a Pulse or Pod home charger in Kenya: remote intake, property survey, quote, one-day install, commissioning and five-year engineering care.",
    contentType: "guide",
    bodyMd: `## How home charger installation works

Precifarm installs **Pulse** and **Pod** chargers for private houses across Kenya. The process is designed for clarity — you see the quote before any civil work starts.

## Step 1 — Request a survey

Start at [precifarm.com/charging/private-house](https://precifarm.com/charging/private-house) or in the Precifarm Android app. Share your property details and vehicle type.

## Step 2 — Property survey and quote

A certified engineer reviews your consumer unit, cable route and parking position. You receive a written quote and single-line diagram. **Kenya Power service upgrades** or unusual civil works are priced separately if they appear on the quote.

## Step 3 — Install and commission

After deposit via M-Pesa (Lipa Pole Pole available), certified install and commissioning typically take **one day**. Every home unit includes **remote monitoring** and **five-year engineering support**.

## What is included

Charger supply and install (Type 2 or CCS2 for your vehicle), commissioning, handover and monitoring. Optional **Pod** solar and LiFePO₄ storage for weak-grid evenings.

## Not sure which charger?

- **Pulse** — 7 kW wall unit, typical day in about 90 minutes, from KES 79,000
- **Pod** — adds 5 or 10 kWh storage + optional solar, from KES 295,000
- **Spark** — portable 3.3 kW for the boot, from KES 25,000`,
    aisoBlocks: [
      {
        id: "how-to",
        type: "how_to",
        title: "Installation steps",
        items: [
          "Request a survey at precifarm.com/charging/private-house",
          "Receive written quote and single-line diagram",
          "Pay deposit via M-Pesa (Lipa Pole Pole optional)",
          "One-day certified install and commissioning",
          "Handover with remote monitoring and five-year engineering care",
        ],
      },
    ],
  },
  {
    slug: "ev-charging-vs-petrol-kenya",
    title: "EV charging vs petrol in Kenya — running cost comparison",
    description:
      "Compare daily running costs: home EV charging at about KES 140 per typical Nairobi day versus about KES 850 in petrol, plus public DC from KES 39/kWh.",
    contentType: "guide",
    bodyMd: `## Daily running cost: EV vs petrol

For a **typical Nairobi driving day of about 60 km**, home EV charging often costs about **KES 140** in electricity versus about **KES 850** in petrol — roughly **KES 700 saved per day** on energy alone. Your vehicle efficiency, tariff and kilometres will shift the exact numbers.

## Why home wins on cost

At home you pay your **household Kenya Power tariff** on your own meter. No public-site demand charges or charger hardware recovery — just kWh at domestic rates.

## When you use public DC

**Corridor** and **Depot** DC sessions start from **KES 39/kWh**. That is still typically far below petrol for the same kilometres, but home charging is usually cheaper per kWh. Find live sites on the [Charging Hub](https://precifarm.com/network).

## Upfront vs running cost

A **Pulse charger** starts from **KES 79,000** with **Lipa Pole Pole** on M-Pesa. Spread the hardware cost against daily savings and most commuters see payback on energy alone within a practical horizon — exact payback depends on your mileage and tariff.

## Next step

Request a home survey at [precifarm.com/charging/private-house](https://precifarm.com/charging/private-house).`,
    aisoBlocks: [
      {
        id: "summary",
        type: "executive_summary",
        title: "Summary",
        content:
          "Typical 60 km day: ~KES 140 home EV vs ~KES 850 petrol. Public DC from KES 39/kWh. Pulse from KES 79,000 with Lipa Pole Pole on M-Pesa.",
      },
    ],
  },
  {
    slug: "ac-vs-dc-ev-charging-kenya",
    title: "AC vs DC EV charging in Kenya — Pulse, Spark and Corridor explained",
    description:
      "Understand AC home charging (Pulse 7 kW, Spark 3.3 kW) versus DC fast charging (Corridor 120 kW+ from KES 39/kWh) for Kenyan drivers.",
    contentType: "guide",
    bodyMd: `## AC charging — home and overnight

**AC charging** uses your car's onboard converter. It is slower but gentle on batteries and ideal at home.

| Product | Power | Typical 60 km day | From |
|---|---|---|---|
| Pulse | 7 kW AC | ~90 minutes | KES 79,000 |
| Spark | 3.3 kW AC | ~180 minutes | KES 25,000 |

Pulse mounts on your wall; Spark travels in the boot and plugs into a suitable socket.

## DC fast charging — highway and hubs

**DC fast charging** bypasses the onboard converter and feeds the battery directly. Precifarm **Corridor** chargers add about **60 kWh in 30 minutes** at highway hubs. Public DC is from **KES 39/kWh** — session price shown before you start.

Use DC when you need range quickly on a corridor stop. Use AC at home for lowest daily cost.

## Find chargers

Browse live and planned sites on the [Charging Hub](https://precifarm.com/network). Request home AC install at [private house charging](https://precifarm.com/charging/private-house).`,
    aisoBlocks: [
      {
        id: "facts",
        type: "key_facts",
        title: "Key facts",
        items: [
          "Pulse 7 kW AC · ~90 min for typical day · from KES 79,000",
          "Spark 3.3 kW portable · ~180 min · from KES 25,000",
          "Corridor DC · ~60 kWh in 30 min · public from KES 39/kWh",
          "Home AC usually cheapest per kWh; DC for fast corridor stops",
        ],
      },
    ],
  },
  {
    slug: "lipa-pole-pole-ev-charger-kenya",
    title: "Lipa Pole Pole — finance a home EV charger with M-Pesa in Kenya",
    description:
      "Pay for a Pulse or Pod home charger in instalments on M-Pesa with Lipa Pole Pole. No bank account required — deposit and spread the balance on any phone.",
    contentType: "guide",
    bodyMd: `## What is Lipa Pole Pole?

**Lipa Pole Pole** is Precifarm instalment financing on **M-Pesa**. Pay a deposit and spread the balance on any phone — **no bank account required**. It applies to **Pulse** and **Pod** home installs.

## What you can finance

- **Pulse charger** — 7 kW wall unit from **KES 79,000**
- **Pod charger** — storage + optional solar from **KES 295,000**

Lipa Pole Pole is **financing**, not a charger product. You still get certified install, commissioning and five-year engineering care.

## How to start

1. Visit [precifarm.com/charging/private-house](https://precifarm.com/charging/private-house)
2. Request a property survey
3. Review your written quote
4. Pay deposit via M-Pesa and choose Lipa Pole Pole for the balance

## Running cost after install

A typical Nairobi day of about 60 km costs about **KES 140** in home electricity versus about **KES 850** in petrol — energy savings continue for the life of the charger.`,
    aisoBlocks: [
      {
        id: "how-to",
        type: "how_to",
        title: "How to use Lipa Pole Pole",
        items: [
          "Request a Pulse or Pod survey online or in the Android app",
          "Review the written quote after property survey",
          "Pay deposit via M-Pesa STK push",
          "Spread the balance with Lipa Pole Pole instalments on M-Pesa",
          "One-day install and commissioning after approval",
        ],
      },
    ],
  },
  {
    slug: "ev-charging-nairobi",
    title: "EV charging in Nairobi, Kenya — home, depot and corridor",
    description:
      "Pulse and Pod home charging from KES 79,000, Boda Hub battery swap, Depot charging and Corridor DC on Nairobi–Kisumu. Public DC from KES 39/kWh — pay with M-Pesa.",
    contentType: "local_page",
    bodyMd: `## EV charging in Nairobi

Nairobi is Precifarm's primary metro — **Pulse** and **Pod** home installs, **Boda Hub** battery swap, **Depot** fleet charging and **Corridor DC** on the Nairobi–Kisumu highway.

## Home charging in Nairobi

A typical Nairobi driving day of about **60 km** costs about **KES 140** in home electricity versus about **KES 850** in petrol. The **Pulse charger** (7 kW, from **KES 79,000** with Lipa Pole Pole on M-Pesa) refills that day in about **90 minutes**.

Request a property survey at [precifarm.com/charging/private-house](https://precifarm.com/charging/private-house).

## Public and corridor charging

Find live Precifarm hubs and partner chargers on the [Charging Hub](https://precifarm.com/network). Public DC at Depot and Corridor sites starts from **KES 39/kWh** — session price shown before you start.

## Nairobi–Kisumu corridor

Scheduled electric intercity service connects Nairobi and Kisumu with reserved hub charging. Book seats at [precifarm.com/#book](https://precifarm.com/#book) or explore corridor sites on the Charging Hub.

## Get started

- **Home install** — [private house charging](https://precifarm.com/charging/private-house)
- **Find a charger** — [Charging Hub](https://precifarm.com/network)
- **Android app** — [precifarm.com/download](https://precifarm.com/download)`,
    aisoBlocks: [
      {
        id: "summary",
        type: "executive_summary",
        title: "Summary",
        content:
          "Precifarm installs Pulse and Pod home charging in Nairobi, runs Boda Hub swap and Corridor DC on Nairobi–Kisumu. Typical home day ~KES 140 vs ~KES 850 petrol. Public DC from KES 39/kWh.",
      },
      {
        id: "facts",
        type: "key_facts",
        title: "Nairobi charging facts",
        items: [
          "Pulse home charger from KES 79,000 · Lipa Pole Pole on M-Pesa",
          "Typical 60 km day ~ KES 140 home vs ~ KES 850 petrol",
          "Public DC from KES 39/kWh at Depot and Corridor sites",
          "Charging Hub map at precifarm.com/network",
          "Nairobi County · live home, boda and corridor services",
        ],
      },
      {
        id: "faq",
        type: "faq",
        title: "Nairobi EV charging FAQ",
        items: [
          {
            question: "How much does home EV charging cost in Nairobi?",
            answer:
              "A typical Nairobi driving day of about 60 km costs roughly KES 140 in home electricity versus about KES 850 in petrol. Actual cost depends on your Kenya Power tariff, vehicle and kilometres driven.",
          },
          {
            question: "How do I get a home charger in Nairobi?",
            answer:
              "Visit precifarm.com/charging/private-house, request a Pulse or Pod survey and pay the deposit via M-Pesa. Certified install and commissioning typically take one day after survey approval.",
          },
          {
            question: "Where are public chargers in Nairobi?",
            answer:
              "Browse live and planned sites on the Charging Hub at precifarm.com/network — Precifarm hubs and partners including EVChaja and ChargeNet.",
          },
        ],
      },
    ],
  },
  {
    slug: "ev-charging-kisumu",
    title: "EV charging in Kisumu, Kenya — corridor DC and home charging",
    description:
      "Corridor DC on Nairobi–Kisumu, Boda Hub battery swap and Pulse home charging in Kisumu County. Public DC from KES 39/kWh — M-Pesa on every product.",
    contentType: "local_page",
    bodyMd: `## EV charging in Kisumu

Kisumu is the western terminus on the **Nairobi–Kisumu corridor** — **Corridor DC**, **Boda Hub** swap and **Pulse** home installs for lake-side drivers and fleets.

## Home charging in Kisumu

The **Pulse charger** starts from **KES 79,000** with Lipa Pole Pole on M-Pesa. A typical day of about 60 km refills in about 90 minutes at 7 kW and costs about **KES 140** in home electricity versus about **KES 850** in petrol.

Request a survey at [precifarm.com/charging/private-house](https://precifarm.com/charging/private-house).

## Corridor and public DC

**Corridor charging** adds about 60 kWh in 30 minutes at highway hubs. Public DC is from **KES 39/kWh** — price shown in the app and at the charger before you start.

See live sites on the [Charging Hub](https://precifarm.com/network).

## Travel Nairobi–Kisumu

Book electric intercity seats with M-Pesa at [precifarm.com/#book](https://precifarm.com/#book). Fixed fare **KSh 1,550** per seat on the Yutong U18 service.

## Get started

- **Home install** — [private house charging](https://precifarm.com/charging/private-house)
- **Charging Hub** — [precifarm.com/network](https://precifarm.com/network)
- **Contact** — [precifarm.com/contact](https://precifarm.com/contact)`,
    aisoBlocks: [
      {
        id: "summary",
        type: "executive_summary",
        title: "Summary",
        content:
          "Kisumu has Corridor DC on Nairobi–Kisumu, Boda Hub swap and Pulse home charging. Public DC from KES 39/kWh. Home day ~KES 140 vs ~KES 850 petrol.",
      },
      {
        id: "facts",
        type: "key_facts",
        title: "Kisumu charging facts",
        items: [
          "Western terminus on Nairobi–Kisumu corridor",
          "Pulse from KES 79,000 · typical day in about 90 minutes",
          "Public DC from KES 39/kWh",
          "Kisumu County · Corridor DC, Boda Hub and home charging",
          "Charging Hub at precifarm.com/network",
        ],
      },
      {
        id: "faq",
        type: "faq",
        title: "Kisumu EV charging FAQ",
        items: [
          {
            question: "Is there fast charging in Kisumu?",
            answer:
              "Corridor DC on the Nairobi–Kisumu route adds about 60 kWh in 30 minutes at highway hubs. Public DC starts from KES 39/kWh. Check live status on precifarm.com/network.",
          },
          {
            question: "Can I install a home charger in Kisumu?",
            answer:
              "Yes. Precifarm surveys and installs Pulse and Pod chargers in Kisumu County. Start at precifarm.com/charging/private-house or in the Android app.",
          },
          {
            question: "How do I pay for charging in Kisumu?",
            answer:
              "M-Pesa for public sessions and Lipa Pole Pole instalments on home installs. USSD and SMS work on basic phones — no bank account required.",
          },
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
              "Ndiyo. Pakua programu ya Android kwenye precifarm.com/download ili kupata vituo vya kuchaji, kuomba charger ya nyumbani na kulipa kwa M-Pesa. iOS bado haipatikani.",
          },
          {
            question: "Kuchaji gari la umeme kunagharimu kiasi gani?",
            answer:
              "Pulse ya nyumbani inaanza KES 79,000 kwa Lipa Pole Pole kwenye M-Pesa. Siku ya kawaida ya Nairobi ya takriban km 60 ni takriban KES 140 kwa umeme wa nyumbani dhidi ya takriban KES 850 ya petroli. DC ya umma inaanza KES 39/kWh.",
          },
        ],
      },
    ],
  },
  {
    slug: "ev-charging-economics-faq",
    locale: "sw-KE",
    title: "Gharama za kuchaji magari ya umeme Kenya — maswali ya Precifarm",
    description:
      "Pulse ya nyumbani kutoka KES 79,000, DC ya umma kutoka KES 39/kWh, gharama ya kawaida ya siku dhidi ya petroli, na Lipa Pole Pole kwenye M-Pesa.",
    contentType: "faq",
    bodyMd:
      "Bei za kuanzia za kuchaji Precifarm nchini Kenya. Bei ya kikao inaonyeshwa kabla ya kuanza. Takwimu za kila siku hutegemea tarifa yako, gari na kilomita.",
    aisoBlocks: [
      {
        id: "faq",
        type: "faq",
        title: "Gharama za kuchaji",
        items: [
          {
            question: "Kuchaji nyumbani kunagharimu kiasi gani kwa siku?",
            answer:
              "Siku ya kawaida ya Nairobi ya takriban km 60 inagharimu takriban KES 140 kwa umeme wa nyumbani dhidi ya takriban KES 850 ya petroli — akiba ya takriban KES 700 kwa siku. Gharama halisi inategemea tarifa ya Kenya Power, ufanisi wa gari na kilomita.",
          },
          {
            question: "Pulse ya nyumbani inagharimu kiasi gani?",
            answer:
              "Pulse inaanza KES 79,000, na Lipa Pole Pole kwenye M-Pesa. Bei kamili inatolewa baada ya uchunguzi wa nyumba — uboreshaji wa mita, kebo za ziada au kazi za ujenzi zinawekwa bei tofauti zinapohitajika.",
          },
          {
            question: "Kuchaji DC ya umma kunagharimu kiasi gani?",
            answer:
              "DC ya umma kwenye vituo vya Depot na Corridor inaanza KES 39/kWh. Bei ya kikao inaonyeshwa kwenye programu na kwenye charger kabla ya kuanza. Kuchaji kwenye mita yako ya nyumbani kwa kawaida ni nafuu kwa kWh kuliko DC ya umma.",
          },
          {
            question: "Lipa Pole Pole ni nini?",
            answer:
              "Lipa Pole Pole ni malipo ya awamu ya Precifarm kwenye M-Pesa. Lipa deposit na gawanya salio kwenye simu yoyote — hakuna akaunti ya benki inayohitajika. Inatumika kwa Pulse na Pod za nyumbani.",
          },
          {
            question: "Je, sola ya paa inachukua nafasi ya Kenya Power nyumbani?",
            answer:
              "Hapana. Sola ya Pod na hifadhi ya nyumbani hupunguza gharama ya gridi na kuongeza backup; haichukui nafasi ya usambazaji au uchunguzi wa tovuti. Kuchaji nyumbani hubaki kwenye mita yako.",
          },
          {
            question: "Charging Hub ni nini?",
            answer:
              "Charging Hub kwenye precifarm.com/network ni ramani ya vituo vya kuchaji vya Precifarm, vichaji vya washirika (pamoja na EVChaja na ChargeNet) na maeneo yaliyopangwa kwenye njia kuu nchini Kenya.",
          },
          {
            question: "Tofauti kati ya Pulse na Pod ni nini?",
            answer:
              "Pulse ni charger ya ukuta ya 7 kW kwenye mita yako ya nyumbani. Pod inaongeza hifadhi ya 5 au 10 kWh, na sola ya paa inayoweza kuchaguliwa, ili uendelee kuchaji gridi inapokuwa dhaifu au paa inapozalisha.",
          },
          {
            question: "Spark ni nini?",
            answer:
              "Spark ni charger ya kubebeka ya 3.3 kW inayosafiri kwenye boot. Itumie pale palipo na soketi inayofaa. Si kikao cha Corridor cha umma, na unalipa umeme wa mahali hapo.",
          },
          {
            question: "Ninalipaje kwenye charger ya umma?",
            answer:
              "Anza kikao kwenye programu ya Android ya Precifarm au kwenye charger na lipa kwa M-Pesa. Bei kwa kWh inaonyeshwa kabla ya kuanza. DC ya umma kwenye Depot na Corridor inaanza KES 39/kWh.",
          },
          {
            question: "Vituo vya kuchaji vya Precifarm viko wapi?",
            answer:
              "Tazama Charging Hub kwenye precifarm.com/network kwa vituo vya Precifarm na mitandao washirika kama EVChaja na ChargeNet nchini Kenya.",
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
