import "server-only";

const TMDB_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

interface TmdbDiscoverItem {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
}

interface TmdbDiscoverResponse {
  results: TmdbDiscoverItem[];
}

interface TmdbDetail {
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genres?: { id: number }[];
  runtime?: number | null;
  episode_run_time?: number[];
}

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is not set in .env.local");
  return key;
}

async function tmdbGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("language", process.env.TMDB_LANGUAGE ?? "en-US");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`TMDB ${path} responded ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface DiscoverParams {
  withGenres: number[];
  withoutGenres: number[];
  page: number;
  runtimeGte?: number;
  runtimeLte?: number;
  voteCountGte?: number;
  sortBy?: string;
}

export interface DiscoverItem {
  id: number;
  title: string;
  overview: string;
  posterUrl: string | null;
  year: string | null;
  voteAverage: number;
  genreIds: number[];
}

function mapItem(item: TmdbDiscoverItem, mediaType: "movie" | "tv"): DiscoverItem {
  const date = mediaType === "movie" ? item.release_date : item.first_air_date;
  return {
    id: item.id,
    title: (mediaType === "movie" ? item.title : item.name) ?? "Untitled",
    overview: item.overview,
    posterUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null,
    year: date ? date.slice(0, 4) : null,
    voteAverage: item.vote_average,
    genreIds: item.genre_ids,
  };
}

export async function discoverMovies(params: DiscoverParams): Promise<DiscoverItem[]> {
  const data = await tmdbGet<TmdbDiscoverResponse>("/discover/movie", {
    with_genres: params.withGenres.join("|") || undefined,
    without_genres: params.withoutGenres.join(",") || undefined,
    sort_by: params.sortBy ?? "popularity.desc",
    "vote_count.gte": params.voteCountGte ?? 50,
    include_adult: false,
    page: params.page,
    "with_runtime.gte": params.runtimeGte,
    "with_runtime.lte": params.runtimeLte,
  });
  return data.results.map((item) => mapItem(item, "movie"));
}

export async function discoverTv(params: DiscoverParams): Promise<DiscoverItem[]> {
  const data = await tmdbGet<TmdbDiscoverResponse>("/discover/tv", {
    with_genres: params.withGenres.join("|") || undefined,
    without_genres: params.withoutGenres.join(",") || undefined,
    sort_by: params.sortBy ?? "popularity.desc",
    "vote_count.gte": params.voteCountGte ?? 50,
    include_adult: false,
    page: params.page,
  });
  return data.results.map((item) => mapItem(item, "tv"));
}

export async function getRuntimeMinutes(
  id: number,
  mediaType: "movie" | "tv",
): Promise<number | null> {
  const detail = await tmdbGet<TmdbDetail>(`/${mediaType}/${id}`, {});
  if (mediaType === "movie") return detail.runtime ?? null;
  return detail.episode_run_time?.[0] ?? null;
}

export async function getMediaDetails(
  id: number,
  mediaType: "movie" | "tv",
): Promise<DiscoverItem & { runtimeMinutes: number | null }> {
  const detail = await tmdbGet<TmdbDetail>(`/${mediaType}/${id}`, {});
  const date = mediaType === "movie" ? detail.release_date : detail.first_air_date;
  return {
    id,
    title: (mediaType === "movie" ? detail.title : detail.name) ?? "Untitled",
    overview: detail.overview ?? "",
    posterUrl: detail.poster_path ? `${TMDB_IMAGE_BASE}${detail.poster_path}` : null,
    year: date ? date.slice(0, 4) : null,
    voteAverage: detail.vote_average ?? 0,
    genreIds: detail.genres?.map((g) => g.id) ?? [],
    runtimeMinutes:
      mediaType === "movie" ? (detail.runtime ?? null) : (detail.episode_run_time?.[0] ?? null),
  };
}

interface TmdbWatchProviderEntry {
  provider_name: string;
  logo_path: string;
}

interface TmdbWatchProvidersResponse {
  results: Record<
    string,
    {
      flatrate?: TmdbWatchProviderEntry[];
      ads?: TmdbWatchProviderEntry[];
      free?: TmdbWatchProviderEntry[];
    }
  >;
}

export interface WatchProviderResult {
  name: string;
  logoUrl: string;
}

export async function getWatchProviders(
  id: number,
  mediaType: "movie" | "tv",
): Promise<WatchProviderResult[]> {
  const data = await tmdbGet<TmdbWatchProvidersResponse>(
    `/${mediaType}/${id}/watch/providers`,
    {},
  );
  const region = process.env.TMDB_REGION ?? "US";
  const regionData = data.results?.[region];
  const providers = regionData?.flatrate ?? regionData?.ads ?? regionData?.free ?? [];
  return providers.map((p) => ({
    name: p.provider_name,
    logoUrl: `https://image.tmdb.org/t/p/w92${p.logo_path}`,
  }));
}

interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official?: boolean;
}

interface TmdbVideosResponse {
  results: TmdbVideo[];
}

export async function getTrailerUrl(
  id: number,
  mediaType: "movie" | "tv",
): Promise<string | null> {
  const data = await tmdbGet<TmdbVideosResponse>(`/${mediaType}/${id}/videos`, {});
  const videos = data.results.filter((v) => v.site === "YouTube" && v.type === "Trailer");
  const best = videos.find((v) => v.official) ?? videos[0];
  return best ? `https://www.youtube.com/watch?v=${best.key}` : null;
}
