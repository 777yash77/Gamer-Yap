import NewsFeed from "@/components/NewsFeed";
import newsData from "@/data/news.json";
import type { NewsArticle } from "@/types/news";

export default function HomePage() {
  const articles = (Array.isArray(newsData) ? newsData : []) as NewsArticle[];
  return <NewsFeed articles={articles} />;
}
