import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ArticleThumbnail from "@/components/ArticleThumbnail";
import BookmarkButton from "@/components/BookmarkButton";
import ShareButton from "@/components/ShareButton";
import newsData from "@/data/news.json";
import {
  ALL_GRAVITY,
  computeGravityScore,
  getLatestPublishedMs,
} from "@/lib/ranking";
import { getSiteUrl } from "@/lib/site";
import type { NewsArticle, NewsCategory, SocialPulse } from "@/types/news";

const CATEGORY_TEXT_ACCENT: Record<NewsCategory, string> = {
  PC: "text-sky-700 border-sky-300 bg-sky-50 dark:text-sky-400 dark:border-sky-400/30 dark:bg-sky-500/10",
  Console:
    "text-violet-700 border-violet-300 bg-violet-50 dark:text-violet-400 dark:border-violet-400/30 dark:bg-violet-500/10",
  Industry:
    "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-400/30 dark:bg-amber-500/10",
  Reviews:
    "text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-400/30 dark:bg-emerald-500/10",
};

const SENTIMENT_STYLES: Record<SocialPulse["sentiment"], string> = {
  Backlash:
    "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
  Heated:
    "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-300",
  Divided:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
  Hyped:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  Mixed:
    "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300",
};

function getArticles(): NewsArticle[] {
  return (Array.isArray(newsData) ? newsData : []) as NewsArticle[];
}

function formatUtcTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Recent";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

function estimateReadMinutes(article: NewsArticle): number {
  const fullText = [
    article.summary,
    ...(article.content || []),
    article.socialPulse?.summary || "",
  ].join(" ");
  const words = fullText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

export function generateStaticParams() {
  const params = getArticles().map((article) => ({ id: article.id }));
  return params.length > 0 ? params : [{ id: "__placeholder__" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const article = getArticles().find((a) => a.id === id);
  if (!article) {
    return { title: "Story Not Found | Gamer Yap" };
  }

  const siteUrl = getSiteUrl();
  const articleUrl = `${siteUrl}/news/${article.id}`;
  const ogImages = article.image
    ? [{ url: article.image, alt: article.title }]
    : undefined;

  return {
    title: `${article.title} | Gamer Yap`,
    description: article.summary,
    alternates: { canonical: articleUrl },
    openGraph: {
      type: "article",
      url: articleUrl,
      title: article.title,
      description: article.summary,
      publishedTime: article.publishedAt,
      section: article.category,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.summary,
      images: article.image ? [article.image] : undefined,
    },
  };
}

async function ArticleContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rawArticles = getArticles();
  const latestMs = getLatestPublishedMs(rawArticles);
  const orderedArticles = [...rawArticles].sort(
    (a, b) =>
      computeGravityScore(b, latestMs, ALL_GRAVITY) -
      computeGravityScore(a, latestMs, ALL_GRAVITY)
  );

  const currentIdx = orderedArticles.findIndex((a) => a.id === id);
  if (currentIdx === -1) {
    notFound();
  }

  const article = orderedArticles[currentIdx];
  const prevStory = currentIdx > 0 ? orderedArticles[currentIdx - 1] : null;
  const nextStory =
    currentIdx < orderedArticles.length - 1
      ? orderedArticles[currentIdx + 1]
      : null;

  const paragraphs =
    article.content && article.content.length > 0
      ? article.content
      : [article.summary];

  const highlights = article.highlights || [];
  const socialPulse = article.socialPulse;
  const readMinutes = estimateReadMinutes(article);
  const categoryBadgeStyle =
    CATEGORY_TEXT_ACCENT[article.category] ||
    "text-zinc-700 border-zinc-300 bg-zinc-100 dark:text-zinc-300 dark:border-zinc-700 dark:bg-zinc-800/40";

  const relatedStories = orderedArticles
    .filter((a) => a.id !== article.id)
    .sort((a, b) => {
      const aGameMatch =
        article.gameTitle && a.gameTitle === article.gameTitle ? 2 : 0;
      const bGameMatch =
        article.gameTitle && b.gameTitle === article.gameTitle ? 2 : 0;
      const aCatMatch = a.category === article.category ? 1 : 0;
      const bCatMatch = b.category === article.category ? 1 : 0;
      return bGameMatch + bCatMatch - (aGameMatch + aCatMatch);
    })
    .slice(0, 3);

  const siteUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.summary,
    image: article.image ? [article.image] : [],
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    mainEntityOfPage: `${siteUrl}/news/${article.id}`,
    author: {
      "@type": "Organization",
      name: article.source,
    },
    publisher: {
      "@type": "Organization",
      name: "Gamer Yap",
      url: siteUrl,
    },
  };

  return (
    <article className="py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* Top Breadcrumb & Quick Actions Bar */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-white/[0.08]">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-500">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-semibold text-zinc-900 transition-colors hover:text-[#d91b38] dark:text-zinc-200 dark:hover:text-[#ff2e4c]"
          >
            <svg
              className="h-3.5 w-3.5 text-[#e11d3a] dark:text-[#ff2e4c]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            <span>Back to Home</span>
          </Link>
          <span className="text-zinc-400 dark:text-zinc-700">/</span>
          <span className="text-zinc-700 uppercase dark:text-zinc-400">
            {article.category}
          </span>
          <span className="text-zinc-400 dark:text-zinc-700">/</span>
          <span className="text-zinc-600 uppercase dark:text-zinc-400">
            {article.source}
          </span>
          <span className="text-zinc-400 dark:text-zinc-700">•</span>
          <span className="text-zinc-500 uppercase">{readMinutes} min read</span>
        </div>

        <div className="flex items-center gap-2">
          <BookmarkButton articleId={article.id} variant="pill" />
          <ShareButton title={article.title} />
        </div>
      </div>

      {/* Article Header */}
      <header className="mx-auto max-w-4xl">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          {article.gameScale && (
            <span className="inline-flex items-center rounded bg-zinc-900 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-amber-300 uppercase dark:bg-amber-400/15">
              {article.gameScale}
            </span>
          )}
          {article.isRumor && (
            <span className="inline-flex items-center rounded bg-amber-500 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-zinc-950 uppercase">
              Rumor
            </span>
          )}
          {article.isControversy && (
            <span className="inline-flex items-center rounded bg-[#e11d3a] px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-white uppercase dark:bg-[#ff2e4c]">
              {article.controversyAngle || "Controversy"}
            </span>
          )}
          {article.isUpcoming && (
            <span className="inline-flex items-center rounded bg-indigo-600 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-white uppercase">
              Upcoming • {article.releaseWindow || "Coming Soon"}
            </span>
          )}
          <span
            className={`inline-flex items-center rounded border px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase ${categoryBadgeStyle}`}
          >
            {article.category}
          </span>
          {article.gameTitle && (
            <span className="inline-flex items-center rounded bg-zinc-200/80 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-800 uppercase dark:bg-white/[0.06] dark:text-zinc-300">
              {article.gameTitle}
            </span>
          )}
          <span className="font-mono text-xs font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
            Via {article.source}
          </span>
          <span className="text-zinc-400 dark:text-zinc-700">•</span>
          <time
            dateTime={article.publishedAt}
            className="font-mono text-xs text-zinc-600 dark:text-zinc-500"
          >
            {formatUtcTimestamp(article.publishedAt)}
          </time>
        </div>

        <h1 className="font-display text-3xl leading-[1.08] font-extrabold tracking-[-0.03em] text-zinc-950 sm:text-4xl lg:text-5xl dark:text-white">
          {article.title}
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-zinc-700 sm:text-xl dark:text-zinc-300">
          {article.summary}
        </p>
      </header>

      {/* Hero Artwork */}
      <div className="mx-auto my-8 max-w-4xl">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900 shadow-sm dark:border-white/[0.1] dark:bg-zinc-950 dark:shadow-none">
          <ArticleThumbnail
            src={article.image}
            alt={article.title}
            priority
            sizes="(max-width: 1024px) 100vw, 896px"
          />
        </div>
      </div>

      {/* Key Takeaways + Body + Detailed Social Pulse */}
      <div className="mx-auto max-w-3xl">
        {highlights.length > 0 && (
          <section
            aria-label="Key takeaways"
            className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs sm:p-6 dark:border-white/[0.08] dark:bg-[#12141a] dark:shadow-none"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2.5 w-2.5 bg-[#e11d3a] dark:bg-[#ff2e4c]" />
              <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-900 uppercase dark:text-zinc-200">
                Key Takeaways
              </h2>
            </div>
            <ul className="space-y-2.5">
              {highlights.map((point, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e11d3a] dark:bg-[#ff2e4c]" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="space-y-6 text-[16.5px] leading-[1.78] text-zinc-800 dark:text-zinc-200">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        {/* Elaborated Social Media & Player Opinion Section */}
        {socialPulse && (
          <section
            aria-label="Social media opinions and player reactions"
            className="mt-10 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7 dark:border-white/[0.1] dark:bg-[#101218] dark:shadow-none"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-1.5 bg-[#e11d3a] dark:bg-[#ff2e4c]" />
                <h2 className="font-display text-lg font-extrabold tracking-tight text-zinc-950 uppercase dark:text-white">
                  Social Media Pulse &amp; Player Opinions
                </h2>
              </div>
              <span
                className={`rounded border px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase ${SENTIMENT_STYLES[socialPulse.sentiment]
                  }`}
              >
                Sentiment: {socialPulse.sentiment}
              </span>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                Trending On:
              </span>
              {socialPulse.viralPlatforms.map((platform) => (
                <span
                  key={platform}
                  className="rounded border border-zinc-300 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-700 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-zinc-300"
                >
                  {platform}
                </span>
              ))}
            </div>

            <p className="text-[15.5px] leading-[1.72] text-zinc-700 dark:text-zinc-300">
              {socialPulse.summary}
            </p>

            {socialPulse.viewpoints.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {socialPulse.viewpoints.map((vp, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-zinc-200 bg-[#f8f8f5] p-4 dark:border-white/[0.07] dark:bg-white/[0.03]"
                  >
                    <h3 className="font-mono text-xs font-bold tracking-wider text-[#d91b38] uppercase dark:text-[#ff2e4c]">
                      {vp.stance}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {vp.detail}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Bottom Navigation & Original Source Attribution */}
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-zinc-200 pt-6 sm:flex-row sm:items-center dark:border-white/[0.08]">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold tracking-wider text-zinc-900 uppercase shadow-xs transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-zinc-100 dark:shadow-none dark:hover:border-white/[0.25] dark:hover:bg-white/[0.08]"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
              <span>Back to Home</span>
            </Link>
            <BookmarkButton articleId={article.id} variant="pill" />
            <ShareButton title={article.title} />
          </div>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-[#e11d3a] px-5 py-2.5 text-xs font-bold tracking-wider text-white uppercase shadow-xs transition-colors hover:bg-[#be123c] dark:bg-[#ff2e4c] dark:shadow-none dark:hover:bg-[#e11d3a]"
          >
            <span>Read Original Report on {article.source}</span>
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17L17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </a>
        </div>

        {/* Previous / Next Story Quick Navigation */}
        {(prevStory || nextStory) && (
          <nav
            aria-label="Article sequence navigation"
            className="mt-8 grid grid-cols-1 gap-4 border-t border-zinc-200 pt-6 sm:grid-cols-2 dark:border-white/[0.08]"
          >
            {prevStory ? (
              <Link
                href={`/news/${prevStory.id}`}
                className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-white/[0.07] dark:bg-[#12141a] dark:hover:border-white/[0.18]"
              >
                <span className="font-mono text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                  ← Previous Story
                </span>
                <span className="font-display mt-1.5 line-clamp-2 text-sm font-bold text-zinc-900 group-hover:text-[#d91b38] dark:text-zinc-100 dark:group-hover:text-white">
                  {prevStory.title}
                </span>
              </Link>
            ) : (
              <div />
            )}

            {nextStory ? (
              <Link
                href={`/news/${nextStory.id}`}
                className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 text-right transition-colors hover:border-zinc-300 dark:border-white/[0.07] dark:bg-[#12141a] dark:hover:border-white/[0.18]"
              >
                <span className="font-mono text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                  Next Story →
                </span>
                <span className="font-display mt-1.5 line-clamp-2 text-sm font-bold text-zinc-900 group-hover:text-[#d91b38] dark:text-zinc-100 dark:group-hover:text-white">
                  {nextStory.title}
                </span>
              </Link>
            ) : (
              <div />
            )}
          </nav>
        )}
      </div>

      {/* Related Stories */}
      {relatedStories.length > 0 && (
        <section
          aria-label="More important stories"
          className="mt-16 border-t border-zinc-200 pt-10 dark:border-white/[0.08]"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 bg-[#e11d3a] dark:bg-[#ff2e4c]" />
              <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-900 uppercase dark:text-zinc-200">
                More on Gamer Yap
              </h2>
            </div>
            <Link
              href="/"
              className="font-mono text-xs text-zinc-600 uppercase hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            >
              View All →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {relatedStories.map((rel) => (
              <Link
                key={rel.id}
                href={`/news/${rel.id}`}
                className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-white/[0.07] dark:bg-[#12141a] dark:shadow-none dark:hover:border-white/[0.18]"
              >
                <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-lg bg-zinc-900 dark:bg-zinc-950">
                  <ArticleThumbnail
                    src={rel.image}
                    alt={rel.title}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <span className="font-mono text-[10px] font-semibold tracking-wider text-zinc-600 uppercase dark:text-zinc-500">
                  {rel.isControversy ? `${rel.controversyAngle || "Controversy"} / ` : ""}
                  {rel.category} / {rel.source}
                </span>
                <h3 className="font-display mt-1.5 text-base leading-snug font-bold text-zinc-950 group-hover:text-[#d91b38] dark:text-zinc-100 dark:group-hover:text-white">
                  {rel.title}
                </h3>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

export default function NewsDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl py-16 font-mono text-xs tracking-wider text-zinc-500 uppercase">
          Loading dispatch...
        </div>
      }
    >
      <ArticleContent params={props.params} />
    </Suspense>
  );
}
