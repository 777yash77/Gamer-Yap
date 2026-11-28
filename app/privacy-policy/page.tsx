import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Gamer Yap explaining browser localStorage preferences, external links, analytics, and advertising cookies.",
  alternates: { canonical: `${siteUrl}/privacy-policy` },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="mb-6 flex items-center gap-2 font-mono text-xs text-zinc-500 uppercase">
        <Link href="/" className="font-semibold text-zinc-900 hover:text-[#d91b38] dark:text-zinc-200 dark:hover:text-[#ff2e4c]">
          ← Home
        </Link>
        <span>/</span>
        <span>Privacy Policy</span>
      </div>

      <h1 className="font-display text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
        Privacy Policy
      </h1>
      <p className="mt-2 font-mono text-xs text-zinc-500 uppercase">
        Effective Date: November 2026
      </p>

      <div className="mt-8 space-y-6 rounded-xl border border-zinc-200 bg-white p-6 text-sm leading-relaxed text-zinc-700 dark:border-white/[0.08] dark:bg-[#101218] dark:text-zinc-300">
        <section>
          <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-950 uppercase dark:text-white">
            1. Information We Store Locally in Your Browser
          </h2>
          <p className="mt-2">
            Gamer Yap does not require user accounts or store personal profiles
            on our servers. Features like Dark/Light theme selection (
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-white/[0.06]">
              gameryap-theme
            </code>
            ) and Saved Bookmarks (
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-white/[0.06]">
              gameryap-saved-ids
            </code>
            ) are saved strictly inside your own browser&apos;s{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-white/[0.06]">
              localStorage
            </code>{" "}
            and can be cleared anytime from your browser settings.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-950 uppercase dark:text-white">
            2. Cookies &amp; Third-Party Advertising
          </h2>
          <p className="mt-2">
            When third-party advertising networks (such as Google AdSense) are
            active on this site, third-party vendors including Google may use
            cookies to serve ads based on your prior visits to this website or
            other websites. Users may opt out of personalized advertising by
            visiting Google&apos;s{" "}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-[#e11d3a] underline-offset-4 dark:decoration-[#ff2e4c]"
            >
              Ads Settings
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-950 uppercase dark:text-white">
            3. Server Logs &amp; External Links
          </h2>
          <p className="mt-2">
            Our hosting and CDN infrastructure processes standard HTTP request
            metadata (such as IP address, user agent, and timestamp) solely for
            security, caching, and reliability. Articles also link to external
            gaming publications whose own privacy policies govern their sites.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-950 uppercase dark:text-white">
            4. Contact
          </h2>
          <p className="mt-2">
            For any privacy questions, contact{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-semibold underline decoration-[#e11d3a] underline-offset-4 dark:decoration-[#ff2e4c]"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
