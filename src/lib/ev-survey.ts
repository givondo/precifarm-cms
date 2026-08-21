import type { InstallProduct } from "@/lib/ev-ops";

const CITY_KEYWORDS: { city: string; county: string; keywords: string[] }[] = [
  { city: "Nairobi", county: "Nairobi County", keywords: ["nairobi"] },
  { city: "Kisumu", county: "Kisumu County", keywords: ["kisumu"] },
  { city: "Nakuru", county: "Nakuru County", keywords: ["nakuru"] },
  { city: "Mombasa", county: "Mombasa County", keywords: ["mombasa"] },
  { city: "Eldoret", county: "Uasin Gishu County", keywords: ["eldoret"] },
];

export function inferProductFromLead(interest: string, message: string): InstallProduct | null {
  const text = `${interest} ${message}`.toLowerCase();

  if (
    !interest.includes("Home charger") &&
    !text.includes("pulse") &&
    !text.includes("pod") &&
    !text.includes("spark") &&
    !text.includes("home charg")
  ) {
    return null;
  }

  const productLine = message.match(/product interest:\s*(.+)/i)?.[1]?.toLowerCase() ?? text;
  if (productLine.includes("pod")) return "pod";
  if (productLine.includes("spark")) return "spark";
  if (productLine.includes("pulse")) return "pulse";
  return "pulse";
}

export function inferCityFromLead(message: string): { city: string; county: string } {
  const cityLine = message.match(/city:\s*(.+)/i)?.[1]?.trim();
  const lower = (cityLine ?? message).toLowerCase();
  for (const row of CITY_KEYWORDS) {
    if (row.keywords.some((k) => lower.includes(k))) {
      return { city: row.city, county: row.county };
    }
  }
  return { city: "Nairobi", county: "Nairobi County" };
}

export function wantsLipaPolePole(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("lipa pole pole") || lower.includes("installment") || lower.includes("instalment");
}
