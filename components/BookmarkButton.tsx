"use client";

import { useBookmarks } from "@/lib/bookmarks";

export default function BookmarkButton({
  articleId,
  variant = "icon",
}: {
  articleId: string;
  variant?: "icon" | "pill";
}) {
  const { savedIds, toggleBookmark } = useBookmarks();
  const isSaved = savedIds.includes(articleId);

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={() => toggleBookmark(articleId)}
        aria-pressed={isSaved}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold tracking-wider uppercase transition-colors ${
          isSaved
            ? "border-[#e11d3a] bg-[#e11d3a]/10 text-[#c8102e] dark:border-[#ff2e4c]/60 dark:bg-[#ff2e4c]/15 dark:text-[#ff2e4c]"
            : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-white/[0.25] dark:hover:text-white"
        }`}
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill={isSaved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>
        <span>{isSaved ? "Saved" : "Save"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggleBookmark(articleId)}
      aria-pressed={isSaved}
      aria-label={isSaved ? "Remove bookmark" : "Save story"}
      title={isSaved ? "Remove bookmark" : "Save story for later"}
      className={`inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors ${
        isSaved
          ? "text-[#e11d3a] dark:text-[#ff2e4c]"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
      }`}
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill={isSaved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      </svg>
    </button>
  );
}
