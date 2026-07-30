"use client";

import Link from "next/link";
import { useState } from "react";
import { addHistoryEntry } from "@/lib/profile";
import { GenreDef, genresForItem, GENRES } from "@/lib/genres";
import { FeedbackValue } from "@/lib/types";
import { LibraryItem, useLibraryItems } from "@/lib/useLibraryItems";
import PosterRow from "@/components/PosterRow";
import MediaDetailModal, { ItemDetail } from "@/components/MediaDetailModal";
import MediaTypeToggle, { MediaFilter } from "@/components/MediaTypeToggle";

export default function LibraryPage() {
  const { items, setItems, error } = useLibraryItems();

  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function toggleFavorite(item: LibraryItem) {
    const nextFeedback: FeedbackValue = item.feedback === "like" ? "seen" : "like";
    setItems((current) =>
      current
        ? current.map((i) =>
            i.id === item.id && i.mediaType === item.mediaType
              ? { ...i, feedback: nextFeedback }
              : i,
          )
        : current,
    );
    setSelectedItem((s) => (s && s.id === item.id ? { ...s, feedback: nextFeedback } : s));
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
      console.error("Couldn't update favorite:", err);
    }
  }

  async function updateProgress(item: LibraryItem, season: number, episode: number) {
    setItems((current) =>
      current
        ? current.map((i) =>
            i.id === item.id && i.mediaType === item.mediaType ? { ...i, season, episode } : i,
          )
        : current,
    );
    setSelectedItem((s) => (s && s.id === item.id ? { ...s, season, episode } : s));
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

  const filteredItems =
    items?.filter((item) => mediaFilter === "all" || item.mediaType === mediaFilter) ?? [];
  const favorites = filteredItems.filter((item) => item.feedback === "like");
  const continueWatching = filteredItems.filter(
    (item) => item.mediaType === "tv" && (item.season != null || item.episode != null),
  );
  const genreBuckets: { def: GenreDef; items: LibraryItem[] }[] =
    items === null
      ? []
      : GENRES.map((def) => ({
          def,
          items: filteredItems.filter((item) =>
            genresForItem(item.mediaType, item.genreIds).some((g) => g.key === def.key),
          ),
        })).filter((bucket) => bucket.items.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <div className="mb-8 flex items-center justify-between text-sm text-zinc-500">
        <Link
          href="/search"
          aria-label="Search"
          className="flex items-center gap-2 text-zinc-300 hover:text-white"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/lists" className="underline underline-offset-4 hover:text-zinc-300">
            My Lists
          </Link>
          <Link href="/onboarding" className="underline underline-offset-4 hover:text-zinc-300">
            Redo my profile
          </Link>
        </div>
      </div>

      <h1 className="text-2xl font-semibold">My Library</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Everything you&apos;ve rated, always at hand.
      </p>

      {items !== null && items.length > 0 && (
        <div className="mt-6">
          <MediaTypeToggle value={mediaFilter} onChange={setMediaFilter} />
        </div>
      )}

      {error && <p className="mt-6 text-sm text-zinc-300">{error}</p>}

      {items === null && !error && (
        <p className="mt-10 text-center text-sm text-zinc-500">Loading your library…</p>
      )}

      {items !== null && items.length === 0 && (
        <p className="mt-10 text-center text-sm text-zinc-500">
          Your library is empty. Get a recommendation and rate it — it&apos;ll show up here.
        </p>
      )}

      {items !== null && items.length > 0 && filteredItems.length === 0 && (
        <p className="mt-10 text-center text-sm text-zinc-500">
          Nothing here yet for {mediaFilter === "movie" ? "movies" : "series"}.
        </p>
      )}

      {continueWatching.length > 0 && (
        <PosterRow
          title="Continue Watching"
          items={continueWatching}
          onToggleFavorite={toggleFavorite}
          onOpen={openDetail}
        />
      )}

      {favorites.length > 0 && (
        <PosterRow title="Favorites" items={favorites} onToggleFavorite={toggleFavorite} onOpen={openDetail} />
      )}

      {genreBuckets.map(({ def, items: bucketItems }) => (
        <PosterRow
          key={def.key}
          title={def.label}
          items={bucketItems}
          onToggleFavorite={toggleFavorite}
          onOpen={openDetail}
        />
      ))}

      {selectedItem && (
        <MediaDetailModal
          item={selectedItem}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
          onToggleFavorite={toggleFavorite}
          onUpdateProgress={updateProgress}
        />
      )}
    </main>
  );
}
