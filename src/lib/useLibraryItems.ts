"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getHistory, getProfile } from "@/lib/profile";
import { FeedbackValue, MediaType } from "@/lib/types";

export interface LibraryItem {
  id: number;
  mediaType: MediaType;
  title: string;
  posterUrl: string | null;
  genreIds: number[];
  feedback: FeedbackValue;
}

export function useLibraryItems() {
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const profile = await getProfile();
      if (!profile) {
        router.replace("/onboarding");
        return;
      }

      const history = await getHistory();
      const latestByKey = new Map<string, (typeof history)[number]>();
      for (const entry of history) {
        const key = `${entry.mediaType}-${entry.id}`;
        const existing = latestByKey.get(key);
        if (!existing || new Date(entry.at) >= new Date(existing.at)) {
          latestByKey.set(key, entry);
        }
      }
      const candidates = Array.from(latestByKey.values()).filter(
        (entry) => entry.feedback !== "dislike",
      );

      if (candidates.length === 0) {
        if (!cancelled) setItems([]);
        return;
      }

      try {
        const res = await fetch("/api/media/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: candidates.map((c) => ({ id: c.id, mediaType: c.mediaType })),
          }),
        });
        const data = await res.json();
        const detailsByKey = new Map<string, { posterUrl: string | null; genreIds: number[] }>();
        for (const d of data.results ?? []) {
          detailsByKey.set(`${d.mediaType}-${d.id}`, { posterUrl: d.posterUrl, genreIds: d.genreIds });
        }

        const merged: LibraryItem[] = candidates.map((c) => {
          const details = detailsByKey.get(`${c.mediaType}-${c.id}`);
          return {
            id: c.id,
            mediaType: c.mediaType,
            title: c.title,
            posterUrl: details?.posterUrl ?? null,
            genreIds: details?.genreIds ?? c.genreIds,
            feedback: c.feedback,
          };
        });

        if (!cancelled) setItems(merged);
      } catch {
        if (!cancelled) setError("We couldn't load your library right now.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { items, setItems, error };
}
