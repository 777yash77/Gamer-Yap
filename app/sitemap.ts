import type { MetadataRoute } from "next";
import { getArchiveArticles, getFrontPageArticles } from "@/lib/news-store";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const frontArticles = getFrontPageArticles();
  const archiveArticles = getArchiveArticles();

  const latestPublished =
    frontArticles[0]?.publishedAt ||
    archiveArticles[0]?.publishedAt ||
    "2026-11-28T00:00:00.000Z";

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: latestPublished,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: latestPublished,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/privacy-policy`,
      lastModified: latestPublished,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: latestPublished,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: latestPublished,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  const activeRoutes: MetadataRoute.Sitemap = frontArticles.map((article) => ({
    url: `${siteUrl}/news/${article.id}`,
    lastModified: article.publishedAt,
    changeFrequency: "hourly",
    priority: article.gameScale === "AAA" ? 0.9 : 0.7,
  }));

  const archivedRoutes: MetadataRoute.Sitemap = archiveArticles.map((article) => ({
    url: `${siteUrl}/news/${article.id}`,
    lastModified: article.publishedAt,
    changeFrequency: "daily",
    priority: 0.5,
  }));

  return [...staticRoutes, ...activeRoutes, ...archivedRoutes];
}
