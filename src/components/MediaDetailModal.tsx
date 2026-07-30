"use client";

import { useState } from "react";
import Image from "next/image";
import { WatchProvider } from "@/lib/types";
import { LibraryItem } from "@/lib/useLibraryItems";

export interface ItemDetail {
  overview: string;
  year: string | null;
  runtimeMinutes: number | null;
  voteAverage: number;
  watchProviders: WatchProvider[];
  trailerUrl: string | null;
}

export default function MediaDetailModal({
  item,
  detail,
  loading,
  error,
  onClose,
  onToggleFavorite,
  onMarkSeen,
  onDislike,
  onUpdateProgress,
  alreadyInLibrary,
}: {
  item: LibraryItem;
  detail: ItemDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onToggleFavorite: (item: LibraryItem) => void;
  onMarkSeen?: (item: LibraryItem) => void;
  onDislike?: (item: LibraryItem) => void;
  onUpdateProgress?: (item: LibraryItem, season: number, episode: number) => void;
  alreadyInLibrary?: boolean;
}) {
  const [season, setSeason] = useState(item.season ?? 1);
  const [episode, setEpisode] = useState(item.episode ?? 1);
  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-zinc-950 p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4">
            {item.posterUrl ? (
              <Image
                src={item.posterUrl}
                alt={item.title}
                width={96}
                height={144}
                className="rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-[144px] w-[96px] items-center justify-center rounded-lg bg-zinc-900 text-[10px] text-zinc-600">
                No image
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                {item.mediaType === "movie" ? "Movie" : "Series"}
                {detail?.year ? ` · ${detail.year}` : ""}
              </p>
              <h2 className="mt-1 text-xl font-semibold leading-tight">{item.title}</h2>
              {detail && (
                <p className="mt-2 text-sm text-zinc-400">
                  {detail.runtimeMinutes ? `${detail.runtimeMinutes} min · ` : ""}⭐{" "}
                  {detail.voteAverage.toFixed(1)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-400 hover:border-zinc-500"
          >
            ✕
          </button>
        </div>

        {loading && <p className="mt-6 text-sm text-zinc-500">Loading details…</p>}
        {error && <p className="mt-6 text-sm text-zinc-300">{error}</p>}

        {detail && (
          <>
            {detail.overview && (
              <p className="mt-6 text-sm leading-relaxed text-zinc-400">{detail.overview}</p>
            )}

            {detail.trailerUrl && (
              <a
                href={detail.trailerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-300 underline underline-offset-4 hover:text-white"
              >
                ▶ Watch trailer
              </a>
            )}

            {detail.watchProviders.length > 0 ? (
              <div className="mt-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Where to watch
                  {detail.watchProviders[0]?.fallbackRegion && (
                    <span className="ml-2 normal-case text-zinc-600">
                      (not confirmed for your region — showing {detail.watchProviders[0].fallbackRegion} availability)
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {detail.watchProviders.map((provider) => (
                    <div
                      key={provider.name}
                      className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 py-1 pl-1 pr-3"
                    >
                      <Image
                        src={provider.logoUrl}
                        alt={provider.name}
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                      <span className="text-xs text-zinc-300">{provider.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-6 text-xs text-zinc-600">
                We couldn&apos;t find a streaming option for this right now.
              </p>
            )}
          </>
        )}

        {item.mediaType === "tv" && onUpdateProgress && (
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Continue watching
            </p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                Season
                <input
                  type="number"
                  min={1}
                  value={season}
                  onChange={(e) => setSeason(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 rounded-lg border border-zinc-700 bg-transparent px-2 py-1 text-sm text-white"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                Episode
                <input
                  type="number"
                  min={1}
                  value={episode}
                  onChange={(e) => setEpisode(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 rounded-lg border border-zinc-700 bg-transparent px-2 py-1 text-sm text-white"
                />
              </label>
            </div>
            <button
              onClick={() => onUpdateProgress(item, season, episode)}
              className="mt-3 rounded-full border border-zinc-700 px-4 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
            >
              {item.season != null ? "Update progress" : "Save progress"}
            </button>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={() => onToggleFavorite(item)}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-zinc-200"
          >
            {item.feedback === "like" ? "♥ Favorited" : "♡ Mark as favorite"}
          </button>

          {onMarkSeen && (
            <button
              onClick={() => onMarkSeen(item)}
              disabled={alreadyInLibrary}
              className="rounded-full border border-zinc-700 px-5 py-2.5 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {alreadyInLibrary ? "✓ In your library" : "+ Add to library"}
            </button>
          )}

          {onDislike && (
            <button
              onClick={() => onDislike(item)}
              disabled={item.feedback === "dislike"}
              className="rounded-full border border-zinc-700 px-5 py-2.5 text-sm text-zinc-400 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {item.feedback === "dislike" ? "Not interested" : "🚫 Not interested"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
