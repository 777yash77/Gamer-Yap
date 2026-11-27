"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import ArticleThumbnail from "@/components/ArticleThumbnail";
import BookmarkButton from "@/components/BookmarkButton";
import { useBookmarks } from "@/lib/bookmarks";
import {
  ALL_GRAVITY,
  computeGravityScore,
  getLatestPublishedMs,
  pickDiverseStories,
  TRENDING_GRAVITY,
} from "@/lib/ranking";
import type { GameScale, NewsArticle, NewsCategory, SocialPulse } from "@/types/news";

type FilterTab =
  | "All"
  | "Trending"
  | "Upcoming"
  | "Controversy"
  | "Saved"
  | NewsCategory;

const MAX_TRENDING_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ALL_AGE_MS = 72 * 60 * 60 * 1000;
const MAX_ALL_COUNT = 60;

const FILTER_TABS: FilterTab[] = [
  "All",
  "Trending",
  "Upcoming",
  "Controversy",
  "Saved",
  "PC",
  "Console",
  "Industry",
  "Reviews",
];

let cachedClientNowMs = 0;

function subscribeMinuteClock(callback: () => void) {
  cachedClientNowMs = Date.now();
  const timer = setInterval(() => {
    cachedClientNowMs = Date.now();
    callback();
  }, 60_000);
  return () => clearInterval(timer);
}

function getClientNowSnapshot(): number {
  if (cachedClientNowMs === 0) {
    cachedClientNowMs = Date.now();
  }
  return cachedClientNowMs;
}

function getServerNowSnapshot(): number {
  return 0;
}

const CATEGORY_TEXT_ACCENT: Record<NewsCategory, string> = {
  PC: "text-sky-700 dark:text-sky-400",
  Console: "text-violet-700 dark:text-violet-400",
  Industry: "text-amber-700 dark:text-amber-400",
  Reviews: "text-emerald-700 dark:text-emerald-400",
};

const CATEGORY_DOT_ACCENT: Record<NewsCategory, string> = {
  PC: "bg-sky-600 dark:bg-sky-400",
  Console: "bg-violet-600 dark:bg-violet-400",
  Industry: "bg-amber-600 dark:bg-amber-400",
  Reviews: "bg-emerald-600 dark:bg-emerald-400",
};

const SCALE_STYLES: Record<GameScale, string> = {
  AAA: "bg-zinc-900 text-amber-300 dark:bg-amber-400/15 dark:text-amber-300",
  AA: "bg-zinc-200 text-zinc-800 dark:bg-white/[0.08] dark:text-zinc-300",
  Indie: "bg-zinc-100 text-zinc-600 dark:bg-white/[0.05] dark:text-zinc-400",
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

const SOURCE_PILL_ACCENT: Record<string, string> = {
  IGN: "text-[#c8102e] dark:text-[#ff2e4c]",
  "PC Gamer": "text-amber-700 dark:text-amber-300",
  Eurogamer: "text-sky-700 dark:text-sky-300",
  VGC: "text-emerald-700 dark:text-emerald-300",
  GameSpot: "text-rose-700 dark:text-rose-300",
  Gematsu: "text-indigo-700 dark:text-indigo-300",
  Kotaku: "text-orange-700 dark:text-orange-300",
  "Insider Gaming": "text-cyan-700 dark:text-cyan-300",
  PCGamesN: "text-lime-700 dark:text-lime-300",
  "Rock Paper Shotgun": "text-teal-700 dark:text-teal-300",
  "Nintendo Life": "text-red-700 dark:text-red-300",
  "Push Square": "text-blue-700 dark:text-blue-300",
  Polygon: "text-fuchsia-700 dark:text-fuchsia-300",
};

function formatUtcDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Recent";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatRelativeTime(isoString: string, nowMs: number): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Recent";
  const diffSeconds = Math.floor((nowMs - date.getTime()) / 1000);
  if (diffSeconds < 60) return "Just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatUtcDate(isoString);
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

function TimestampLabel({ publishedAt }: { publishedAt: string }) {
  const nowMs = useSyncExternalStore(
    subscribeMinuteClock,
    getClientNowSnapshot,
    getServerNowSnapshot
  );

  const label =
    nowMs > 0
      ? formatRelativeTime(publishedAt, nowMs)
      : formatUtcDate(publishedAt);

  return (
    <time
      dateTime={publishedAt}
      title={publishedAt}
      className="font-mono text-[11px] tracking-wide text-zinc-600 uppercase dark:text-zinc-500"
    >
      {label}
    </time>
  );
}

function EditionDate({ fallbackMs }: { fallbackMs: number }) {
  const nowMs = useSyncExternalStore(
    subscribeMinuteClock,
    getClientNowSnapshot,
    getServerNowSnapshot
  );

  const label = useMemo(() => {
    const target =
      nowMs > 0
        ? new Date(nowMs)
        : new Date(fallbackMs > 0 ? fallbackMs : "2026-11-27T00:00:00Z");
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      ...(nowMs > 0 ? {} : { timeZone: "UTC" }),
    }).format(target);
  }, [nowMs, fallbackMs]);

  return (
    <span className="font-mono text-[11px] tracking-widest text-zinc-600 uppercase dark:text-zinc-500">
      {label}
    </span>
  );
}

function MetaLine({ article }: { article: NewsArticle }) {
  const categoryColor =
    CATEGORY_TEXT_ACCENT[article.category] || "text-zinc-700 dark:text-zinc-300";
  const dotColor =
    CATEGORY_DOT_ACCENT[article.category] || "bg-zinc-500 dark:bg-zinc-400";
  const sourceColor =
    SOURCE_PILL_ACCENT[article.source] || "text-zinc-700 dark:text-zinc-300";

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] tracking-wider uppercase">
      {article.gameScale && (
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
            SCALE_STYLES[article.gameScale]
          }`}
        >
          {article.gameScale}
        </span>
      )}
      {article.isRumor && (
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
          Rumor
        </span>
      )}
      {article.isControversy && (
        <span className="rounded bg-[#ff2e4c]/12 px-1.5 py-0.5 text-[10px] font-bold text-[#c8102e] dark:bg-[#ff2e4c]/15 dark:text-[#ff2e4c]">
          {article.controversyAngle || "Controversy"}
        </span>
      )}
      {article.isUpcoming && !article.isRumor && (
        <span className="rounded bg-indigo-500/12 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
          {article.releaseWindow || "Upcoming"}
        </span>
      )}
      <span className={`inline-flex items-center gap-1.5 font-semibold ${categoryColor}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        {article.category}
      </span>
      <span className="text-zinc-300 dark:text-zinc-700">/</span>
      <span className={`font-semibold ${sourceColor}`}>{article.source}</span>
      <span className="text-zinc-300 dark:text-zinc-700">/</span>
      <TimestampLabel publishedAt={article.publishedAt} />
    </div>
  );
}

function CardFooterActions({
  article,
  ctaLabel = "Read Full Story",
}: {
  article: NewsArticle;
  ctaLabel?: string;
}) {
  const readMins = estimateReadMinutes(article);
  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href={`/news/${article.id}`}
        className="group/link inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-zinc-900 uppercase transition-colors hover:text-[#d91b38] dark:text-zinc-100 dark:hover:text-[#ff2e4c]"
      >
        <span>{ctaLabel}</span>
        <span className="font-mono text-[10px] font-normal text-zinc-500">
          ({readMins}m)
        </span>
        <svg
          className="h-3.5 w-3.5 text-[#e11d3a] transition-transform duration-200 group-hover/link:translate-x-1 dark:text-[#ff2e4c]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </Link>

      <div className="flex items-center gap-1.5">
        <BookmarkButton articleId={article.id} variant="icon" />
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Original article on ${article.source}`}
          className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-600 uppercase transition-colors hover:text-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-200"
        >
          <span>Source</span>
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M7 17L17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </a>
      </div>
    </div>
  );
}

function LeadStory({ article }: { article: NewsArticle }) {
  const headBadge = article.isControversy
    ? `HEADNEWS • ${article.controversyAngle || "CONTROVERSY"}`
    : article.gameScale === "AAA"
      ? "HEADNEWS • AAA TRENDING"
      : "HEADNEWS • TOP DISPATCH";

  return (
    <article className="group flex flex-col rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5 dark:border-white/[0.08] dark:bg-[#101218] dark:shadow-none">
      <Link
        href={`/news/${article.id}`}
        className="relative mb-5 block aspect-[16/9] w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-900 dark:border-white/[0.08] dark:bg-zinc-950"
      >
        <ArticleThumbnail
          src={article.image}
          alt={article.title}
          priority
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 transition-opacity group-hover:opacity-35" />
        <span className="absolute top-3.5 left-3.5 bg-[#e11d3a] px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest text-white uppercase shadow-sm dark:bg-[#ff2e4c]">
          {headBadge}
        </span>
      </Link>

      <MetaLine article={article} />

      <h2 className="font-display mt-3 text-2xl leading-[1.1] font-extrabold tracking-[-0.025em] text-zinc-950 sm:text-3xl lg:text-[2.15rem] dark:text-white">
        <Link
          href={`/news/${article.id}`}
          className="transition-colors hover:text-[#d91b38] dark:hover:text-zinc-200"
        >
          {article.title}
        </Link>
      </h2>

      <p className="mt-3.5 max-w-2xl text-[15px] leading-[1.65] text-zinc-700 dark:text-zinc-300">
        {article.summary}
      </p>

      {article.socialPulse?.summary && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-[#f8f8f6] p-3.5 dark:border-white/[0.07] dark:bg-white/[0.03]">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-bold tracking-wider text-[#d91b38] uppercase dark:text-[#ff2e4c]">
              Social Media Pulse
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                SENTIMENT_STYLES[article.socialPulse.sentiment]
              }`}
            >
              {article.socialPulse.sentiment}
            </span>
          </div>
          <p className="text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
            {article.socialPulse.summary}
          </p>
        </div>
      )}

      <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-white/[0.07]">
        <CardFooterActions article={article} />
      </div>
    </article>
  );
}

function TopRailItem({ article }: { article: NewsArticle }) {
  return (
    <article className="group py-5 first:pt-0 last:pb-0">
      <div className="flex gap-4">
        <Link
          href={`/news/${article.id}`}
          className="relative mt-0.5 h-20 w-28 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-900 sm:h-22 sm:w-32 dark:border-white/[0.08] dark:bg-zinc-950"
        >
          <ArticleThumbnail
            src={article.image}
            alt={article.title}
            sizes="140px"
            className="transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <MetaLine article={article} />
          <h3 className="font-display mt-1.5 text-[16px] leading-snug font-bold tracking-[-0.015em] text-zinc-900 dark:text-zinc-100">
            <Link
              href={`/news/${article.id}`}
              className="transition-colors group-hover:text-[#d91b38] dark:group-hover:text-white"
            >
              {article.title}
            </Link>
          </h3>
        </div>
      </div>

      <p className="mt-2.5 text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        {article.summary}
      </p>

      <div className="mt-3">
        <CardFooterActions article={article} />
      </div>
    </article>
  );
}

function SocialPulseCard({
  article,
  onSelectGame,
}: {
  article: NewsArticle;
  onSelectGame: (game: string) => void;
}) {
  const pulse = article.socialPulse;
  const sentimentStyle =
    (pulse && SENTIMENT_STYLES[pulse.sentiment]) || SENTIMENT_STYLES.Mixed;

  return (
    <article className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-white/[0.08] dark:bg-[#11131a] dark:shadow-none dark:hover:border-white/[0.18]">
      <div>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <Link
            href={`/news/${article.id}`}
            className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-lg bg-zinc-900 sm:w-44 dark:bg-zinc-950"
          >
            <ArticleThumbnail
              src={article.image}
              alt={article.title}
              sizes="(max-width: 640px) 100vw, 176px"
              className="transition-transform duration-500 group-hover:scale-105"
            />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {article.gameScale && (
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                    SCALE_STYLES[article.gameScale]
                  }`}
                >
                  {article.gameScale}
                </span>
              )}
              {pulse && (
                <span
                  className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase ${sentimentStyle}`}
                >
                  {pulse.sentiment}
                </span>
              )}
              {article.gameTitle && (
                <button
                  type="button"
                  onClick={() => onSelectGame(article.gameTitle || "")}
                  className="cursor-pointer rounded bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-700 uppercase transition-colors hover:bg-zinc-200 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.12]"
                >
                  {article.gameTitle}
                </button>
              )}
              <TimestampLabel publishedAt={article.publishedAt} />
            </div>

            <h3 className="font-display text-lg leading-snug font-bold tracking-[-0.02em] text-zinc-950 dark:text-white">
              <Link
                href={`/news/${article.id}`}
                className="transition-colors group-hover:text-[#d91b38] dark:group-hover:text-zinc-200"
              >
                {article.title}
              </Link>
            </h3>
          </div>
        </div>

        {pulse && (
          <div className="space-y-3 rounded-lg border border-zinc-200/90 bg-[#f8f8f5] p-4 dark:border-white/[0.06] dark:bg-[#0b0d12]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-bold tracking-widest text-zinc-700 uppercase dark:text-zinc-300">
                What Players Are Saying
              </span>
              <div className="flex flex-wrap gap-1.5">
                {pulse.viralPlatforms.map((platform) => (
                  <span
                    key={platform}
                    className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-700 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-zinc-400"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
              {pulse.summary}
            </p>

            {pulse.viewpoints.length > 0 && (
              <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
                {pulse.viewpoints.slice(0, 2).map((vp, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-zinc-200 bg-white p-3 dark:border-white/[0.06] dark:bg-white/[0.03]"
                  >
                    <p className="font-mono text-[10px] font-bold tracking-wider text-[#d91b38] uppercase dark:text-[#ff2e4c]">
                      {vp.stance}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {vp.detail}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-zinc-200 pt-3.5 dark:border-white/[0.07]">
        <CardFooterActions article={article} ctaLabel="Read Full Breakdown" />
      </div>
    </article>
  );
}

function UpcomingGameCard({
  article,
  onSelectGame,
}: {
  article: NewsArticle;
  onSelectGame: (game: string) => void;
}) {
  return (
    <article className="group flex flex-col justify-between rounded-xl border border-indigo-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-400/70 hover:shadow-md dark:border-indigo-500/20 dark:bg-[#11131b] dark:shadow-none dark:hover:border-indigo-400/45">
      <div>
        <Link
          href={`/news/${article.id}`}
          className="relative mb-3.5 block aspect-[16/9] w-full overflow-hidden rounded-lg bg-zinc-900 dark:bg-zinc-950"
        >
          <ArticleThumbnail
            src={article.image}
            alt={article.title}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            {article.isRumor && (
              <span className="rounded bg-amber-500 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-zinc-950 uppercase shadow-xs">
                Rumor
              </span>
            )}
            <span className="rounded bg-indigo-600 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-white uppercase shadow-xs">
              {article.releaseWindow || "Upcoming"}
            </span>
          </div>
        </Link>

        <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase">
          {article.gameScale && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                SCALE_STYLES[article.gameScale]
              }`}
            >
              {article.gameScale}
            </span>
          )}
          {article.gameTitle && (
            <button
              type="button"
              onClick={() => onSelectGame(article.gameTitle || "")}
              className="cursor-pointer font-bold text-indigo-700 hover:underline dark:text-indigo-300"
            >
              {article.gameTitle}
            </button>
          )}
          <span className="text-zinc-400 dark:text-zinc-700">/</span>
          <span className="text-zinc-600 dark:text-zinc-400">{article.source}</span>
          <span className="text-zinc-400 dark:text-zinc-700">/</span>
          <TimestampLabel publishedAt={article.publishedAt} />
        </div>

        <h3 className="font-display text-[17px] leading-[1.25] font-bold tracking-[-0.02em] text-zinc-950 dark:text-zinc-100">
          <Link
            href={`/news/${article.id}`}
            className="transition-colors group-hover:text-indigo-700 dark:group-hover:text-indigo-300"
          >
            {article.title}
          </Link>
        </h3>

        <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {article.summary}
        </p>
      </div>

      <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-white/[0.07]">
        <CardFooterActions article={article} />
      </div>
    </article>
  );
}

function EditorialCard({ article }: { article: NewsArticle }) {
  return (
    <article className="group flex flex-col justify-between rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-white/[0.07] dark:bg-[#12141a] dark:shadow-none dark:hover:border-white/[0.16] dark:hover:bg-[#151820]">
      <div>
        <Link
          href={`/news/${article.id}`}
          className="relative mb-4 block aspect-[16/9] w-full overflow-hidden rounded-lg bg-zinc-900 dark:bg-zinc-950"
        >
          <ArticleThumbnail
            src={article.image}
            alt={article.title}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          {article.socialPulse && (
            <span className="absolute top-2.5 left-2.5 rounded bg-black/80 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-zinc-100 uppercase backdrop-blur-sm">
              {article.socialPulse.sentiment}
            </span>
          )}
        </Link>

        <MetaLine article={article} />

        <h3 className="font-display mt-2.5 text-[18px] leading-[1.25] font-bold tracking-[-0.02em] text-zinc-950 dark:text-zinc-100">
          <Link
            href={`/news/${article.id}`}
            className="transition-colors group-hover:text-[#d91b38] dark:group-hover:text-white"
          >
            {article.title}
          </Link>
        </h3>

        <p className="mt-2.5 text-[14px] leading-[1.6] text-zinc-600 dark:text-zinc-400">
          {article.summary}
        </p>
      </div>

      <div className="mt-5 border-t border-zinc-200 pt-3.5 dark:border-white/[0.07]">
        <CardFooterActions article={article} />
      </div>
    </article>
  );
}

export default function NewsFeed({ articles }: { articles: NewsArticle[] }) {
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [sourceFilter, setSourceFilter] = useState<string>("All Sources");
  const [gameFilter, setGameFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { savedIds } = useBookmarks();

  const nowMs = useSyncExternalStore(
    subscribeMinuteClock,
    getClientNowSnapshot,
    getServerNowSnapshot
  );

  const latestPublishedMs = useMemo(
    () => getLatestPublishedMs(articles),
    [articles]
  );

  // Gravity-decay trending algorithm:
  // - All: stories <= 72h, ranked with gentle gravity (1.05), max 60
  // - Trending: stories <= 24h, ranked with stronger gravity (1.35)
  const { allArticles, trendingArticles, trendingSet } = useMemo(() => {
    const refNow = nowMs > 0 ? nowMs : getLatestPublishedMs(articles);

    const within72h =
      nowMs === 0
        ? articles
        : articles.filter((a) => {
            const ms = new Date(a.publishedAt).getTime();
            return !Number.isNaN(ms) && nowMs - ms <= MAX_ALL_AGE_MS;
          });

    const sortedAll = [...within72h]
      .sort(
        (a, b) =>
          computeGravityScore(b, refNow, ALL_GRAVITY) -
          computeGravityScore(a, refNow, ALL_GRAVITY)
      )
      .slice(0, MAX_ALL_COUNT);

    const within24h = sortedAll.filter((a) => {
      if (nowMs === 0) return Boolean(a.isTrending);
      const ms = new Date(a.publishedAt).getTime();
      return !Number.isNaN(ms) && nowMs - ms <= MAX_TRENDING_AGE_MS;
    });

    const sortedTrending = [...within24h].sort(
      (a, b) =>
        computeGravityScore(b, refNow, TRENDING_GRAVITY) -
        computeGravityScore(a, refNow, TRENDING_GRAVITY)
    );

    const tSet = new Set(sortedTrending.map((a) => a.id));
    return {
      allArticles: sortedAll,
      trendingArticles: sortedTrending,
      trendingSet: tSet,
    };
  }, [articles, nowMs]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (
        e.key === "Escape" &&
        document.activeElement === searchInputRef.current
      ) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const availableSources = useMemo(() => {
    const present = Array.from(new Set(allArticles.map((a) => a.source)));
    return ["All Sources", ...present];
  }, [allArticles]);

  const topGames = useMemo(() => {
    const countsByGame = new Map<string, number>();
    for (const a of allArticles) {
      if (a.gameTitle) {
        countsByGame.set(a.gameTitle, (countsByGame.get(a.gameTitle) || 0) + 1);
      }
    }
    return Array.from(countsByGame.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [allArticles]);

  const counts = useMemo(() => {
    const savedSet = new Set(savedIds);
    const map: Record<FilterTab, number> = {
      All: allArticles.length,
      Trending: trendingSet.size,
      Upcoming: 0,
      Controversy: 0,
      Saved: 0,
      PC: 0,
      Console: 0,
      Industry: 0,
      Reviews: 0,
    };
    for (const article of allArticles) {
      if (article.isUpcoming || article.isRumor) map.Upcoming += 1;
      if (article.isControversy) map.Controversy += 1;
      if (savedSet.has(article.id)) map.Saved += 1;
      if (article.category in map) map[article.category] += 1;
    }
    return map;
  }, [allArticles, trendingSet, savedIds]);

  const filteredArticles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const savedSet = new Set(savedIds);
    const sourceList = activeTab === "Trending" ? trendingArticles : allArticles;

    return sourceList.filter((article) => {
      if (activeTab === "Upcoming") {
        if (!article.isUpcoming && !article.isRumor) return false;
      } else if (activeTab === "Controversy") {
        if (!article.isControversy) return false;
      } else if (activeTab === "Saved") {
        if (!savedSet.has(article.id)) return false;
      } else if (
        activeTab !== "All" &&
        activeTab !== "Trending" &&
        article.category !== activeTab
      ) {
        return false;
      }

      if (sourceFilter !== "All Sources" && article.source !== sourceFilter) {
        return false;
      }
      if (gameFilter && article.gameTitle !== gameFilter) {
        return false;
      }
      if (!query) return true;

      const bodyText = (article.content || []).join(" ").toLowerCase();
      const socialText = (article.socialPulse?.summary || "").toLowerCase();
      return (
        article.title.toLowerCase().includes(query) ||
        article.summary.toLowerCase().includes(query) ||
        bodyText.includes(query) ||
        socialText.includes(query) ||
        (article.gameTitle || "").toLowerCase().includes(query) ||
        article.source.toLowerCase().includes(query)
      );
    });
  }, [
    allArticles,
    trendingArticles,
    savedIds,
    activeTab,
    sourceFilter,
    gameFilter,
    searchQuery,
  ]);

  const showEditorialSpread =
    activeTab === "All" &&
    sourceFilter === "All Sources" &&
    gameFilter === "" &&
    searchQuery.trim() === "" &&
    filteredArticles.length >= 6;

  const {
    leadArticle,
    railArticles,
    trendingPulseArticles,
    upcomingArticles,
    gridArticles,
  } = useMemo(() => {
    if (!showEditorialSpread) {
      return {
        leadArticle: null,
        railArticles: [],
        trendingPulseArticles: [],
        upcomingArticles: [],
        gridArticles: filteredArticles,
      };
    }

    const headPool =
      trendingArticles.length >= 4 ? trendingArticles : filteredArticles;

    const lead = headPool[0];
    const usedIds = new Set([lead.id]);

    const rail = pickDiverseStories(headPool, 3, {
      excludeIds: usedIds,
      seedSameSection: [lead],
      maxPerGame: 2,
    });
    for (const r of rail) usedIds.add(r.id);

    const pulseEligible = headPool.filter(
      (a) => a.socialPulse && a.socialPulse.viewpoints.length > 0
    );
    const pulseCandidates = pickDiverseStories(pulseEligible, 4, {
      excludeIds: usedIds,
      avoidTopicsOf: [lead, ...rail],
      maxPerGame: 2,
    });
    for (const p of pulseCandidates) usedIds.add(p.id);

    const upcomingEligible = filteredArticles.filter(
      (a) => a.isUpcoming || a.isRumor
    );
    const upcomingCandidates = pickDiverseStories(upcomingEligible, 6, {
      excludeIds: usedIds,
      avoidTopicsOf: [lead, ...rail, ...pulseCandidates],
      maxPerGame: 2,
    });
    for (const u of upcomingCandidates) usedIds.add(u.id);

    const restGrid = filteredArticles.filter((a) => !usedIds.has(a.id));

    return {
      leadArticle: lead,
      railArticles: rail,
      trendingPulseArticles: pulseCandidates,
      upcomingArticles: upcomingCandidates,
      gridArticles: restGrid,
    };
  }, [filteredArticles, trendingArticles, showEditorialSpread]);

  function handleSelectGame(gameName: string) {
    setGameFilter((prev) => (prev === gameName ? "" : gameName));
  }

  return (
    <div id="top" className="py-6">
      {/* Clean Multi-Row Masthead Controls */}
      <div className="mb-8 border-b border-zinc-200 dark:border-white/[0.08]">
        {/* Row 1: Dateline, Story Count, Jump Links & Search */}
        <div className="flex flex-col justify-between gap-4 pb-4 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <EditionDate fallbackMs={latestPublishedMs} />
            <span className="text-zinc-400 dark:text-zinc-700">•</span>
            <span className="font-mono text-[11px] tracking-wider text-zinc-600 uppercase dark:text-zinc-400">
              {counts.All} Stories
            </span>
            {showEditorialSpread && (
              <div className="hidden items-center gap-2 border-l border-zinc-300 pl-3 font-mono text-[11px] text-zinc-500 uppercase xl:flex dark:border-white/[0.1]">
                <a href="#social-pulse" className="hover:text-[#d91b38] dark:hover:text-white">
                  Social Pulse
                </a>
                <span>•</span>
                <a href="#upcoming-games" className="hover:text-indigo-600 dark:hover:text-indigo-300">
                  Upcoming &amp; Rumors
                </a>
                <span>•</span>
                <a href="#more-dispatches" className="hover:text-zinc-950 dark:hover:text-white">
                  All News
                </a>
              </div>
            )}
          </div>

          <div className="relative w-full shrink-0 md:w-72">
            <label htmlFor="news-search" className="sr-only">
              Search gaming news
            </label>
            <svg
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={searchInputRef}
              id="news-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search AAA games, rumors..."
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pr-9 pl-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#ff2e4c] focus:outline-none dark:border-white/[0.09] dark:bg-[#12141a] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-[#ff2e4c]/70"
            />
            {!searchQuery && (
              <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline-block dark:border-white/[0.1] dark:bg-zinc-900 dark:text-zinc-500">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Row 2: Full-Width Category Tabs */}
        <div
          role="tablist"
          aria-label="Filter gaming news by category"
          className="flex flex-wrap items-center gap-1 border-t border-zinc-200/80 pt-1 sm:gap-2 dark:border-white/[0.06]"
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab)}
                className={`inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border-[#e11d3a] text-zinc-950 dark:border-[#ff2e4c] dark:text-white"
                    : "border-transparent text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`font-mono text-[11px] ${
                    isActive
                      ? "text-[#e11d3a] dark:text-[#ff2e4c]"
                      : "text-zinc-400 dark:text-zinc-600"
                  }`}
                >
                  {counts[tab]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Franchise & Outlet Filter Chips */}
        <div className="flex flex-col gap-2 border-t border-zinc-200/60 py-2.5 dark:border-white/[0.04]">
          {topGames.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-[11px] tracking-wider text-zinc-500 uppercase dark:text-zinc-600">
                Games:
              </span>
              {gameFilter && (
                <button
                  type="button"
                  onClick={() => setGameFilter("")}
                  className="cursor-pointer rounded-md bg-[#e11d3a] px-2.5 py-1 font-mono text-[11px] font-semibold text-white dark:bg-[#ff2e4c]"
                >
                  {gameFilter} ×
                </button>
              )}
              {topGames
                .filter((g) => g !== gameFilter)
                .map((game) => (
                  <button
                    key={game}
                    type="button"
                    onClick={() => handleSelectGame(game)}
                    className="cursor-pointer rounded-md bg-zinc-200/75 px-2.5 py-1 font-mono text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-300/80 hover:text-zinc-950 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-200"
                  >
                    {game}
                  </button>
                ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[11px] tracking-wider text-zinc-500 uppercase dark:text-zinc-600">
              Outlet:
            </span>
            {availableSources.map((source) => {
              const isSelected = sourceFilter === source;
              return (
                <button
                  key={source}
                  type="button"
                  onClick={() => setSourceFilter(source)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                    isSelected
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                      : "bg-zinc-200/75 text-zinc-700 hover:bg-zinc-300/80 hover:text-zinc-950 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-200"
                  }`}
                >
                  {source}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {filteredArticles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white/80 px-6 py-20 text-center dark:border-white/[0.1] dark:bg-[#12141a]/60">
          <p className="font-display text-lg font-bold text-zinc-950 dark:text-white">
            {activeTab === "Saved"
              ? "No saved stories yet"
              : "No dispatches match your filter"}
          </p>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {activeTab === "Saved"
              ? "Click the bookmark icon on any story to save it to your reading list."
              : "Clear your search or switch back to all categories, games, and outlets."}
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveTab("All");
              setSourceFilter("All Sources");
              setGameFilter("");
              setSearchQuery("");
            }}
            className="mt-5 cursor-pointer rounded-md bg-[#e11d3a] px-4 py-2 text-xs font-semibold tracking-wider text-white uppercase transition hover:bg-[#be123c] dark:bg-[#ff2e4c] dark:hover:bg-[#e11d3a]"
          >
            {activeTab === "Saved" ? "Browse All Stories" : "Reset Filters"}
          </button>
        </div>
      ) : (
        <>
          {showEditorialSpread && leadArticle && (
            <section
              aria-label="Headnews and top trending stories"
              className="grid grid-cols-1 gap-8 border-b border-zinc-200 pb-10 lg:grid-cols-12 lg:gap-10 dark:border-white/[0.08]"
            >
              <div className="lg:col-span-7">
                <LeadStory article={leadArticle} />
              </div>

              <aside
                aria-label="Top trending stories"
                className="flex flex-col rounded-xl border border-zinc-200/90 bg-white p-5 shadow-sm lg:col-span-5 dark:border-white/[0.08] dark:bg-[#101218] dark:shadow-none"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 bg-[#e11d3a] dark:bg-[#ff2e4c]" />
                    <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-900 uppercase dark:text-zinc-200">
                      Top Trending
                    </h2>
                  </div>
                  <span className="font-mono text-[11px] text-zinc-500 uppercase">
                    Featured
                  </span>
                </div>

                <div className="divide-y divide-zinc-200 dark:divide-white/[0.08]">
                  {railArticles.map((article) => (
                    <TopRailItem key={article.id} article={article} />
                  ))}
                </div>
              </aside>
            </section>
          )}

          {/* Dedicated Trending Games & Social Media Opinions Section */}
          {showEditorialSpread && trendingPulseArticles.length > 0 && (
            <section
              id="social-pulse"
              aria-label="Trending news and social media opinions"
              className="scroll-mt-24 border-b border-zinc-200 py-10 dark:border-white/[0.08]"
            >
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 bg-[#e11d3a] dark:bg-[#ff2e4c]" />
                    <h2 className="font-mono text-xs font-bold tracking-widest text-[#d91b38] uppercase dark:text-[#ff2e4c]">
                      Trending &amp; Social Media Pulse
                    </h2>
                  </div>
                  <p className="font-display text-xl font-extrabold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">
                    What Gamers Are Saying Across Social Media
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab("Trending")}
                  className="cursor-pointer font-mono text-xs font-semibold text-zinc-600 uppercase transition-colors hover:text-[#d91b38] dark:text-zinc-400 dark:hover:text-white"
                >
                  View All Trending ({counts.Trending}) →
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {trendingPulseArticles.map((article) => (
                  <SocialPulseCard
                    key={article.id}
                    article={article}
                    onSelectGame={handleSelectGame}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Dedicated Upcoming Games & Rumors Section (AAA -> AA -> Indie ordered) */}
          {showEditorialSpread && upcomingArticles.length > 0 && (
            <section
              id="upcoming-games"
              aria-label="Upcoming game news and rumors"
              className="scroll-mt-24 border-b border-zinc-200 py-10 dark:border-white/[0.08]"
            >
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 bg-indigo-600 dark:bg-indigo-400" />
                    <h2 className="font-mono text-xs font-bold tracking-widest text-indigo-700 uppercase dark:text-indigo-300">
                      Upcoming Games &amp; Rumors Radar
                    </h2>
                  </div>
                  <p className="font-display text-xl font-extrabold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">
                    AAA Reveals, Trailers, Leaks &amp; Upcoming Releases
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab("Upcoming")}
                  className="cursor-pointer font-mono text-xs font-semibold text-zinc-600 uppercase transition-colors hover:text-indigo-700 dark:text-zinc-400 dark:hover:text-indigo-300"
                >
                  View All Upcoming &amp; Rumors ({counts.Upcoming}) →
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {upcomingArticles.map((article) => (
                  <UpcomingGameCard
                    key={article.id}
                    article={article}
                    onSelectGame={handleSelectGame}
                  />
                ))}
              </div>
            </section>
          )}

          {/* All Remaining Dispatches or Filtered Tab View */}
          {gridArticles.length > 0 && (
            <section
              id="more-dispatches"
              aria-label="All dispatches"
              className={showEditorialSpread ? "scroll-mt-24 pt-10" : ""}
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 bg-zinc-400" />
                  <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-700 uppercase dark:text-zinc-300">
                    {showEditorialSpread
                      ? "More Gaming Dispatches"
                      : activeTab === "Trending"
                        ? "Trending News"
                        : activeTab === "Upcoming"
                          ? "Upcoming Games & Rumors"
                          : activeTab === "Saved"
                            ? "Saved Reading List"
                            : `${activeTab === "All" ? "All" : activeTab} Dispatches`}
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[11px] text-zinc-500 uppercase">
                    {filteredArticles.length}{" "}
                    {filteredArticles.length === 1 ? "Story" : "Stories"}
                  </span>
                  {showEditorialSpread && (
                    <a
                      href="#top"
                      className="font-mono text-[11px] font-semibold text-zinc-600 uppercase hover:text-[#d91b38] dark:text-zinc-400 dark:hover:text-white"
                    >
                      ↑ Top
                    </a>
                  )}
                </div>
              </div>

              {activeTab === "Trending" ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {gridArticles.map((article) => (
                    <SocialPulseCard
                      key={article.id}
                      article={article}
                      onSelectGame={handleSelectGame}
                    />
                  ))}
                </div>
              ) : activeTab === "Upcoming" ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {gridArticles.map((article) => (
                    <UpcomingGameCard
                      key={article.id}
                      article={article}
                      onSelectGame={handleSelectGame}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {gridArticles.map((article) => (
                    <EditorialCard key={article.id} article={article} />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
