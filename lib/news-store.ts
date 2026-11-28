import archiveData from "@/data/archive.json";
import newsData from "@/data/news.json";
import type { NewsArticle } from "@/types/news";

export function getFrontPageArticles(): NewsArticle[] {
  return (Array.isArray(newsData) ? newsData : []) as NewsArticle[];
}

export function getArchiveArticles(): NewsArticle[] {
  const frontIds = new Set(getFrontPageArticles().map((a) => a.id));
  const archive = (Array.isArray(archiveData) ? archiveData : []) as NewsArticle[];
  return archive.filter((a) => !frontIds.has(a.id));
}

export function getAllIndexedArticles(): NewsArticle[] {
  return [...getFrontPageArticles(), ...getArchiveArticles()];
}
