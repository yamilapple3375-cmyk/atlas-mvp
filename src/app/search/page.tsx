"use client";

import { useEffect, useRef, useState } from "react";
import { addHistoryEntry, getHistory } from "@/lib/profile";
import { FeedbackValue } from "@/lib/types";
import { LibraryItem } from "@/lib/useLibraryItems";
import PosterRow from "@/components/PosterRow";
import MediaDetailModal, { ItemDetail } from "@/components/MediaDetailModal";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibraryItem[]>([]);
  const [matchedPerson, setMatchedPerson] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedbackByKey = useRef(new Map<string, FeedbackValue>());
  const [libraryKeys, setLibraryKeys] = useState<Set<string>>(new Set());

  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    getHistory().then((history) => {
      const keys = new Set<string>();
      for (const entry of history) {
        const key = `${entry.mediaType}-${entry.id}`;
        feedbackByKey.current.set(key, entry.feedback);
        keys.add(key);
      }
      setLibraryKeys(keys);
    });
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows a loading state while the debounce timer waits, not a derivable value
    setLoading(true);
    setError(null);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "We couldn't search right now.");
        const mapped: LibraryItem[] = (data.results ?? []).map(
          (r: {
            id: number;
            mediaType: "movie" | "tv";
            title: string;
            posterUrl: string | null;
            genreIds: number[];
          }) => ({
            id: r.id,
            mediaType: r.mediaType,
            title: r.title,
            posterUrl: r.posterUrl,
            genreIds: r.genreIds,
            feedback: feedbackByKey.current.get(`${r.mediaType}-${r.id}`) ?? "seen",
          }),
        );
        setResults(mapped);
        setMatchedPerson(data.matchedPerson ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "We couldn't search right now.");
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [query]);

  async function applyFeedback(item: LibraryItem, nextFeedback: FeedbackValue) {
    const key = `${item.mediaType}-${item.id}`;
    setResults((current) =>
      current.map((i) =>
        i.id === item.id && i.mediaType === item.mediaType ? { ...i, feedback: nextFeedback } : i,
      ),
    );
    setSelectedItem((s) => (s && s.id === item.id ? { ...s, feedback: nextFeedback } : s));
    feedbackByKey.current.set(key, nextFeedback);
    setLibraryKeys((current) => new Set(current).add(key));
    try {
      await addHistoryEntry({
        id: item.id,
        mediaType: item.mediaType,
        title: item.title,
        feedback: nextFeedback,
        genreIds: item.genreIds,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Couldn't update feedback:", err);
    }
  }

  function toggleFavorite(item: LibraryItem) {
    applyFeedback(item, item.feedback === "like" ? "seen" : "like");
  }

  function markSeen(item: LibraryItem) {
    applyFeedback(item, "seen");
  }

  function dislikeItem(item: LibraryItem) {
    applyFeedback(item, "dislike");
  }

  async function updateProgress(item: LibraryItem, season: number, episode: number) {
    const key = `${item.mediaType}-${item.id}`;
    setResults((current) =>
      current.map((i) =>
        i.id === item.id && i.mediaType === item.mediaType ? { ...i, season, episode } : i,
      ),
    );
    setSelectedItem((s) => (s && s.id === item.id ? { ...s, season, episode } : s));
    setLibraryKeys((current) => new Set(current).add(key));
    try {
      await addHistoryEntry({
        id: item.id,
        mediaType: item.mediaType,
        title: item.title,
        feedback: item.feedback,
        genreIds: item.genreIds,
        season,
        episode,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Couldn't update progress:", err);
    }
  }

  async function openDetail(item: LibraryItem) {
    setSelectedItem(item);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/media/${item.mediaType}/${item.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "We couldn't load this title.");
      setDetail(data as ItemDetail);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "We couldn't load this title.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedItem(null);
    setDetail(null);
    setDetailError(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <h1 className="text-2xl font-semibold">Search</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Find any movie or show, even if it&apos;s not in your library yet — or search an actor or
        director to see everything they&apos;ve worked on.
      </p>

      <div className="mt-6 flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-3">
        <svg
          className="h-4 w-4 shrink-0 text-zinc-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles…"
          autoFocus
          className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
      </div>

      {error && <p className="mt-6 text-sm text-zinc-300">{error}</p>}

      {query.trim() && loading && (
        <p className="mt-10 text-center text-sm text-zinc-500">Searching…</p>
      )}

      {query.trim() && !loading && !error && results.length === 0 && (
        <p className="mt-10 text-center text-sm text-zinc-500">No results for &quot;{query}&quot;.</p>
      )}

      {query.trim() && !loading && results.length > 0 && (
        <PosterRow
          title={matchedPerson ? `Starring or directed by ${matchedPerson}` : "Results"}
          items={results}
          onToggleFavorite={toggleFavorite}
          onOpen={openDetail}
          wrap
        />
      )}

      {selectedItem && (
        <MediaDetailModal
          item={selectedItem}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
          onToggleFavorite={toggleFavorite}
          onMarkSeen={markSeen}
          onDislike={dislikeItem}
          onUpdateProgress={updateProgress}
          alreadyInLibrary={libraryKeys.has(`${selectedItem.mediaType}-${selectedItem.id}`)}
        />
      )}
    </main>
  );
}
