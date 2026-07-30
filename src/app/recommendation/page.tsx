"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  addHistoryEntry,
  addRecentlyShown,
  getContext,
  getHistory,
  getProfile,
  getRecentlyShown,
} from "@/lib/profile";
import { buildExplanation, computeConfidence, matchedFavoriteGenres } from "@/lib/explain";
import {
  ContextInput,
  EntertainmentProfile,
  FeedbackValue,
  Recommendation,
  RecommendationCandidate,
} from "@/lib/types";

export default function RecommendationPage() {
  const router = useRouter();
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [profile, setProfile] = useState<EntertainmentProfile | null>(null);
  const [context, setContext] = useState<ContextInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swappingId, setSwappingId] = useState<number | null>(null);

  const fetchRecommendation = useCallback(async () => {
    const loadedProfile = await getProfile();
    const loadedContext = getContext();
    if (!loadedProfile) {
      router.replace("/onboarding");
      return;
    }
    if (!loadedContext) {
      router.replace("/context");
      return;
    }
    setProfile(loadedProfile);
    setContext(loadedContext);

    setLoading(true);
    setError(null);
    try {
      const history = await getHistory();
      const recentlyShown = getRecentlyShown();
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: loadedProfile,
          context: loadedContext,
          history,
          recentlyShown,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setRecommendation(null);
      } else {
        setRecommendation(data as Recommendation);
        addRecentlyShown({ id: data.id, mediaType: data.mediaType });
      }
    } catch {
      setError("We couldn't connect to the server.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/dependency change, the standard useEffect data-fetching pattern
    fetchRecommendation();
  }, [fetchRecommendation]);

  async function handleFeedback(feedback: FeedbackValue) {
    if (!recommendation) return;
    try {
      await addHistoryEntry({
        id: recommendation.id,
        mediaType: recommendation.mediaType,
        title: recommendation.title,
        feedback,
        genreIds: recommendation.genreIds,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Couldn't save feedback:", err);
    }
    fetchRecommendation();
  }

  async function handleSelectAlternative(alt: RecommendationCandidate) {
    if (!recommendation || !profile || !context || swappingId !== null) return;
    setSwappingId(alt.id);
    try {
      const res = await fetch(`/api/media/${alt.mediaType}/${alt.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "We couldn't load this option.");

      const matched = matchedFavoriteGenres(profile.favoriteGenres, alt.mediaType, data.genreIds);
      const previousPick: RecommendationCandidate = {
        id: recommendation.id,
        mediaType: recommendation.mediaType,
        title: recommendation.title,
        posterUrl: recommendation.posterUrl,
        year: recommendation.year,
      };
      const remainingAlternatives = recommendation.alternatives.filter((a) => a.id !== alt.id);

      setRecommendation({
        id: data.id,
        mediaType: data.mediaType,
        title: data.title,
        overview: data.overview,
        posterUrl: data.posterUrl,
        year: data.year,
        runtimeMinutes: data.runtimeMinutes,
        voteAverage: data.voteAverage,
        explanation: buildExplanation(data.title, matched, context, false),
        confidence: computeConfidence(matched.length, profile.favoriteGenres.length, data.voteAverage),
        genreIds: data.genreIds,
        watchProviders: data.watchProviders,
        trailerUrl: data.trailerUrl,
        alternatives: [previousPick, ...remainingAlternatives].slice(0, 3),
      });
      addRecentlyShown({ id: data.id, mediaType: data.mediaType });
    } catch (err) {
      console.error("Couldn't switch options:", err);
    } finally {
      setSwappingId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-6 flex items-center justify-between text-sm text-zinc-500">
        <Link href="/context" className="underline underline-offset-4 hover:text-zinc-300">
          Change context
        </Link>
        <Link href="/onboarding" className="underline underline-offset-4 hover:text-zinc-300">
          Redo my profile
        </Link>
      </div>

      {loading && (
        <div className="animate-pulse">
          <div className="flex gap-4">
            <div className="h-[180px] w-[120px] rounded-lg bg-zinc-900" />
            <div className="flex flex-1 flex-col justify-center gap-3">
              <div className="h-3 w-20 rounded bg-zinc-900" />
              <div className="h-6 w-40 rounded bg-zinc-900" />
              <div className="h-3 w-32 rounded bg-zinc-900" />
            </div>
          </div>
          <p className="mt-8 text-center text-sm text-zinc-500">
            Thinking of what to recommend…
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="text-center">
          <p className="text-zinc-300">{error}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => fetchRecommendation()}
              className="rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black"
            >
              Try again
            </button>
            <Link
              href="/context"
              className="rounded-full border border-zinc-700 px-6 py-2.5 text-sm text-zinc-300 hover:border-zinc-500"
            >
              Change context
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && recommendation && (
        <div>
          <div className="flex gap-4">
            {recommendation.posterUrl ? (
              <Image
                src={recommendation.posterUrl}
                alt={recommendation.title}
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
                {recommendation.mediaType === "movie" ? "Movie" : "Series"}
                {recommendation.year ? ` · ${recommendation.year}` : ""}
              </p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight">
                {recommendation.title}
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                {recommendation.runtimeMinutes ? `${recommendation.runtimeMinutes} min · ` : ""}
                ⭐ {recommendation.voteAverage.toFixed(1)} · Match {recommendation.confidence}%
              </p>
            </div>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-zinc-300">
            {recommendation.explanation}
          </p>

          {recommendation.overview && (
            <p className="mt-4 text-sm leading-relaxed text-zinc-500">
              {recommendation.overview}
            </p>
          )}

          {recommendation.trailerUrl && (
            <a
              href={recommendation.trailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-300 underline underline-offset-4 hover:text-white"
            >
              ▶ Watch trailer
            </a>
          )}

          {recommendation.watchProviders.length > 0 ? (
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Where to watch
                {recommendation.watchProviders[0]?.fallbackRegion && (
                  <span className="ml-2 normal-case text-zinc-600">
                    (not confirmed for your region — showing {recommendation.watchProviders[0].fallbackRegion} availability)
                  </span>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {recommendation.watchProviders.map((provider) => (
                  <div
                    key={provider.name}
                    className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 py-1 pl-1 pr-3"
                    title={provider.name}
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
            <button
              onClick={() => fetchRecommendation()}
              className="rounded-full border border-dashed border-zinc-700 px-5 py-2.5 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
            >
              Show me another
            </button>
          </div>

          {recommendation.alternatives.length > 0 && (
            <div className="mt-10">
              <p className="mb-3 text-sm font-medium text-zinc-500">
                Other options — tap one to see it
              </p>
              <div className="flex gap-3 overflow-x-auto">
                {recommendation.alternatives.map((alt) => (
                  <button
                    key={alt.id}
                    onClick={() => handleSelectAlternative(alt)}
                    disabled={swappingId !== null}
                    className="w-20 shrink-0 text-center disabled:opacity-50"
                  >
                    {alt.posterUrl ? (
                      <Image
                        src={alt.posterUrl}
                        alt={alt.title}
                        width={80}
                        height={120}
                        className={`rounded-md object-cover transition ${
                          swappingId === alt.id ? "opacity-40" : "hover:opacity-80"
                        }`}
                      />
                    ) : (
                      <div className="flex h-[120px] w-[80px] items-center justify-center rounded-md bg-zinc-900 text-[10px] text-zinc-600">
                        No image
                      </div>
                    )}
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {swappingId === alt.id ? "Loading…" : alt.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-16 text-center text-[11px] text-zinc-700">
        Movie and TV data provided by TMDB.
      </p>
    </main>
  );
}
