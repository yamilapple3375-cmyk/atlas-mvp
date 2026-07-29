"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addHistoryEntry, getHistory, getProfile } from "@/lib/profile";
import { GenreDef, genresForItem, GENRES } from "@/lib/genres";
import { FeedbackValue, MediaType } from "@/lib/types";

interface LibraryItem {
  id: number;
  mediaType: MediaType;
  title: string;
  posterUrl: string | null;
  genreIds: number[];
  feedback: FeedbackValue;
}

export default function LibraryPage() {
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

  const favorites = items?.filter((item) => item.feedback === "like") ?? [];
  const genreBuckets: { def: GenreDef; items: LibraryItem[] }[] =
    items === null
      ? []
      : GENRES.map((def) => ({
          def,
          items: items.filter((item) =>
            genresForItem(item.mediaType, item.genreIds).some((g) => g.key === def.key),
          ),
        })).filter((bucket) => bucket.items.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <div className="mb-8 flex items-center justify-end text-sm text-zinc-500">
        <Link href="/onboarding" className="underline underline-offset-4 hover:text-zinc-300">
          Redo my profile
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">My Library</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Everything you&apos;ve rated, always at hand.
      </p>

      {error && <p className="mt-6 text-sm text-zinc-300">{error}</p>}

      {items === null && !error && (
        <p className="mt-10 text-center text-sm text-zinc-500">Loading your library…</p>
      )}

      {items !== null && items.length === 0 && (
        <p className="mt-10 text-center text-sm text-zinc-500">
          Your library is empty. Get a recommendation and rate it — it&apos;ll show up here.
        </p>
      )}

      {favorites.length > 0 && (
        <PosterRow title="Favorites" items={favorites} onToggleFavorite={toggleFavorite} />
      )}

      {genreBuckets.map(({ def, items: bucketItems }) => (
        <PosterRow
          key={def.key}
          title={def.label}
          items={bucketItems}
          onToggleFavorite={toggleFavorite}
        />
      ))}
    </main>
  );
}

function PosterRow({
  title,
  items,
  onToggleFavorite,
}: {
  title: string;
  items: LibraryItem[];
  onToggleFavorite: (item: LibraryItem) => void;
}) {
  return (
    <div className="mt-10">
      <p className="mb-3 text-sm font-medium text-zinc-500">
        {title} <span className="text-zinc-700">· {items.length}</span>
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => (
          <div key={`${item.mediaType}-${item.id}`} className="w-24 shrink-0 text-center">
            <div className="relative">
              {item.posterUrl ? (
                <Image
                  src={item.posterUrl}
                  alt={item.title}
                  width={96}
                  height={144}
                  className="rounded-md object-cover"
                />
              ) : (
                <div className="flex h-[144px] w-[96px] items-center justify-center rounded-md bg-zinc-900 text-[10px] text-zinc-600">
                  No image
                </div>
              )}
              <button
                onClick={() => onToggleFavorite(item)}
                aria-label={item.feedback === "like" ? "Remove favorite" : "Mark as favorite"}
                className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs transition ${
                  item.feedback === "like"
                    ? "bg-white text-black"
                    : "bg-black/60 text-white hover:bg-black/80"
                }`}
              >
                {item.feedback === "like" ? "♥" : "♡"}
              </button>
            </div>
            <p className="mt-1 truncate text-xs text-zinc-500">{item.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
