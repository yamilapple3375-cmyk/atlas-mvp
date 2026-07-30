"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { addHistoryEntry, getHistory, getProfile } from "@/lib/profile";
import { FeedbackValue, Recommendation } from "@/lib/types";

export default function DiscoveryWeeklyPage() {
  const router = useRouter();
  const [pick, setPick] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const fetchPick = useCallback(async () => {
    const profile = await getProfile();
    if (!profile) {
      router.replace("/onboarding");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const history = await getHistory();
      const res = await fetch("/api/discovery-weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, history }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setPick(null);
      } else {
        setPick(data as Recommendation);
      }
    } catch {
      setError("We couldn't connect to the server.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount, standard pattern
    fetchPick();
  }, [fetchPick]);

  async function handleFeedback(feedback: FeedbackValue) {
    if (!pick) return;
    try {
      await addHistoryEntry({
        id: pick.id,
        mediaType: pick.mediaType,
        title: pick.title,
        feedback,
        genreIds: pick.genreIds,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Couldn't save feedback:", err);
    }
    setDone(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
        ✨ Discovery of the Week
      </p>

      {loading && <p className="mt-6 text-sm text-zinc-500">Finding your weekly pick…</p>}

      {!loading && error && <p className="mt-6 text-sm text-zinc-300">{error}</p>}

      {!loading && !error && pick && done && (
        <div className="mt-6">
          <p className="text-sm text-zinc-400">
            Noted — thanks! Come back next Monday for a new Discovery pick.
          </p>
          <Link
            href="/recommendation"
            className="mt-4 inline-block rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black"
          >
            Get a regular recommendation
          </Link>
        </div>
      )}

      {!loading && !error && pick && !done && (
        <div>
          <div className="mt-4 flex gap-4">
            {pick.posterUrl ? (
              <Image
                src={pick.posterUrl}
                alt={pick.title}
                width={120}
                height={180}
                className="rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-[180px] w-[120px] items-center justify-center rounded-lg bg-zinc-900 text-xs text-zinc-600">
                No image
              </div>
            )}
            <div className="flex flex-col justify-center">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                {pick.mediaType === "movie" ? "Movie" : "Series"}
                {pick.year ? ` · ${pick.year}` : ""}
              </p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight">{pick.title}</h1>
              <p className="mt-2 text-sm text-zinc-400">
                {pick.runtimeMinutes ? `${pick.runtimeMinutes} min · ` : ""}⭐ {pick.voteAverage.toFixed(1)}
              </p>
            </div>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-zinc-300">{pick.explanation}</p>

          {pick.overview && (
            <p className="mt-4 text-sm leading-relaxed text-zinc-500">{pick.overview}</p>
          )}

          {pick.trailerUrl && (
            <a
              href={pick.trailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-300 underline underline-offset-4 hover:text-white"
            >
              ▶ Watch trailer
            </a>
          )}

          {pick.watchProviders.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Where to watch
                {pick.watchProviders[0]?.fallbackRegion && (
                  <span className="ml-2 normal-case text-zinc-600">
                    (not confirmed for your region — showing {pick.watchProviders[0].fallbackRegion} availability)
                  </span>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {pick.watchProviders.map((provider) => (
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
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => handleFeedback("like")}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-zinc-200"
            >
              Like it
            </button>
            <button
              onClick={() => handleFeedback("dislike")}
              className="rounded-full border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:border-zinc-500"
            >
              Not interested
            </button>
            <button
              onClick={() => handleFeedback("seen")}
              className="rounded-full border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:border-zinc-500"
            >
              Already seen it
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
