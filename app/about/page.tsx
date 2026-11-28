import type { Metadata } from "next";
import Link from "next/link";
import { getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn how Gamer Yap curates AAA gaming news, upcoming game reveals, community reactions, and original commentary with source attribution.",
  alternates: { canonical: `${siteUrl}/about` },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="mb-6 flex items-center gap-2 font-mono text-xs text-zinc-500 uppercase">
        <Link href="/" className="font-semibold text-zinc-900 hover:text-[#d91b38] dark:text-zinc-200 dark:hover:text-[#ff2e4c]">
          ← Home
        </Link>
        <span>/</span>
        <span>About</span>
      </div>

      <h1 className="font-display text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
        About Gamer Yap
      </h1>
      <p className="mt-4 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        Gamer Yap tracks breaking PC, PlayStation, Xbox, Nintendo, and industry
        news with a sharp focus on what players actually care about: major AAA
        releases, upcoming game rumors, patch breakdowns, and real community
        reactions across social media.
      </p>

      <section className="mt-8 space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-white/[0.08] dark:bg-[#101218]">
        <div>
          <h2 className="font-mono text-xs font-bold tracking-widest text-[#d91b38] uppercase dark:text-[#ff2e4c]">
            Editorial Approach &amp; Attribution
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            Every story on Gamer Yap links directly back to the reporting outlet
            (including IGN, PC Gamer, Eurogamer, GameSpot, VGC, Kotaku, Insider
            Gaming, Rock Paper Shotgun, Nintendo Life, Push Square, PCGamesN,
            Polygon, and Gematsu) and pairs structured news summaries with a
            dedicated Social Media Pulse highlighting differing community
            viewpoints.
          </p>
        </div>

        <div>
          <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-900 uppercase dark:text-zinc-200">
            Front Page &amp; Archive Lifecycle
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            Trending focuses on the hottest stories from the past 24 hours, the
            front page highlights up to 60 top stories from the last 72 hours,
            and older dispatches remain accessible in our 10-day reference
            archive for readers arriving via search or shared links.
          </p>
        </div>
      </section>
    </div>
  );
}
