import type { MetadataRoute } from "next";

/** The CMS is an internal tool: keep it out of search engines. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
