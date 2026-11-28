import type { NewsArticle } from "@/types/news";

export const ALL_GRAVITY = 1.05;
export const TRENDING_GRAVITY = 1.35;

const TOPIC_STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "over", "after",
  "about", "more", "than", "new", "out", "now", "all", "its", "are", "was",
  "has", "have", "will", "how", "why", "what", "when", "game", "games",
  "gaming", "players", "report", "says", "amid", "following", "fans", "could",
  "would", "should", "adds", "uses", "using", "makes", "making", "lands",
  "drops", "faces", "keeps", "joins", "confirms", "expects", "latest",
]);

/**
 * Gravity time-decay ranking algorithm (Hacker News / Reddit Hot style).
 * Balances editorial importance, AAA blockbuster scale, fanbase size,
 * controversy/social heat, and rumor momentum against age decay.
 */
export function computeGravityScore(
  article: NewsArticle,
  referenceNowMs: number,
  gravity = ALL_GRAVITY
): number {
  const scaleBase =
    article.gameScale === "AAA" ? 48 : article.gameScale === "AA" ? 20 : 0;
  const fanbaseWeight = (article.fanbaseScore ?? 5) * 4.5;
  const importance = article.importance ?? 6;
  const importanceWeight = importance * 7.5;
  const controversyBoost = article.isControversy ? 20 : 0;
  const sentiment = article.socialPulse?.sentiment;
  const sentimentHeatBoost =
    sentiment === "Backlash" || sentiment === "Heated"
      ? 8
      : sentiment === "Divided" || sentiment === "Hyped"
        ? 4
        : 0;
  const rumorBoost = article.isRumor ? 10 : 0;
  const socialBoost =
    (article.socialPulse?.viewpoints?.length ?? 0) > 0 ? 6 : 0;

  let signalScore =
    scaleBase +
    fanbaseWeight +
    importanceWeight +
    controversyBoost +
    sentimentHeatBoost +
    rumorBoost +
    socialBoost;

  // Dampen low-importance filler/sale posts so major gaming news stays ahead
  if (importance <= 5 && !article.isControversy && !article.isUpcoming) {
    signalScore *= 0.78;
  }

  const publishedMs = new Date(article.publishedAt).getTime();
  const ageHours = Number.isNaN(publishedMs)
    ? 24
    : Math.max(0, (referenceNowMs - publishedMs) / (1000 * 60 * 60));

  return signalScore / Math.pow(ageHours + 2.5, gravity);
}

/**
 * Deterministic fallback timestamp for SSR so server & initial hydration match cleanly.
 */
export function getLatestPublishedMs(articles: NewsArticle[]): number {
  let latest = 0;
  for (const a of articles) {
    const ms = new Date(a.publishedAt).getTime();
    if (!Number.isNaN(ms) && ms > latest) {
      latest = ms;
    }
  }
  return latest;
}

function getTopicTokens(article: NewsArticle): Set<string> {
  const gameWords = new Set(
    (article.gameTitle || "")
      .toLowerCase()
      .replace(/[^a-z0-9.\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => (w.length > 5 ? w.slice(0, 5) : w))
  );

  const combined = article.title
    .toLowerCase()
    .replace(/\bgen(?:erative)?[-\s]?ai\b/g, "genai")
    .replace(/[^a-z0-9.\s]/g, " ");

  const tokens = new Set<string>();
  for (const raw of combined.split(/\s+/)) {
    const word = raw.replace(/^\.+|\.+$/g, "");
    if (!word || TOPIC_STOP_WORDS.has(word)) continue;
    if (
      word.length >= 3 ||
      /^(?:ai|fc|gt|pc|vr|uk|us|\d+(?:\.\d+)?)$/.test(word)
    ) {
      const stem = word.length > 5 ? word.slice(0, 5) : word;
      if (!gameWords.has(stem)) {
        tokens.add(stem);
      }
    }
  }
  return tokens;
}

export function areSameTopicArticles(a: NewsArticle, b: NewsArticle): boolean {
  const tokensA = getTopicTokens(a);
  const tokensB = getTopicTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) return false;

  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared++;
  }

  const sameGame =
    Boolean(a.gameTitle && b.gameTitle) &&
    a.gameTitle!.trim().toLowerCase() === b.gameTitle!.trim().toLowerCase();

  if (sameGame && shared >= 2) return true;
  if (shared >= 3) return true;
  const minSize = Math.min(tokensA.size, tokensB.size);
  return shared >= 2 && shared / minSize >= 0.45;
}

/**
 * Selects up to `limit` diverse stories from a gravity-sorted pool,
 * avoiding duplicate event coverage across sections and capping repeats per game inside each section.
 */
export function pickDiverseStories(
  candidates: NewsArticle[],
  limit: number,
  options: {
    excludeIds?: Set<string>;
    avoidTopicsOf?: NewsArticle[];
    seedSameSection?: NewsArticle[];
    maxPerGame?: number;
  } = {}
): NewsArticle[] {
  const {
    excludeIds,
    avoidTopicsOf = [],
    seedSameSection = [],
    maxPerGame = 2,
  } = options;
  const chosen: NewsArticle[] = [];
  const topicBaseline: NewsArticle[] = [...avoidTopicsOf, ...seedSameSection];
  const gameCounts = new Map<string, number>();

  for (const existing of seedSameSection) {
    if (existing.gameTitle) {
      const key = existing.gameTitle.trim().toLowerCase();
      gameCounts.set(key, (gameCounts.get(key) || 0) + 1);
    }
  }

  for (const candidate of candidates) {
    if (chosen.length >= limit) break;
    if (excludeIds?.has(candidate.id)) continue;

    const gameKey = candidate.gameTitle?.trim().toLowerCase() || "";
    if (gameKey && (gameCounts.get(gameKey) || 0) >= maxPerGame) {
      continue;
    }

    if (topicBaseline.some((prev) => areSameTopicArticles(prev, candidate))) {
      continue;
    }

    chosen.push(candidate);
    topicBaseline.push(candidate);
    if (gameKey) {
      gameCounts.set(gameKey, (gameCounts.get(gameKey) || 0) + 1);
    }
  }

  // Fallback fill if strict game cap left slots unfilled (still avoids duplicate events)
  if (chosen.length < limit) {
    for (const candidate of candidates) {
      if (chosen.length >= limit) break;
      if (excludeIds?.has(candidate.id)) continue;
      if (chosen.some((c) => c.id === candidate.id)) continue;
      if (topicBaseline.some((prev) => areSameTopicArticles(prev, candidate))) {
        continue;
      }
      chosen.push(candidate);
      topicBaseline.push(candidate);
    }
  }

  return chosen;
}
