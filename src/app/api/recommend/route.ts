import { NextResponse } from "next/server";
import { genreIds } from "@/lib/genres";
import {
  discoverMovies,
  discoverTv,
  getRuntimeMinutes,
  getWatchProviders,
  getTrailerUrl,
  DiscoverItem,
  DiscoverParams,
} from "@/lib/tmdb";
import { buildExplanation, computeConfidence, matchedFavoriteGenres } from "@/lib/explain";
import { pickWithAi } from "@/lib/claudeRecommend";
import {
  ContextInput,
  EntertainmentProfile,
  FeedbackEntry,
  FeedbackValue,
  GenreKey,
  MediaType,
  Mood,
  Recommendation,
  Tone,
} from "@/lib/types";

interface RecommendRequestBody {
  profile: EntertainmentProfile;
  context: ContextInput;
  history: FeedbackEntry[];
}

const MOOD_BOOST: Record<Mood, GenreKey[]> = {
  reir: ["comedia"],
  pensar: ["drama"],
  relajarme: ["familia", "comedia"],
  accion: ["accion"],
  intenso: ["thriller"],
  llorar: ["drama", "romance"],
  miedo: ["terror", "misterio"],
  romance: ["romance"],
  nostalgia: ["familia", "animacion", "aventura"],
};

const TONE_BOOST: Record<Tone, GenreKey[]> = {
  light: ["comedia", "familia", "animacion", "aventura"],
  intense: ["drama", "thriller", "terror", "crimen", "guerra"],
};

const FEEDBACK_SCORE: Record<FeedbackValue, number> = {
  like: 3,
  seen: 0.5,
  dislike: -3,
};

function pickMediaType(
  formatPreference: EntertainmentProfile["formatPreference"],
  timeBudget: ContextInput["timeBudget"],
): MediaType {
  if (formatPreference === "movies") return "movie";
  if (formatPreference === "series") return "tv";
  return timeBudget === "tarde" ? "movie" : "tv";
}

async function fetchCandidatePage(
  mediaType: MediaType,
  withGenreKeys: GenreKey[],
  withoutGenreKeys: GenreKey[],
  timeBudget: ContextInput["timeBudget"],
  page: number,
): Promise<DiscoverItem[]> {
  const withGenres = genreIds(withGenreKeys, mediaType);
  const withoutGenres = genreIds(withoutGenreKeys, mediaType);

  if (mediaType === "movie") {
    const runtimeGte = timeBudget === "corto" ? undefined : 60;
    const runtimeLte = timeBudget === "corto" ? 95 : 150;
    return discoverMovies({ withGenres, withoutGenres, page, runtimeGte, runtimeLte });
  }
  return discoverTv({ withGenres, withoutGenres, page });
}

/**
 * Narrower supplementary pool: pairs the mood's genre(s) with each of the
 * user's favorite genres via TMDB's AND semantics, so results are always
 * mood-safe (the mood genre is required) but more likely to actually match
 * their taste than the broad mood-only OR pool alone.
 */
async function fetchPersonalizedPool(
  mediaType: MediaType,
  moodGenreKeys: GenreKey[],
  favoriteGenreKeys: GenreKey[],
  withoutGenreKeys: GenreKey[],
  timeBudget: ContextInput["timeBudget"],
): Promise<DiscoverItem[]> {
  const moodIds = genreIds(moodGenreKeys, mediaType);
  const withoutGenres = genreIds(withoutGenreKeys, mediaType);
  if (moodIds.length === 0 || favoriteGenreKeys.length === 0) return [];

  const cappedFavorites = favoriteGenreKeys.slice(0, 6);
  const runtimeGte = mediaType === "movie" ? (timeBudget === "corto" ? undefined : 60) : undefined;
  const runtimeLte = mediaType === "movie" ? (timeBudget === "corto" ? 95 : 150) : undefined;

  const results = await Promise.all(
    cappedFavorites.map(async (favKey) => {
      const favIds = genreIds([favKey], mediaType);
      if (favIds.length === 0) return [];
      const params: DiscoverParams = {
        withGenres: [...moodIds, ...favIds],
        withoutGenres,
        page: 1,
        genreMode: "and",
        runtimeGte,
        runtimeLte,
      };
      try {
        return mediaType === "movie" ? await discoverMovies(params) : await discoverTv(params);
      } catch {
        return [];
      }
    }),
  );

  const seen = new Set<number>();
  const merged: DiscoverItem[] = [];
  for (const item of results.flat()) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

async function fetchCandidatePool(
  mediaType: MediaType,
  withGenreKeys: GenreKey[],
  withoutGenreKeys: GenreKey[],
  timeBudget: ContextInput["timeBudget"],
  startPage: number,
): Promise<DiscoverItem[]> {
  const [pageA, pageB] = await Promise.all([
    fetchCandidatePage(mediaType, withGenreKeys, withoutGenreKeys, timeBudget, startPage),
    fetchCandidatePage(mediaType, withGenreKeys, withoutGenreKeys, timeBudget, startPage + 1),
  ]);
  const seen = new Set<number>();
  const merged: DiscoverItem[] = [];
  for (const item of [...pageA, ...pageB]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

/** Learns a per-genre affinity score from past feedback: liked genres score up, disliked score down. */
function computeLearnedWeights(
  history: FeedbackEntry[],
  mediaType: MediaType,
): Map<number, number> {
  const weights = new Map<number, number>();
  for (const entry of history) {
    if (entry.mediaType !== mediaType) continue;
    const score = FEEDBACK_SCORE[entry.feedback] ?? 0;
    for (const gid of entry.genreIds ?? []) {
      weights.set(gid, (weights.get(gid) ?? 0) + score);
    }
  }
  return weights;
}

function scoreCandidate(
  candidate: DiscoverItem,
  index: number,
  favoriteGenreIds: number[],
  toneGenreIds: number[],
  learnedWeights: Map<number, number>,
): number {
  const positionScore = Math.max(0, 20 - index);
  const favoriteMatch = candidate.genreIds.filter((id) => favoriteGenreIds.includes(id)).length * 15;
  const toneMatch = candidate.genreIds.filter((id) => toneGenreIds.includes(id)).length * 8;
  const learned = candidate.genreIds.reduce((sum, id) => sum + (learnedWeights.get(id) ?? 0), 0);
  return positionScore + favoriteMatch + toneMatch + learned;
}

export async function POST(request: Request) {
  let body: RecommendRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { profile, context, history } = body;
  if (!profile || !context) {
    return NextResponse.json({ error: "Missing profile or context" }, { status: 400 });
  }

  const mediaType = pickMediaType(profile.formatPreference, context.timeBudget);
  const relevantHistory = history ?? [];
  const excludeIds = new Set(
    relevantHistory.filter((e) => e.mediaType === mediaType).map((e) => e.id),
  );
  const learnedWeights = computeLearnedWeights(relevantHistory, mediaType);

  // The mood the user picked right now is the hard gate on what genres are
  // even eligible — favorite genres and tone only influence ranking within
  // that pool (below), so picking "I want to laugh" never surfaces action.
  const moodBoost = MOOD_BOOST[context.mood] ?? [];
  const withGenreKeys = moodBoost;
  const startPage = Math.floor(Math.random() * 3) + 1;

  let candidates: DiscoverItem[] = [];
  try {
    candidates = await fetchCandidatePool(
      mediaType,
      withGenreKeys,
      profile.avoidGenres,
      context.timeBudget,
      startPage,
    );

    const personalized = await fetchPersonalizedPool(
      mediaType,
      moodBoost,
      profile.favoriteGenres,
      profile.avoidGenres,
      context.timeBudget,
    );
    const seenIds = new Set(candidates.map((c) => c.id));
    for (const item of personalized) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      candidates.push(item);
    }

    candidates = candidates.filter((c) => !excludeIds.has(c.id));

    if (candidates.length === 0) {
      // Fallback: drop genre filters, keep only the avoid-list, widen the net.
      candidates = await fetchCandidatePool(mediaType, [], profile.avoidGenres, context.timeBudget, 1);
      candidates = candidates.filter((c) => !excludeIds.has(c.id));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `We couldn't reach TMDB: ${message}` }, { status: 502 });
  }

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "We couldn't find anything new with these filters. Try changing the context." },
      { status: 404 },
    );
  }

  const favoriteGenreIds = genreIds(profile.favoriteGenres, mediaType);
  const toneGenreIds = genreIds(TONE_BOOST[profile.tone] ?? [], mediaType);
  const scored = candidates
    .map((candidate, index) => ({
      candidate,
      score: scoreCandidate(candidate, index, favoriteGenreIds, toneGenreIds, learnedWeights),
    }))
    .sort((a, b) => b.score - a.score);

  const topPool = scored.slice(0, 6).map((s) => s.candidate);

  const recentlyLikedTitles = relevantHistory
    .filter((e) => e.mediaType === mediaType && e.feedback === "like")
    .map((e) => e.title);
  const aiPick = await pickWithAi(profile, context, topPool, mediaType, recentlyLikedTitles);

  const chosen = aiPick
    ? (topPool.find((c) => c.id === aiPick.id) ?? topPool[0])
    : topPool[Math.floor(Math.random() * topPool.length)];
  const alternatives = topPool.filter((c) => c.id !== chosen.id).slice(0, 3);

  const matchedGenres = matchedFavoriteGenres(profile.favoriteGenres, mediaType, chosen.genreIds);

  const learnedBoost = chosen.genreIds.some((id) => (learnedWeights.get(id) ?? 0) > 0);

  const [runtimeMinutes, watchProviders, trailerUrl] = await Promise.all([
    getRuntimeMinutes(chosen.id, mediaType).catch(() => null),
    getWatchProviders(chosen.id, mediaType).catch(() => []),
    getTrailerUrl(chosen.id, mediaType).catch(() => null),
  ]);

  const recommendation: Recommendation = {
    id: chosen.id,
    mediaType,
    title: chosen.title,
    overview: chosen.overview,
    posterUrl: chosen.posterUrl,
    year: chosen.year,
    runtimeMinutes,
    voteAverage: chosen.voteAverage,
    explanation:
      aiPick && aiPick.id === chosen.id
        ? aiPick.reason
        : buildExplanation(chosen.title, matchedGenres, context, learnedBoost),
    confidence: computeConfidence(matchedGenres.length, profile.favoriteGenres.length, chosen.voteAverage),
    genreIds: chosen.genreIds,
    watchProviders,
    trailerUrl,
    alternatives: alternatives.map((a) => ({
      id: a.id,
      mediaType,
      title: a.title,
      posterUrl: a.posterUrl,
      year: a.year,
    })),
  };

  return NextResponse.json(recommendation);
}
