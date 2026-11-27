"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "gameryap-saved-ids";
const BOOKMARK_EVENT = "gameryap-bookmarks-change";
const EMPTY_IDS: string[] = [];

let cachedRaw: string | null = null;
let cachedIds: string[] = EMPTY_IDS;

function readIdsFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) {
      return cachedIds;
    }
    cachedRaw = raw;
    if (!raw) {
      cachedIds = EMPTY_IDS;
      return cachedIds;
    }
    const parsed = JSON.parse(raw);
    cachedIds = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : EMPTY_IDS;
    return cachedIds;
  } catch {
    return EMPTY_IDS;
  }
}

function subscribeBookmarks(callback: () => void) {
  window.addEventListener(BOOKMARK_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(BOOKMARK_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getServerBookmarks(): string[] {
  return EMPTY_IDS;
}

export function useBookmarks() {
  const savedIds = useSyncExternalStore(
    subscribeBookmarks,
    readIdsFromStorage,
    getServerBookmarks
  );

  function toggleBookmark(id: string) {
    const current = readIdsFromStorage();
    const exists = current.includes(id);
    const next = exists
      ? current.filter((item) => item !== id)
      : [id, ...current];
    try {
      const serialized = JSON.stringify(next);
      localStorage.setItem(STORAGE_KEY, serialized);
      cachedRaw = serialized;
      cachedIds = next;
    } catch {
      // Ignore storage failures in restricted browsing contexts
    }
    window.dispatchEvent(new Event(BOOKMARK_EVENT));
  }

  return { savedIds, toggleBookmark };
}
