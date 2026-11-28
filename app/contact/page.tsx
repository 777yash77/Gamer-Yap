import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Gamer Yap for editorial corrections, source attribution requests, news tips, or takedown inquiries.",
  alternates: { canonical: `${siteUrl}/contact` },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="mb-6 flex items-center gap-2 font-mono text-xs text-zinc-500 uppercase">
        <Link href="/" className="font-semibold text-zinc-900 hover:text-[#d91b38] dark:text-zinc-200 dark:hover:text-[#ff2e4c]">
          ← Home
        </Link>
        <span>/</span>
        <span>Contact</span>
      </div>

      <h1 className="font-display text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
        Contact Gamer Yap
      </h1>
      <p className="mt-4 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        Have a correction, publisher attribution concern, gaming tip, or
        DMCA/removal request? Reach us directly through the channels below.
      </p>

      <div className="mt-8 space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-white/[0.08] dark:bg-[#101218]">
        <div>
          <h2 className="font-mono text-xs font-bold tracking-widest text-[#d91b38] uppercase dark:text-[#ff2e4c]">
            Editorial &amp; Corrections
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            Email:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-semibold text-zinc-950 underline decoration-[#e11d3a] underline-offset-4 dark:text-white dark:decoration-[#ff2e4c]"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>

        <div>
          <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-900 uppercase dark:text-zinc-200">
            Source Attribution &amp; Content Requests
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            If you represent a publication or studio and would like a link
            updated or a story removed from our archive, include the exact{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-white/[0.06]">
              gameryap.online/news/...
            </code>{" "}
            URL in your message and we will review it promptly.
          </p>
        </div>
      </div>
    </div>
  );
}
