"use client";

import { genresForItem } from "@/lib/genres";
import { useLibraryItems } from "@/lib/useLibraryItems";

export default function WrappedPage() {
  const { items, error } = useLibraryItems();

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
        <p className="text-sm text-zinc-300">{error}</p>
      </main>
    );
  }

  if (items === null) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
        <p className="text-center text-sm text-zinc-500">Crunching your numbers…</p>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
        <h1 className="text-2xl font-semibold">Your Atlas Wrapped</h1>
        <p className="mt-10 text-center text-sm text-zinc-500">
          Rate a few titles and come back — we&apos;ll have stats for you.
        </p>
      </main>
    );
  }

  const movieCount = items.filter((i) => i.mediaType === "movie").length;
  const tvCount = items.filter((i) => i.mediaType === "tv").length;
  const favoriteCount = items.filter((i) => i.feedback === "like").length;

  const genreTally = new Map<string, number>();
  for (const item of items) {
    for (const g of genresForItem(item.mediaType, item.genreIds)) {
      genreTally.set(g.label, (genreTally.get(g.label) ?? 0) + 1);
    }
  }
  const topGenres = Array.from(genreTally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topGenre = topGenres[0];
  const dominantFormat =
    movieCount === tvCount ? "an even split" : movieCount > tvCount ? "movies" : "series";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Atlas</p>
      <h1 className="mt-2 text-3xl font-semibold">Your taste, so far</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Everything we&apos;ve learned from your library.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-4">
        <StatCard value={items.length} label="Titles rated" />
        <StatCard value={favoriteCount} label="Favorites" />
        <StatCard value={movieCount} label="Movies" />
        <StatCard value={tvCount} label="Series" />
      </div>

      {topGenre && (
        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Your top genre</p>
          <p className="mt-2 text-3xl font-semibold">{topGenre[0]}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {topGenre[1]} of your titles fall here. You lean toward {dominantFormat}.
          </p>
        </div>
      )}

      {topGenres.length > 1 && (
        <div className="mt-8">
          <p className="mb-3 text-sm font-medium text-zinc-400">Genre breakdown</p>
          <div className="flex flex-col gap-2">
            {topGenres.map(([label, count]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm text-zinc-300">{label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${Math.round((count / topGenres[0][1]) * 100)}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs text-zinc-500">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
      <p className="text-4xl font-semibold">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}
