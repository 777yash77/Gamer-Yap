import type { MetadataRoute } from "next";
import newsData from "@/data/news.json";
import { getSiteUrl } from "@/lib/site";
import type { NewsArticle } from "@/types/news";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const articles = (Array.isArray(newsData) ? newsData : []) as NewsArticle[];

  const latestPublished = articles[0]?.publishedAt || "2026-11-27T00:00:00.000Z";

  const articleRoutes: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${siteUrl}/news/${article.id}`,
    lastModified: article.publishedAt,
    changeFrequency: "hourly",
    priority: article.gameScale === "AAA" ? 0.9 : 0.7,
  }));

  return [
    {
      url: siteUrl,
      lastModified: latestPublished,
      changeFrequency: "hourly",
      priority: 1,
    },
    ...articleRoutes,
  ];
}
