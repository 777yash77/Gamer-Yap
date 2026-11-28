import NewsFeed from "@/components/NewsFeed";
import { getFrontPageArticles } from "@/lib/news-store";

export default function HomePage() {
  const articles = getFrontPageArticles();
  return <NewsFeed articles={articles} />;
}
