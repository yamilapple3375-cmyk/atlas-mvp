import { NextResponse } from "next/server";
import { genreIds } from "@/lib/genres";
import { discoverMovies, discoverTv, getRuntimeMinutes, getWatchProviders, DiscoverItem } from "@/lib/tmdb";
import { matchedFavoriteGenres, computeConfidence } from "@/lib/explain";
import { getISOWeekKey, hashStringToInt, mulberry32 } from "@/lib/seededRandom";
import { EntertainmentProfile, FeedbackEntry, MediaType, Recommendation } from "@/lib/types";

interface DiscoveryWeeklyRequestBody {
  profile: EntertainmentProfile;
  history: FeedbackEntry[];
}

function pickMediaType(profile: EntertainmentProfile, weekKey: string): MediaType {
  if (profile.formatPreference === "movies") return "movie";
  if (profile.formatPreference === "series") return "tv";
  const weekNumber = Number(weekKey.split("-W")[1] ?? "0");
  return weekNumber % 2 === 0 ? "movie" : "tv";
}

export async function POST(request: Request) {
  let body: DiscoveryWeeklyRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { profile, history } = body;
  if (!profile) {
    return NextResponse.json({ error: "Missing profile" }, { status: 400 });
  }

  const weekKey = getISOWeekKey(new Date());
  const mediaType = pickMediaType(profile, weekKey);
  const seed = hashStringToInt(`${profile.favoriteGenres.slice().sort().join(",")}|${weekKey}|${mediaType}`);
  const rng = mulberry32(seed);

  const excludeIds = new Set((history ?? []).filter((e) => e.mediaType === mediaType).map((e) => e.id));
  const withGenres = genreIds(profile.favoriteGenres, mediaType);
  const withoutGenres = genreIds(profile.avoidGenres, mediaType);

  let candidates: DiscoverItem[] = [];
  try {
    const params = {
      withGenres,
      withoutGenres,
      page: 1,
      voteCountGte: 300,
      sortBy: "vote_average.desc",
    };
    candidates =
      mediaType === "movie" ? await discoverMovies(params) : await discoverTv(params);
    candidates = candidates.filter((c) => !excludeIds.has(c.id));

    if (candidates.length === 0) {
      // Fallback: drop the genre filter, keep the quality bar.
      const fallbackParams = { withGenres: [], withoutGenres, page: 1, voteCountGte: 300, sortBy: "vote_average.desc" };
      candidates =
        mediaType === "movie" ? await discoverMovies(fallbackParams) : await discoverTv(fallbackParams);
      candidates = candidates.filter((c) => !excludeIds.has(c.id));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `We couldn't reach TMDB: ${message}` }, { status: 502 });
  }

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No new discovery pick available this week. Try again later." },
      { status: 404 },
    );
  }

  const pool = candidates.slice(0, 10);
  const chosen = pool[Math.floor(rng() * pool.length)];
  const alternatives = pool.filter((c) => c.id !== chosen.id).slice(0, 3);
  const matchedGenres = matchedFavoriteGenres(profile.favoriteGenres, mediaType, chosen.genreIds);

  const [runtimeMinutes, watchProviders] = await Promise.all([
    getRuntimeMinutes(chosen.id, mediaType).catch(() => null),
    getWatchProviders(chosen.id, mediaType).catch(() => []),
  ]);

  const recommendation: Recommendation & { weekKey: string } = {
    id: chosen.id,
    mediaType,
    title: chosen.title,
    overview: chosen.overview,
    posterUrl: chosen.posterUrl,
    year: chosen.year,
    runtimeMinutes,
    voteAverage: chosen.voteAverage,
    explanation: `Your Discovery of the Week: a highly-rated pick from your favorite genres that you haven't rated yet. Refreshes every Monday.`,
    confidence: computeConfidence(matchedGenres.length, profile.favoriteGenres.length, chosen.voteAverage),
    genreIds: chosen.genreIds,
    watchProviders,
    alternatives: alternatives.map((a) => ({ id: a.id, mediaType, title: a.title, posterUrl: a.posterUrl, year: a.year })),
    weekKey,
  };

  return NextResponse.json(recommendation);
}
