/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Parser = require("rss-parser");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

const DATA_FILE = path.join(__dirname, "..", "data", "news.json");
const MAX_TRENDING_AGE_MS = 24 * 60 * 60 * 1000; // Trending window: 24 hours
const MAX_ALL_AGE_MS = 72 * 60 * 60 * 1000; // All-news retention window: 72 hours
const MIN_TARGET_ARTICLES = 30; // Bootstrap rapidly when below 30 baseline stories
const MAX_STORED_ARTICLES = 60; // Maximum active stories before lowest-ranked eviction
const BOOTSTRAP_NEW_PER_RUN = 10; // Fill quickly when < 30 stories exist
const STEADY_NEW_PER_RUN = 2; // Steady addition every 30-minute run once >= 30
const MAX_STEADY_NEW_PER_RUN = 5; // Allow extra replacements when 72h purge opens slots
const CANDIDATE_POOL_SIZE = 16;
const API_DELAY_MS = 4500; // 4.5s between Gemini calls (~13 RPM, safe under 15 RPM free limit)
const VALID_CATEGORIES = ["PC", "Console", "Industry", "Reviews"];
const VALID_SENTIMENTS = ["Backlash", "Divided", "Hyped", "Heated", "Mixed"];
const VALID_SCALES = ["AAA", "AA", "Indie"];

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const FEEDS = [
  { source: "IGN", url: "https://feeds.ign.com/ign/games-all" },
  { source: "PC Gamer", url: "https://www.pcgamer.com/rss/" },
  { source: "Eurogamer", url: "https://www.eurogamer.net/feed" },
  { source: "GameSpot", url: "https://www.gamespot.com/feeds/news/" },
  { source: "VGC", url: "https://www.videogameschronicle.com/feed/" },
  { source: "Kotaku", url: "https://kotaku.com/rss" },
  { source: "Insider Gaming", url: "https://insider-gaming.com/feed/" },
  { source: "PCGamesN", url: "https://www.pcgamesn.com/mainrss.xml" },
  { source: "Rock Paper Shotgun", url: "https://www.rockpapershotgun.com/feed/news" },
  { source: "Nintendo Life", url: "https://www.nintendolife.com/feeds/latest" },
  { source: "Push Square", url: "https://www.pushsquare.com/feeds/latest" },
  { source: "Polygon", url: "https://www.polygon.com/rss/index.xml" },
  { source: "Gematsu", url: "https://www.gematsu.com/feed" },
];

const NOISE_PATTERNS = [
  /\b(wordle|connections|strands|quordle|nyt mini|crossword|sudoku|hints today)\b/i,
  /\b(walmart|best buy|amazon|target|newegg|prime day|black friday|cyber monday)\b/i,
  /\b(promo code|coupon|discount code|lowest price|price drop|on sale|slashes .* to \$|save \$|deals?\b|buying guide|gift guide|gift ideas?|best gifts?|stocking stuffers?|wish\s?list this)\b/i,
  /\b(budget .*(?:gamepad|controller|headset|keyboard|mouse|monitor|laptop)|top-rated .* under \$\d+|best .* under \$\d+|upgrade your pc setup)\b/i,
  /\b(eshop .* lineup|thanksgiving lineup|weekly sales roundup|free dice links?|codes \(|tier list|all .* locations|how to get them|all .* scenes|easiest .* location|fastest .* in )\b/i,
  /\b(windows telnet|horoscope|streaming deal|watch .* online|denny's|stephen king|box office|tv series|movie|picross)\b/i,
];

// Tier 1: Flagship AAA franchises, platforms & mega-fanbase titles
const AAA_FRANCHISE_PATTERNS = [
  /\b(grand theft auto|gta\s?6|gta\s?vi|rockstar|red dead|witcher|cyberpunk|cd projekt)\b/i,
  /\b(elden ring|fromsoftware|dark souls|bloodborne|sekiro|hollow knight|silksong)\b/i,
  /\b(playstation|ps5|ps6|sony|god of war|last of us|spider-man|wolverine|ghost of yotei|intergalactic)\b/i,
  /\b(nintendo|switch 2|zelda|mario|pok[eé]mon|metroid|xenoblade|smash bros)\b/i,
  /\b(xbox|halo|forza|fable|gears of war|elder scrolls|fallout|starfield|doom|bethesda)\b/i,
  /\b(call of duty|modern warfare|black ops|battlefield|counter-strike|valorant|fortnite|minecraft|roblox)\b/i,
  /\b(resident evil|monster hunter|capcom|final fantasy|kingdom hearts|square enix|metal gear|silent hill)\b/i,
  /\b(world of warcraft|diablo|overwatch|blizzard|league of legends|riot|baldur'?s gate|half-life|valve|steam)\b/i,
  /\b(assassin'?s creed|ubisoft|far cry|ea sports|skate\.|apex legends|marvel rivals|destiny|nvidia|rtx)\b/i,
  /\b(warhammer|space marine|dawn of war|phantom blade zero|crimson desert|borderlands|death stranding)\b/i,
];

// Rumors, leaks & upcoming reveals
const RUMOR_AND_UPCOMING_SIGNALS = [
  { pattern: /\b(rumou?r(?:ed|s)?|leak(?:ed|s)?|insider|reportedly|datamine[ds]?|unconfirmed|speculat(?:e|ion))\b/i, weight: 22 },
  { pattern: /\b(upcoming|release date|launch(?:es|ed|ing)?|delay(?:ed)?|postpone[sd]?|coming to|early access)\b/i, weight: 16 },
  { pattern: /\b(announce[sd]?|reveal(?:ed|s)?|unveil(?:ed|s)?|trailer|gameplay|showcase|state of play|nintendo direct|beta|demo)\b/i, weight: 15 },
  { pattern: /\b(expansion|dlc|season|overhaul|remake|remaster|sequel|patch|update)\b/i, weight: 12 },
];

const CONTROVERSY_SIGNALS = [
  /\b(backlash|controvers(?:y|ial)|outrage|slams?|slammed|fury|furious|boycott|review bomb(?:ing|ed)?)\b/i,
  /\b(frustration|angry|fuming|upset|unhappy|admits|apolog(?:y|ize|ies)|deletes? (?:post|tweet)|retract(?:s|ed)?)\b/i,
  /\b(bans?|banned|union|layoff|fired|strike|lawsuit|sued|dmca|takedown|piracy|tariff)\b/i,
  /\b(generative ai|ai slop|ai psychosis|microtransaction|pay-to-win|nerf(?:s|ed)?|cancel(?:ed|led)?|broken|bug)\b/i,
];

const BAD_IMAGE_PATTERNS = [
  /(?:avatar|logo|author|profile|favicon|sprite|placeholder|default|badge|1x1|blank|pixel|flag_of_)/i,
  /\/(?:authors?|themes?|icons?)\//i,
  /\.svg(?:\?|$)/i,
];

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "over", "after",
  "about", "more", "than", "new", "out", "now", "all", "its", "are", "was", "has",
  "have", "will", "how", "why", "what", "when", "game", "games", "gaming", "players",
  "report", "says", "amid", "following", "fans", "could", "would", "should",
]);

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": REQUEST_HEADERS["User-Agent"],
    Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
      ["dc:content", "dcContent"],
    ],
  },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getArticleAgeMs(isoDate, referenceNowMs = Date.now()) {
  const ms = new Date(isoDate).getTime();
  if (Number.isNaN(ms)) return Infinity;
  return Math.max(0, referenceNowMs - ms);
}

function isWithinHours(isoDate, maxAgeMs, referenceNowMs = Date.now()) {
  return getArticleAgeMs(isoDate, referenceNowMs) <= maxAgeMs;
}

function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    const parsed = new URL(rawUrl.trim());
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "ref",
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return parsed.toString();
  } catch {
    return rawUrl.trim();
  }
}

function createId(url) {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&#8217;|&#8216;/gi, "'")
    .replace(/&#8220;|&#8221;/gi, '"')
    .replace(/&#8211;|&#8212;|&mdash;|&ndash;/gi, "-")
    .replace(/&hellip;/gi, "...")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

function stripHtml(html) {
  if (!html || typeof html !== "string") return "";
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function isUsableImageCandidate(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (BAD_IMAGE_PATTERNS.some((re) => re.test(trimmed))) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isLowResThumbnail(url) {
  if (!url) return true;
  return /[?&](w|width)=([1-3]\d\d)\b/i.test(url);
}

function upgradeImageResolution(url) {
  if (!url) return url;
  if (/gamespot\.com\/wp-content\/uploads\//i.test(url)) {
    return url.replace(/([?&]w=)\d+/i, "$11200");
  }
  return url;
}

function extractRssImage(item) {
  if (
    item.enclosure?.url &&
    (!item.enclosure.type || item.enclosure.type.startsWith("image/")) &&
    isUsableImageCandidate(item.enclosure.url)
  ) {
    return upgradeImageResolution(item.enclosure.url.trim());
  }

  const mediaList = Array.isArray(item.mediaContent)
    ? item.mediaContent
    : item.mediaContent
      ? [item.mediaContent]
      : [];

  for (const media of mediaList) {
    const attrs = media?.$ || media;
    const candidate = attrs?.url;
    const isImage =
      !attrs?.medium && !attrs?.type
        ? true
        : attrs?.medium === "image" || String(attrs?.type || "").startsWith("image/");
    if (isImage && isUsableImageCandidate(candidate)) {
      return upgradeImageResolution(candidate.trim());
    }
  }

  const thumb = item.mediaThumbnail;
  const thumbCandidate =
    typeof thumb === "string"
      ? thumb
      : thumb?.$?.url || thumb?._ || thumb?.url || null;
  if (isUsableImageCandidate(thumbCandidate)) {
    return upgradeImageResolution(thumbCandidate.trim());
  }

  return "";
}

function extractRssBodyText(item) {
  const candidates = [
    stripHtml(item.contentEncoded),
    stripHtml(item.dcContent),
    stripHtml(item.content),
    stripHtml(item.description),
    item.contentSnippet || "",
  ];

  let best = "";
  for (const text of candidates) {
    if (text && text.length > best.length) {
      best = text;
    }
  }
  return best.slice(0, 6000);
}

function extractMetaImageFromHtml(html, baseUrl) {
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i,
  ];
  for (const regex of patterns) {
    const match = html.match(regex);
    if (match?.[1]) {
      const candidate = decodeEntities(match[1].trim());
      if (isUsableImageCandidate(candidate)) {
        return upgradeImageResolution(candidate);
      }
    }
  }

  const articleMatch = html.match(/<article\b[\s\S]*?<\/article>/i);
  if (articleMatch) {
    const imgMatches = articleMatch[0].matchAll(
      /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["']/gi
    );
    for (const m of imgMatches) {
      let url = decodeEntities(m[1].trim());
      if (url.startsWith("/") && baseUrl) {
        try {
          url = new URL(url, baseUrl).toString();
        } catch {
          continue;
        }
      }
      if (isUsableImageCandidate(url)) {
        return upgradeImageResolution(url);
      }
    }
  }
  return "";
}

function extractArticleParagraphsFromHtml(html) {
  const articleMatch =
    html.match(/<article\b[\s\S]*?<\/article>/i) ||
    html.match(/<main\b[\s\S]*?<\/main>/i);
  const scope = (articleMatch ? articleMatch[0] : html)
    .replace(/<(script|style|noscript|nav|aside|footer|header|form)[\s\S]*?<\/\1>/gi, " ");

  const paragraphs = [];
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = pRegex.exec(scope)) !== null) {
    const text = stripHtml(match[1]);
    if (
      text.length >= 50 &&
      !/^(read more|subscribe|sign up|follow us|copyright|all rights reserved|image credit)/i.test(
        text
      )
    ) {
      paragraphs.push(text);
    }
  }
  return paragraphs.join("\n\n").slice(0, 6000);
}

async function fetchResponseWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function verifyImageUrl(url) {
  if (!isUsableImageCandidate(url)) return false;
  try {
    let res = await fetchResponseWithTimeout(
      url,
      {
        method: "HEAD",
        headers: { "User-Agent": REQUEST_HEADERS["User-Agent"] },
      },
      6000
    );
    if (res.status === 405) {
      await res.body?.cancel().catch(() => {});
      res = await fetchResponseWithTimeout(
        url,
        {
          method: "GET",
          headers: { "User-Agent": REQUEST_HEADERS["User-Agent"], Range: "bytes=0-1024" },
        },
        6000
      );
    }
    const ok = res.ok;
    const contentType = res.headers.get("content-type") || "";
    const contentLength = Number(res.headers.get("content-length") || "0");
    await res.body?.cancel().catch(() => {});
    if (!ok) return false;
    if (contentType && !contentType.startsWith("image/")) return false;
    if (contentLength > 0 && contentLength < 4000) return false;
    return true;
  } catch {
    return false;
  }
}

async function findSteamGameImage(query) {
  if (!query || query.length < 3) return "";
  try {
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
      query
    )}&l=english&cc=US`;
    const searchJson = await fetchJsonWithTimeout(
      searchUrl,
      { headers: { "User-Agent": REQUEST_HEADERS["User-Agent"] } },
      6000
    );
    const items = searchJson?.items || [];
    if (items.length === 0) return "";

    const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]/g, "");
    const bestMatch =
      items.find((it) => {
        const nameNorm = String(it.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return nameNorm.includes(normalizedQuery) || normalizedQuery.includes(nameNorm);
      }) || items[0];

    if (!bestMatch?.id) return "";

    const detailsJson = await fetchJsonWithTimeout(
      `https://store.steampowered.com/api/appdetails?appids=${bestMatch.id}`,
      { headers: { "User-Agent": REQUEST_HEADERS["User-Agent"] } },
      6000
    );
    const appData = detailsJson?.[String(bestMatch.id)]?.data;
    if (!appData) return "";

    const candidates = [
      appData.screenshots?.[0]?.path_full,
      appData.header_image,
    ].filter(Boolean);

    for (const img of candidates) {
      if (await verifyImageUrl(img)) {
        return img;
      }
    }
    return "";
  } catch {
    return "";
  }
}

async function findWikipediaImage(query) {
  if (!query || query.length < 3) return "";
  try {
    const searchJson = await fetchJsonWithTimeout(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query
      )}&srlimit=3&format=json`,
      { headers: { "User-Agent": "GamerYapBot/1.0 (https://github.com)" } },
      5000
    );
    const title = searchJson?.query?.search?.[0]?.title;
    if (!title) return "";

    const summary = await fetchJsonWithTimeout(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { "User-Agent": "GamerYapBot/1.0 (https://github.com)" } },
      5000
    );
    const candidates = [
      summary?.originalimage?.source,
      summary?.thumbnail?.source,
    ].filter(Boolean);

    for (const img of candidates) {
      if (isUsableImageCandidate(img) && (await verifyImageUrl(img))) {
        return img;
      }
    }
    return "";
  } catch {
    return "";
  }
}

function isImageRelevantToGame(imageUrl, gameTitle) {
  if (!imageUrl || !gameTitle) return true;
  const imgLower = imageUrl.toLowerCase();
  const gameTokens = gameTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  if (gameTokens.length === 0) return true;
  if (gameTokens.some((tok) => imgLower.includes(tok))) return true;
  const commonOtherGameSlugs = [
    "silksong", "witcher", "fortnite", "minecraft", "valorant", "elden", "gta",
  ];
  for (const slug of commonOtherGameSlugs) {
    if (imgLower.includes(slug) && !gameTitle.toLowerCase().includes(slug)) {
      return false;
    }
  }
  return true;
}

async function resolveStrictRelevantImage(candidate, gameTitle, imageSearchQuery) {
  const currentOk =
    candidate.image &&
    isImageRelevantToGame(candidate.image, gameTitle) &&
    (await verifyImageUrl(candidate.image));

  if (currentOk) {
    return candidate.image;
  }

  for (const query of [gameTitle, imageSearchQuery]) {
    if (!query) continue;
    const steamImage = await findSteamGameImage(query);
    if (steamImage) {
      return steamImage;
    }
  }

  for (const query of [gameTitle, imageSearchQuery]) {
    if (!query) continue;
    const wikiImage = await findWikipediaImage(query);
    if (wikiImage) {
      return wikiImage;
    }
  }

  if (candidate.image && (await verifyImageUrl(candidate.image))) {
    return candidate.image;
  }

  return "";
}

async function enrichArticleFromWeb(candidate) {
  try {
    const html = await fetchTextWithTimeout(
      candidate.url,
      { headers: REQUEST_HEADERS },
      9000
    );
    if (!html) return candidate;

    const metaImage = extractMetaImageFromHtml(html, candidate.url);
    if (metaImage && (!candidate.image || isLowResThumbnail(candidate.image))) {
      candidate.image = metaImage;
    }

    const webText = extractArticleParagraphsFromHtml(html);
    if (webText.length > candidate.rawText.length) {
      candidate.rawText = webText;
    }
  } catch {
    // Gracefully keep RSS content if remote fetch fails or times out
  }
  return candidate;
}

function parsePublishedDate(item) {
  const raw = item.isoDate || item.pubDate;
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function isNoiseItem(title, categories = []) {
  const text = `${title} ${categories.join(" ")}`;
  return NOISE_PATTERNS.some((regex) => regex.test(text));
}

function extractTopicTokens(text) {
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/\bgen(?:erative)?[-\s]?ai\b/g, "genai")
    .replace(/[^a-z0-9.\s/-]/g, " ");

  const tokens = new Set();
  for (const raw of normalized.split(/[\s/-]+/)) {
    const w = raw.replace(/^\.+|\.+$/g, "");
    if (!w || STOP_WORDS.has(w)) continue;
    if (w.length >= 3 || /^(?:ai|fc|gt|pc|vr|uk|us|\d+(?:\.\d+)?)$/.test(w)) {
      tokens.add(w.length > 5 ? w.slice(0, 5) : w);
    }
  }
  return tokens;
}

async function fetchTrendingSteamGames() {
  try {
    const data = await fetchJsonWithTimeout(
      "https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/",
      { headers: { "User-Agent": REQUEST_HEADERS["User-Agent"] } },
      5000
    );
    const topAppIds = (data?.response?.ranks || [])
      .slice(0, 8)
      .map((r) => r.appid)
      .filter(Boolean);

    const settled = await Promise.allSettled(
      topAppIds.map((appid) =>
        fetchJsonWithTimeout(
          `https://store.steampowered.com/api/appdetails?appids=${appid}`,
          { headers: { "User-Agent": REQUEST_HEADERS["User-Agent"] } },
          4000
        ).then((d) => d?.[String(appid)]?.data?.name?.toLowerCase() || null)
      )
    );

    return settled
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => r.value);
  } catch {
    return [];
  }
}

async function fetchLemmyCommunityPulse() {
  try {
    const communities = ["gaming", "games"];
    const postsLists = await Promise.allSettled(
      communities.map((comm) =>
        fetchJsonWithTimeout(
          `https://lemmy.world/api/v3/post/list?community_name=${comm}&sort=Hot&limit=12`,
          { headers: { "User-Agent": "GamerYapBot/1.0" } },
          5000
        )
      )
    );

    const hotPosts = [];
    for (const res of postsLists) {
      if (res.status === "fulfilled" && Array.isArray(res.value?.posts)) {
        for (const p of res.value.posts) {
          if ((p?.counts?.comments || 0) >= 2 && p?.post?.name) {
            hotPosts.push({
              id: p.post.id,
              title: p.post.name,
              score: p.counts.score || 0,
              commentsCount: p.counts.comments || 0,
              tokens: extractTopicTokens(p.post.name),
            });
          }
        }
      }
    }

    const topDiscussed = hotPosts
      .sort((a, b) => b.commentsCount - a.commentsCount)
      .slice(0, 8);

    await Promise.allSettled(
      topDiscussed.map(async (post) => {
        const cJson = await fetchJsonWithTimeout(
          `https://lemmy.world/api/v3/comment/list?post_id=${post.id}&sort=Top&limit=5`,
          { headers: { "User-Agent": "GamerYapBot/1.0" } },
          4000
        );
        post.comments = (cJson?.comments || [])
          .map((c) => stripHtml(c?.comment?.content || ""))
          .filter((t) => t.length >= 25 && t.length <= 500)
          .slice(0, 4);
      })
    );

    return topDiscussed;
  } catch {
    return [];
  }
}

function attachCommunityDiscussions(candidate, communityThreads) {
  if (!communityThreads || communityThreads.length === 0) return "";
  const candTokens = extractTopicTokens(candidate.rawTitle);
  for (const thread of communityThreads) {
    let shared = 0;
    for (const tok of candTokens) {
      if (thread.tokens.has(tok)) shared++;
    }
    if (shared >= 2 && thread.comments?.length > 0) {
      return [
        `Live Community Thread: "${thread.title}" (${thread.commentsCount} comments, score ${thread.score})`,
        ...thread.comments.map((c, idx) => `- Community reply ${idx + 1}: ${c}`),
      ].join("\n");
    }
  }
  return "";
}

function scoreCandidatesImportance(
  candidates,
  trendingGames = [],
  communityThreads = [],
  nowMs = Date.now()
) {
  const tokenLists = candidates.map((c) => ({
    source: c.source,
    tokens: extractTopicTokens(c.rawTitle),
  }));

  return candidates.map((candidate, idx) => {
    let score = 0;
    const combinedText = `${candidate.rawTitle} ${candidate.rawText.slice(0, 700)}`;

    // 1. Massive AAA / large-fanbase franchise boost (heavily favors AAA & beloved favorites over small indie)
    let aaaHits = 0;
    for (const pattern of AAA_FRANCHISE_PATTERNS) {
      if (pattern.test(combinedText)) aaaHits++;
    }
    score += Math.min(2, aaaHits) * 45;

    // 2. Cross-outlet corroboration
    const myTokens = tokenLists[idx].tokens;
    const corroboratingSources = new Set();
    for (let j = 0; j < tokenLists.length; j++) {
      if (j === idx || tokenLists[j].source === candidate.source) continue;
      let shared = 0;
      for (const t of myTokens) {
        if (tokenLists[j].tokens.has(t)) shared++;
      }
      if (shared >= 2) {
        corroboratingSources.add(tokenLists[j].source);
      }
    }
    score += corroboratingSources.size * 24;

    // 3. Upcoming games & rumors boost
    for (const sig of RUMOR_AND_UPCOMING_SIGNALS) {
      if (sig.pattern.test(combinedText)) {
        score += sig.weight;
      }
    }

    // 4. Controversy & fan backlash boost
    let controversyHits = 0;
    for (const sig of CONTROVERSY_SIGNALS) {
      if (sig.test(combinedText)) controversyHits++;
    }
    score += controversyHits * 18;

    // 5. Steam live most-played trending game boost
    const lowerCombined = combinedText.toLowerCase();
    if (trendingGames.some((g) => g.length >= 4 && lowerCombined.includes(g))) {
      score += 20;
    }

    // 6. Active community discussion boost
    const communityNotes = attachCommunityDiscussions(candidate, communityThreads);
    if (communityNotes) {
      score += 22;
    }

    // 7. Prefer <=24h stories for Trending while keeping strong 24h-72h AAA stories eligible for All
    const ageHours = getArticleAgeMs(candidate.publishedAt, nowMs) / (1000 * 60 * 60);
    if (ageHours <= 24) {
      score += Math.max(12, 34 - ageHours * 0.9);
    } else {
      score += Math.max(0, 10 - (ageHours - 24) * 0.2);
    }

    return {
      ...candidate,
      communityNotes,
      preScore: score,
    };
  });
}

function isSimilarTopic(tokensA, tokensB) {
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared++;
  }
  if (shared >= 3) return true;
  const minSize = Math.min(tokensA.size, tokensB.size);
  return shared >= 2 && shared / minSize >= 0.4;
}

function getCandidateTopicTokens(candidate) {
  let urlSlug = "";
  try {
    urlSlug = new URL(candidate.url).pathname;
  } catch {
    urlSlug = "";
  }
  return extractTopicTokens(`${candidate.rawTitle} ${urlSlug}`);
}

function selectBalancedTopCandidates(scoredCandidates, existingArticles, limit) {
  const sorted = [...scoredCandidates].sort((a, b) => b.preScore - a.preScore);
  const acceptedTopics = existingArticles.map((a) => {
    let urlSlug = "";
    try {
      urlSlug = new URL(a.url).pathname;
    } catch {
      urlSlug = "";
    }
    return extractTopicTokens(`${a.gameTitle || ""} ${a.title} ${urlSlug}`);
  });

  const selected = [];
  const sourceCounts = new Map();

  for (const item of sorted) {
    if (selected.length >= limit) break;
    const itemTokens = getCandidateTopicTokens(item);
    if (acceptedTopics.some((t) => isSimilarTopic(itemTokens, t))) {
      continue;
    }
    const count = sourceCounts.get(item.source) || 0;
    if (count < 3) {
      selected.push(item);
      acceptedTopics.push(itemTokens);
      sourceCounts.set(item.source, count + 1);
    }
  }

  for (const item of sorted) {
    if (selected.length >= limit) break;
    if (selected.includes(item)) continue;
    const itemTokens = getCandidateTopicTokens(item);
    if (acceptedTopics.some((t) => isSimilarTopic(itemTokens, t))) {
      continue;
    }
    selected.push(item);
    acceptedTopics.push(itemTokens);
  }

  return selected;
}

function computePriorityScore(article, nowMs = Date.now()) {
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

  if (importance <= 5 && !article.isControversy && !article.isUpcoming) {
    signalScore *= 0.78;
  }

  const ageHours = getArticleAgeMs(article.publishedAt, nowMs) / (1000 * 60 * 60);
  return signalScore / Math.pow(ageHours + 2.5, 1.05);
}

function readExistingArticles() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, "utf-8").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Warning: Could not parse existing data/news.json, starting fresh:", err.message);
    return [];
  }
}

function writeArticles(articles) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const capped = articles.slice(0, MAX_STORED_ARTICLES);
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(capped, null, 2)}\n`, "utf-8");
}

async function rewriteWithGemini(model, article) {
  const prompt = [
    "You are the lead editor of Gamer Yap, covering AAA blockbusters, beloved fan-favorite franchises, upcoming game announcements & rumors, player social media reactions, and industry controversies.",
    "Rewrite the source story below into strict JSON matching the schema. Base ALL facts strictly on the provided source material and community notes—never fabricate fake quotes or rumors.",
    "- title: Punchy, high-curiosity editorial headline (max 110 chars). Frame active controversies, upcoming reveals, or credible rumors clearly.",
    "- summary: Crisp 2-3 sentence overview capturing what happened and why gamers care.",
    "- content: Array of 4 to 5 well-structured, informative paragraphs in original prose covering all concrete facts, dates, platforms, studio responses, and broader context.",
    "- highlights: Array of 3 to 4 crisp bullet takeaways.",
    "- socialPulse: Detailed breakdown of people's opinions and social-media buzz around this game/topic:",
    "  * sentiment: Pick one of Backlash, Divided, Hyped, Heated, Mixed.",
    "  * viralPlatforms: 1 to 4 platforms where discussion is happening (e.g. 'X / Twitter', 'Reddit', 'Steam', 'YouTube', 'Discord', 'Lemmy').",
    "  * summary: Detailed 3-4 sentence elaboration explaining what players are praising, criticizing, or debating on social media right now.",
    "  * viewpoints: 2 distinct perspectives from the community, each with a 'stance' title and a detailed 2-sentence 'detail'.",
    "- category: Best fit from PC, Console, Industry, Reviews.",
    "- gameTitle: Exact name of the primary video game featured in the headline (e.g. 'Grand Theft Auto 6', 'Hollow Knight: Silksong', 'The Witcher 3'), or empty string if it is hardware, GPU drivers, studio policy, or industry-wide news (do NOT attach an incidental game mentioned in passing).",
    "- imageSearchQuery: Concrete query for finding an accurate game/hardware/studio photo (e.g. 'Grand Theft Auto VI', 'PlayStation 5', 'Hollow Knight Silksong').",
    "- gameScale: Classify the scale of the primary game/studio/platform: 'AAA' (blockbuster studios/publishers/consoles like Rockstar, Sony/PlayStation, Nintendo, Xbox, CDPR, Blizzard, Capcom, Activision, Ubisoft, Square Enix, EA, Nvidia, Valve/Steam), 'AA' (well-known mid-size studios like Team Cherry, Fatshark, CI Games, Auroch Digital), or 'Indie' (small niche indie titles).",
    "- fanbaseScore: Integer 1-10 rating the size and passion of the game/franchise fanbase (9-10 for GTA, Witcher, Zelda, Pokémon, CoD, Elden Ring, Silksong, Resident Evil, Monster Hunter, WoW, FF14, PlayStation/Nintendo/Xbox; 6-8 for popular AA games; 1-5 for small/niche titles).",
    "- isUpcoming: true ONLY if the story covers an unreleased upcoming game, unlaunched DLC/expansion, announcement reveal, release-date update, delay, or upcoming game rumor. Set false for already-released game patches, driver fixes, sales charts, or hardware guides.",
    "- isRumor: true if the story is a rumor, leak, insider report, datamine, or unconfirmed industry report; false for official news.",
    "- releaseWindow: Future release date or window ONLY when isUpcoming is true (never invent past dates), or empty string when false.",
    "- isControversy: true ONLY if there is real ongoing controversy, backlash, ban wave, AI/union dispute, legal takedown, or heated debate in the source text; false otherwise.",
    "- controversyAngle: Short 2-3 word label when isControversy is true (e.g. 'AI Mandate Backlash', 'Union Dispute', 'Tariff Price Hikes'), or empty string when false.",
    "- importance: Integer 1-10 (9-10 for blockbuster AAA launches/controversies/major reveals; 6-8 for notable updates/rumors; 4-5 for routine news).",
    "",
    `Source Publisher: ${article.source}`,
    `Original Title: ${article.rawTitle}`,
    article.communityNotes ? `\n${article.communityNotes}\n` : "",
    `Full Source Text:\n${article.rawText}`,
  ]
    .filter(Boolean)
    .join("\n");

  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    const errText = String(err?.message || "");
    if (/503|429|Service Unavailable|high demand/i.test(errText)) {
      await sleep(4500);
      result = await model.generateContent(prompt);
    } else {
      throw err;
    }
  }
  const rawText = result.response.text().trim();
  const cleanJson = rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleanJson);

  if (
    !parsed.title ||
    !parsed.summary ||
    !Array.isArray(parsed.content) ||
    parsed.content.length === 0
  ) {
    throw new Error("Gemini returned incomplete JSON payload");
  }

  const category = VALID_CATEGORIES.includes(parsed.category)
    ? parsed.category
    : "Industry";

  const gameScale = VALID_SCALES.includes(parsed.gameScale)
    ? parsed.gameScale
    : "AA";

  const fanbaseScore = Number.isFinite(Number(parsed.fanbaseScore))
    ? Math.min(10, Math.max(1, Math.round(Number(parsed.fanbaseScore))))
    : 5;

  const importance = Number.isFinite(Number(parsed.importance))
    ? Math.min(10, Math.max(1, Math.round(Number(parsed.importance))))
    : 6;

  const rawPulse = parsed.socialPulse || {};
  const sentiment = VALID_SENTIMENTS.includes(rawPulse.sentiment)
    ? rawPulse.sentiment
    : "Mixed";

  const socialPulse = {
    sentiment,
    viralPlatforms: Array.isArray(rawPulse.viralPlatforms)
      ? rawPulse.viralPlatforms.map((p) => String(p).trim()).filter(Boolean).slice(0, 4)
      : ["Social Media"],
    summary: String(rawPulse.summary || parsed.summary).trim(),
    viewpoints: Array.isArray(rawPulse.viewpoints)
      ? rawPulse.viewpoints
          .filter((v) => v?.stance && v?.detail)
          .map((v) => ({
            stance: String(v.stance).trim(),
            detail: String(v.detail).trim(),
          }))
          .slice(0, 3)
      : [],
  };

  return {
    title: String(parsed.title).trim(),
    summary: String(parsed.summary).trim(),
    content: parsed.content.map((p) => String(p).trim()).filter(Boolean),
    highlights: Array.isArray(parsed.highlights)
      ? parsed.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 4)
      : [],
    socialPulse,
    category,
    gameTitle: String(parsed.gameTitle || "").trim(),
    imageSearchQuery: String(parsed.imageSearchQuery || parsed.gameTitle || "").trim(),
    gameScale,
    fanbaseScore,
    isUpcoming: Boolean(parsed.isUpcoming || parsed.isRumor),
    isRumor: Boolean(parsed.isRumor),
    releaseWindow:
      parsed.isUpcoming || parsed.isRumor
        ? String(parsed.releaseWindow || (parsed.isRumor ? "Rumor / TBA" : "Coming Soon")).trim()
        : "",
    isControversy: Boolean(parsed.isControversy),
    controversyAngle: parsed.isControversy
      ? String(parsed.controversyAngle || "Hot Controversy").trim()
      : "",
    importance,
  };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    console.error("Error: Set a valid GEMINI_API_KEY environment variable before running.");
    process.exit(1);
  }

  const nowMs = Date.now();
  const existingArticles = readExistingArticles();

  // Retain articles within 72h (All) that have verified real external pictures
  const retainedExisting = existingArticles
    .filter((a) => isWithinHours(a.publishedAt, MAX_ALL_AGE_MS, nowMs) && a.image && !a.image.startsWith("/"))
    .map((a) => ({
      ...a,
      // Trending flag strictly reflects <=24h window
      isTrending: isWithinHours(a.publishedAt, MAX_TRENDING_AGE_MS, nowMs),
    }));

  const purgedCount = existingArticles.length - retainedExisting.length;
  if (purgedCount > 0) {
    console.log(`Purged ${purgedCount} expired (>72h) or invalid-image article(s) from data/news.json.`);
  }

  const seenUrls = new Set(
    retainedExisting.map((article) => normalizeUrl(article.url)).filter(Boolean)
  );

  const neededForBaseline = Math.max(0, MIN_TARGET_ARTICLES - retainedExisting.length);
  const targetNewArticles =
    retainedExisting.length < MIN_TARGET_ARTICLES
      ? Math.min(BOOTSTRAP_NEW_PER_RUN, Math.max(STEADY_NEW_PER_RUN, neededForBaseline))
      : Math.min(
          MAX_STEADY_NEW_PER_RUN,
          Math.max(STEADY_NEW_PER_RUN, purgedCount)
        );
  const candidatePoolLimit = Math.max(CANDIDATE_POOL_SIZE, targetNewArticles * 2);

  const trendingCount = retainedExisting.filter((a) => a.isTrending).length;
  console.log(
    `Loaded ${retainedExisting.length} retained (<=72h) stories (${trendingCount} in <=24h Trending). Mode: ${
      retainedExisting.length < MIN_TARGET_ARTICLES ? "BOOTSTRAP" : "STEADY"
    } | Target new stories: ${targetNewArticles}.`
  );

  const [feedResults, trendingGames, communityThreads] = await Promise.all([
    Promise.allSettled(
      FEEDS.map(async (feedConfig) => {
        const feed = await parser.parseURL(feedConfig.url);
        return { source: feedConfig.source, items: feed.items || [] };
      })
    ),
    fetchTrendingSteamGames(),
    fetchLemmyCommunityPulse(),
  ]);

  const unseenCandidates = [];
  for (let i = 0; i < feedResults.length; i++) {
    const res = feedResults[i];
    const sourceName = FEEDS[i].source;

    if (res.status === "rejected") {
      console.warn(`Failed to fetch ${sourceName} RSS:`, res.reason?.message || res.reason);
      continue;
    }

    for (const item of res.value.items) {
      const normalizedLink = normalizeUrl(item.link || item.guid);
      const rawTitle = stripHtml(item.title);
      const publishedAt = parsePublishedDate(item);
      const categories = Array.isArray(item.categories)
        ? item.categories.map((c) => (typeof c === "string" ? c : c?._ || "")).filter(Boolean)
        : [];

      if (
        !normalizedLink ||
        !rawTitle ||
        !publishedAt ||
        !isWithinHours(publishedAt, MAX_ALL_AGE_MS, nowMs) ||
        seenUrls.has(normalizedLink) ||
        isNoiseItem(rawTitle, categories)
      ) {
        continue;
      }

      seenUrls.add(normalizedLink);
      unseenCandidates.push({
        source: sourceName,
        rawTitle,
        rawText: extractRssBodyText(item) || rawTitle,
        url: normalizedLink,
        image: extractRssImage(item),
        publishedAt,
      });
    }
  }

  const trendingChanged = retainedExisting.some((a) => {
    const prev = existingArticles.find((e) => e.id === a.id);
    return Boolean(prev && prev.isTrending !== a.isTrending);
  });

  if (unseenCandidates.length === 0) {
    if (purgedCount > 0 || trendingChanged) {
      const sortedRetained = [...retainedExisting].sort(
        (a, b) => computePriorityScore(b, nowMs) - computePriorityScore(a, nowMs)
      );
      writeArticles(sortedRetained);
    }
    console.log("No new <=72h gaming news found across feeds.");
    process.exit(0);
  }

  const scored = scoreCandidatesImportance(
    unseenCandidates,
    trendingGames,
    communityThreads,
    nowMs
  );
  const candidatePool = selectBalancedTopCandidates(
    scored,
    retainedExisting,
    candidatePoolLimit
  );

  console.log(
    `Selected pool of ${candidatePool.length} AAA/trending/upcoming candidates out of ${unseenCandidates.length} unseen <=72h items. Enriching text & verifying images...`
  );

  await Promise.allSettled(
    candidatePool.map((candidate) => enrichArticleFromWeb(candidate))
  );

  console.log(`Rewriting up to ${targetNewArticles} verified-image article(s) with ${MODEL_NAME}...`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          summary: { type: SchemaType.STRING },
          content: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          highlights: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          socialPulse: {
            type: SchemaType.OBJECT,
            properties: {
              sentiment: {
                type: SchemaType.STRING,
                enum: VALID_SENTIMENTS,
              },
              viralPlatforms: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
              },
              summary: { type: SchemaType.STRING },
              viewpoints: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    stance: { type: SchemaType.STRING },
                    detail: { type: SchemaType.STRING },
                  },
                  required: ["stance", "detail"],
                },
              },
            },
            required: ["sentiment", "viralPlatforms", "summary", "viewpoints"],
          },
          category: {
            type: SchemaType.STRING,
            enum: VALID_CATEGORIES,
          },
          gameTitle: { type: SchemaType.STRING },
          imageSearchQuery: { type: SchemaType.STRING },
          gameScale: {
            type: SchemaType.STRING,
            enum: VALID_SCALES,
          },
          fanbaseScore: { type: SchemaType.INTEGER },
          isUpcoming: { type: SchemaType.BOOLEAN },
          isRumor: { type: SchemaType.BOOLEAN },
          releaseWindow: { type: SchemaType.STRING },
          isControversy: { type: SchemaType.BOOLEAN },
          controversyAngle: { type: SchemaType.STRING },
          importance: { type: SchemaType.INTEGER },
        },
        required: [
          "title",
          "summary",
          "content",
          "highlights",
          "socialPulse",
          "category",
          "gameTitle",
          "imageSearchQuery",
          "gameScale",
          "fanbaseScore",
          "isUpcoming",
          "isRumor",
          "releaseWindow",
          "isControversy",
          "controversyAngle",
          "importance",
        ],
      },
    },
  });

  const rewrittenArticles = [];
  let rewriteErrors = 0;
  const acceptedPostTopics = retainedExisting.map((a) =>
    extractTopicTokens(`${a.gameTitle || ""} ${a.title}`)
  );
  for (let i = 0; i < candidatePool.length && rewrittenArticles.length < targetNewArticles; i++) {
    const candidate = candidatePool[i];
    try {
      const rewritten = await rewriteWithGemini(model, candidate);
      const postTokens = extractTopicTokens(`${rewritten.gameTitle || ""} ${rewritten.title}`);
      if (acceptedPostTopics.some((t) => isSimilarTopic(postTokens, t))) {
        console.log(
          `[SKIP] Duplicate event detected after rewrite for "${rewritten.title}" (${candidate.source}); skipping.`
        );
        if (i < candidatePool.length - 1) await sleep(API_DELAY_MS);
        continue;
      }

      const bestImage = await resolveStrictRelevantImage(
        candidate,
        rewritten.gameTitle,
        rewritten.imageSearchQuery
      );

      if (!bestImage) {
        console.warn(
          `[SKIP] No verified relevant picture found for "${rewritten.title}" (${candidate.source}); skipping.`
        );
        if (i < candidatePool.length - 1) await sleep(API_DELAY_MS);
        continue;
      }

      acceptedPostTopics.push(postTokens);
      const isTrending = isWithinHours(candidate.publishedAt, MAX_TRENDING_AGE_MS, nowMs);

      rewrittenArticles.push({
        id: createId(candidate.url),
        title: rewritten.title,
        summary: rewritten.summary,
        content: rewritten.content,
        highlights: rewritten.highlights,
        socialPulse: rewritten.socialPulse,
        category: rewritten.category,
        gameTitle: rewritten.gameTitle,
        gameScale: rewritten.gameScale,
        fanbaseScore: rewritten.fanbaseScore,
        isUpcoming: rewritten.isUpcoming,
        isRumor: rewritten.isRumor,
        releaseWindow: rewritten.releaseWindow,
        isControversy: rewritten.isControversy,
        controversyAngle: rewritten.controversyAngle,
        isTrending,
        importance: rewritten.importance,
        source: candidate.source,
        url: candidate.url,
        image: bestImage,
        publishedAt: candidate.publishedAt,
      });

      const flags = [
        rewritten.gameScale,
        `fan:${rewritten.fanbaseScore}`,
        isTrending ? "TRENDING(24h)" : "ARCHIVE(72h)",
        rewritten.isRumor ? "RUMOR" : null,
        rewritten.isUpcoming ? `UPCOMING(${rewritten.releaseWindow})` : null,
        rewritten.isControversy ? `CONTROVERSY` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      console.log(
        `[${rewrittenArticles.length}/${targetNewArticles}] (${candidate.source} | ${flags}) ${rewritten.title}`
      );
    } catch (err) {
      rewriteErrors++;
      console.error(`[candidate ${i + 1}] Error rewriting "${candidate.rawTitle}":`, err.message);
    }

    if (i < candidatePool.length - 1 && rewrittenArticles.length < targetNewArticles) {
      await sleep(API_DELAY_MS);
    }
  }

  if (rewrittenArticles.length === 0 && purgedCount === 0 && !trendingChanged) {
    if (rewriteErrors > 0) {
      console.error("All Gemini attempts failed; leaving data/news.json unchanged.");
      process.exit(1);
    }
    console.log("No qualifying unique/verified-image articles added; leaving data/news.json unchanged.");
    process.exit(0);
  }

  // Merge, enforce 72h limit, rank by gravity priority score, and evict lowest-ranked beyond 60
  const ranked = [...rewrittenArticles, ...retainedExisting]
    .filter((a) => isWithinHours(a.publishedAt, MAX_ALL_AGE_MS, nowMs))
    .sort((a, b) => computePriorityScore(b, nowMs) - computePriorityScore(a, nowMs));

  const combined = ranked.slice(0, MAX_STORED_ARTICLES);
  const evictedCount = Math.max(0, ranked.length - combined.length);

  writeArticles(combined);
  const newTrendingCount = combined.filter((a) => a.isTrending).length;
  console.log(
    `Saved ${rewrittenArticles.length} new article(s) (evicted ${evictedCount} lowest-ranked). Total in All (<=72h): ${combined.length}/${MAX_STORED_ARTICLES} | In Trending (<=24h): ${newTrendingCount}.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal script error:", err);
  process.exit(1);
});
