import type { Metadata } from "next";
import Link from "next/link";
import { getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service, source attribution, and commentary disclaimers for Gamer Yap.",
  alternates: { canonical: `${siteUrl}/terms` },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="mb-6 flex items-center gap-2 font-mono text-xs text-zinc-500 uppercase">
        <Link href="/" className="font-semibold text-zinc-900 hover:text-[#d91b38] dark:text-zinc-200 dark:hover:text-[#ff2e4c]">
          ← Home
        </Link>
        <span>/</span>
        <span>Terms of Service</span>
      </div>

      <h1 className="font-display text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
        Terms of Service
      </h1>
      <p className="mt-2 font-mono text-xs text-zinc-500 uppercase">
        Last Updated: November 2026
      </p>

      <div className="mt-8 space-y-6 rounded-xl border border-zinc-200 bg-white p-6 text-sm leading-relaxed text-zinc-700 dark:border-white/[0.08] dark:bg-[#101218] dark:text-zinc-300">
        <section>
          <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-950 uppercase dark:text-white">
            1. Editorial Content &amp; Attribution
          </h2>
          <p className="mt-2">
            Gamer Yap publishes editorial summaries, takeaways, and social
            reaction analyses of gaming news with clear source attribution and
            direct outbound links to reporting publications. Game titles,
            trademarks, and official artwork belong to their respective
            publishers and creators.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-950 uppercase dark:text-white">
            2. Rumors &amp; Information Accuracy
          </h2>
          <p className="mt-2">
            Stories labeled as Rumor reflect unconfirmed industry reports or
            community discussions at the time of publication. Content is
            provided for informational and entertainment purposes &ldquo;as
            is&rdquo; without warranties regarding future release dates or
            pricing.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-950 uppercase dark:text-white">
            3. Removal &amp; Copyright Requests
          </h2>
          <p className="mt-2">
            Rights holders or publishers may request link adjustments or removal
            via our{" "}
            <Link
              href="/contact"
              className="font-semibold underline decoration-[#e11d3a] underline-offset-4 dark:decoration-[#ff2e4c]"
            >
              Contact page
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
