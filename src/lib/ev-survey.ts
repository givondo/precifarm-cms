import type { InstallProduct } from "@/lib/ev-ops";

const CITY_KEYWORDS: { city: string; county: string; keywords: string[] }[] = [
  { city: "Nairobi", county: "Nairobi County", keywords: ["nairobi"] },
  { city: "Kisumu", county: "Kisumu County", keywords: ["kisumu"] },
  { city: "Nakuru", county: "Nakuru County", keywords: ["nakuru"] },
  { city: "Mombasa", county: "Mombasa County", keywords: ["mombasa"] },
  { city: "Eldoret", county: "Uasin Gishu County", keywords: ["eldoret"] },
  { city: "Kitui", county: "Kitui County", keywords: ["kitui"] },
];

/** Whole words only, so "podcast", "sparked" or "impulse" do not read as a product. */
const PRODUCT_WORDS: [InstallProduct, RegExp][] = [
  ["pod", /\bpod\b/i],
  ["spark", /\bspark\b/i],
  ["pulse", /\bpulse\b/i],
];

function productIn(text: string): InstallProduct | null {
  for (const [product, re] of PRODUCT_WORDS) if (re.test(text)) return product;
  return null;
}

export function inferProductFromLead(interest: string, message: string): InstallProduct | null {
  const text = `${interest} ${message}`;
  if (!/home charger/i.test(interest) && !/home charg/i.test(text) && !productIn(text)) {
    return null;
  }

  // The survey form's product line decides; otherwise what the customer wrote. Never the interest
  // label, which names both Pulse and Pod.
  const productLine = message.match(/product interest:\s*(.+)/i)?.[1] ?? message;
  return productIn(productLine) ?? "pulse";
}

export function inferCityFromLead(message: string): { city: string; county: string } {
  const cityLine = message.match(/city:\s*(.+)/i)?.[1]?.trim();
  const lower = (cityLine ?? message).toLowerCase();
  for (const row of CITY_KEYWORDS) {
    if (row.keywords.some((k) => lower.includes(k))) {
      return { city: row.city, county: row.county };
    }
  }
  // A city the customer named but we do not list is kept as given, not filed under Nairobi.
  if (cityLine) return { city: cityLine.slice(0, 64), county: "" };
  return { city: "Nairobi", county: "Nairobi County" };
}

export function wantsLipaPolePole(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("lipa pole pole") || lower.includes("installment") || lower.includes("instalment");
}
