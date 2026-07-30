"use client";

import { useCallback, useEffect, useState } from "react";
import { getListItems } from "@/lib/lists";
import { LibraryItem } from "@/lib/useLibraryItems";

export function useListItems(listId: number) {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const entries = await getListItems(listId);
    if (entries.length === 0) {
      setItems([]);
      return;
    }

    try {
      const res = await fetch("/api/media/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: entries.map((e) => ({ id: e.mediaId, mediaType: e.mediaType })),
        }),
      });
      const data = await res.json();
      const detailsByKey = new Map<string, { posterUrl: string | null; genreIds: number[] }>();
      for (const d of data.results ?? []) {
        detailsByKey.set(`${d.mediaType}-${d.id}`, { posterUrl: d.posterUrl, genreIds: d.genreIds });
      }

      const merged: LibraryItem[] = entries.map((e) => {
        const details = detailsByKey.get(`${e.mediaType}-${e.mediaId}`);
        return {
          id: e.mediaId,
          mediaType: e.mediaType,
          title: e.title,
          posterUrl: details?.posterUrl ?? null,
          genreIds: details?.genreIds ?? [],
          feedback: "seen",
        };
      });
      setItems(merged);
    } catch {
      setError("We couldn't load this list right now.");
    }
  }, [listId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/dependency change, the standard useEffect data-fetching pattern
    load();
  }, [load]);

  return { items, setItems, error, reload: load };
}
