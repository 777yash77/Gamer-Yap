import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-archivo",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Gamer Yap | Trending Gaming News, Backlash & Hot Takes",
    template: "%s | Gamer Yap",
  },
  description:
    "AAA gaming news, upcoming game reveals, social media reactions, and industry controversies curated from top gaming publications.",
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "Gamer Yap",
    title: "Gamer Yap | Trending Gaming News, Backlash & Hot Takes",
    description:
      "AAA gaming news, upcoming game reveals, social media reactions, and industry controversies.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Gamer Yap | Trending Gaming News, Backlash & Hot Takes",
    description:
      "AAA gaming news, upcoming game reveals, social media reactions, and industry controversies.",
  },
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem("gameryap-theme");
    var isDark = saved ? saved === "dark" : true;
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${archivo.variable} ${jetbrainsMono.variable} dark h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-[#f5f5f2] font-sans text-zinc-900 antialiased selection:bg-[#ff2e4c]/20 selection:text-zinc-950 dark:bg-[#0b0c0e] dark:text-zinc-100 dark:selection:bg-[#ff2e4c]/30 dark:selection:text-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Gamer Yap",
              url: siteUrl,
              publisher: {
                "@type": "Organization",
                name: "Gamer Yap",
                url: siteUrl,
              },
            }).replace(/</g, "\\u003c"),
          }}
        />
        {/* Top Utility Dateline Bar */}
        <div className="border-b border-zinc-200 bg-[#ebebE6] dark:border-white/[0.07] dark:bg-[#08090b]">
          <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-4 py-2 font-mono text-[11px] tracking-wider text-zinc-600 uppercase sm:px-6 lg:px-8 dark:text-zinc-500">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-block h-1.5 w-1.5 shrink-0 bg-[#ff2e4c]" />
              <span className="truncate">
                IGN • PC GAMER • EUROGAMER • KOTAKU • INSIDER GAMING • GAMESPOT • VGC
              </span>
            </div>
            <span className="hidden shrink-0 md:inline">
              GAMING NEWS • SOCIAL PULSE • UPCOMING RADAR
            </span>
          </div>
        </div>

        {/* Persistent Sticky Global Navigation */}
        <nav
          aria-label="Primary navigation"
          className="sticky top-0 z-40 border-b border-zinc-200/90 bg-[#f5f5f2]/92 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#0b0c0e]/92"
        >
          <div className="mx-auto flex max-w-[1320px] items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="group inline-flex items-center gap-3 focus:outline-none"
            >
              <span className="h-6 w-1.5 bg-[#ff2e4c] transition-transform group-hover:scale-y-110" />
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-extrabold tracking-[-0.04em] text-zinc-950 uppercase sm:text-[26px] dark:text-white">
                  GAMER <span className="text-[#e11d3a] dark:text-[#ff2e4c]">YAP</span>
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2.5">
              <ThemeToggle />
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs font-semibold tracking-wider text-zinc-800 uppercase shadow-xs transition-colors hover:border-[#ff2e4c] hover:text-[#d91b38] dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-zinc-200 dark:shadow-none dark:hover:border-[#ff2e4c]/60 dark:hover:bg-[#ff2e4c]/10 dark:hover:text-white"
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
                  <path d="M3 10.5L12 3l9 7.5" />
                  <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
                </svg>
                <span>Home</span>
              </Link>
            </div>
          </div>
        </nav>

        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer className="mt-20 border-t border-zinc-200 bg-[#ebebE6] dark:border-white/[0.08] dark:bg-[#08090b]">
          <div className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-4 px-4 py-8 text-xs text-zinc-600 sm:flex-row sm:items-center sm:px-6 lg:px-8 dark:text-zinc-500">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="font-display text-sm font-extrabold tracking-tight text-zinc-950 uppercase hover:text-[#d91b38] dark:text-white dark:hover:text-[#ff2e4c]"
              >
                GAMER <span className="text-[#e11d3a] dark:text-[#ff2e4c]">YAP</span>
              </Link>
              <span className="text-zinc-400 dark:text-zinc-700">|</span>
              <p>
                Trending game coverage, community backlash &amp; breaking news
                with direct attribution to reporting outlets.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase">
              <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-3 text-zinc-600 dark:text-zinc-400">
                <Link href="/about" className="hover:text-[#d91b38] dark:hover:text-white">
                  About
                </Link>
                <Link href="/privacy-policy" className="hover:text-[#d91b38] dark:hover:text-white">
                  Privacy
                </Link>
                <Link href="/terms" className="hover:text-[#d91b38] dark:hover:text-white">
                  Terms
                </Link>
                <Link href="/contact" className="hover:text-[#d91b38] dark:hover:text-white">
                  Contact
                </Link>
              </nav>
              <span className="text-zinc-400 dark:text-zinc-700">•</span>
              <p className="text-zinc-500 dark:text-zinc-600">
                © 2026 GAMER YAP
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
