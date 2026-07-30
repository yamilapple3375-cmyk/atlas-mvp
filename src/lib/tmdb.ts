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

interface TmdbSearchItem extends TmdbDiscoverItem {
  media_type?: string;
}

interface TmdbSearchResponse {
  results: TmdbSearchItem[];
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
  /** "or" (default) matches any listed genre; "and" requires all of them. */
  genreMode?: "or" | "and";
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
    with_genres: params.withGenres.join(params.genreMode === "and" ? "," : "|") || undefined,
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
    with_genres: params.withGenres.join(params.genreMode === "and" ? "," : "|") || undefined,
    without_genres: params.withoutGenres.join(",") || undefined,
    sort_by: params.sortBy ?? "popularity.desc",
    "vote_count.gte": params.voteCountGte ?? 50,
    include_adult: false,
    page: params.page,
  });
  return data.results.map((item) => mapItem(item, "tv"));
}

export interface SearchResultItem extends DiscoverItem {
  mediaType: "movie" | "tv";
}

/** Pure popularity ranking, no genre filter — maximizes odds of a new user recognizing the title. */
export async function getPopular(
  mediaType: "movie" | "tv",
  page: number,
): Promise<SearchResultItem[]> {
  const data = await tmdbGet<TmdbDiscoverResponse>(`/${mediaType}/popular`, { page });
  return data.results.map((item) => ({ ...mapItem(item, mediaType), mediaType }));
}

export async function searchTitles(query: string): Promise<SearchResultItem[]> {
  const data = await tmdbGet<TmdbSearchResponse>("/search/multi", {
    query,
    include_adult: false,
    page: 1,
  });
  return data.results
    .filter(
      (item): item is TmdbSearchItem & { media_type: "movie" | "tv" } =>
        item.media_type === "movie" || item.media_type === "tv",
    )
    .map((item) => ({
      ...mapItem(item, item.media_type),
      mediaType: item.media_type,
    }));
}

interface TmdbPersonSearchItem {
  id: number;
  name: string;
  known_for_department?: string;
  popularity: number;
}

interface TmdbPersonSearchResponse {
  results: TmdbPersonSearchItem[];
}

export interface PersonMatch {
  id: number;
  name: string;
}

export async function searchPerson(query: string): Promise<PersonMatch | null> {
  const data = await tmdbGet<TmdbPersonSearchResponse>("/search/person", {
    query,
    include_adult: false,
    page: 1,
  });
  const best = data.results.sort((a, b) => b.popularity - a.popularity)[0];
  return best ? { id: best.id, name: best.name } : null;
}

interface TmdbCreditItem extends TmdbDiscoverItem {
  media_type?: string;
  job?: string;
}

interface TmdbCombinedCreditsResponse {
  cast: TmdbCreditItem[];
  crew: TmdbCreditItem[];
}

export async function getPersonFilmography(personId: number): Promise<SearchResultItem[]> {
  const data = await tmdbGet<TmdbCombinedCreditsResponse>(
    `/person/${personId}/combined_credits`,
    {},
  );
  const directed = data.crew.filter((c) => c.job === "Director");
  const combined = [...data.cast, ...directed]
    .filter(
      (item): item is TmdbCreditItem & { media_type: "movie" | "tv" } =>
        item.media_type === "movie" || item.media_type === "tv",
    )
    .sort((a, b) => b.vote_count - a.vote_count);

  const byKey = new Map<string, SearchResultItem>();
  for (const item of combined) {
    const key = `${item.media_type}-${item.id}`;
    if (byKey.has(key)) continue;
    byKey.set(key, { ...mapItem(item, item.media_type), mediaType: item.media_type });
  }

  return Array.from(byKey.values()).filter((item) => item.posterUrl !== null);
}

interface TmdbCollectionRef {
  id: number;
  name: string;
}

interface TmdbMovieDetailRaw {
  belongs_to_collection: TmdbCollectionRef | null;
}

export async function getMovieCollection(movieId: number): Promise<TmdbCollectionRef | null> {
  const detail = await tmdbGet<TmdbMovieDetailRaw>(`/movie/${movieId}`, {});
  return detail.belongs_to_collection ?? null;
}

interface TmdbCollectionPart {
  id: number;
  title: string;
  release_date?: string;
  poster_path: string | null;
}

interface TmdbCollectionResponse {
  parts: TmdbCollectionPart[];
}

export interface CollectionMovie {
  id: number;
  title: string;
  releaseDate: string | null;
  posterUrl: string | null;
}

export async function getCollectionMovies(collectionId: number): Promise<CollectionMovie[]> {
  const data = await tmdbGet<TmdbCollectionResponse>(`/collection/${collectionId}`, {});
  return data.parts.map((p) => ({
    id: p.id,
    title: p.title,
    releaseDate: p.release_date ?? null,
    posterUrl: p.poster_path ? `${TMDB_IMAGE_BASE}${p.poster_path}` : null,
  }));
}

interface TmdbTvDetailRaw {
  number_of_seasons: number;
  status: string;
  name: string;
}

export interface TvSeasonInfo {
  numberOfSeasons: number;
  status: string;
  name: string;
}

export async function getTvSeasonInfo(tvId: number): Promise<TvSeasonInfo> {
  const detail = await tmdbGet<TmdbTvDetailRaw>(`/tv/${tvId}`, {});
  return {
    numberOfSeasons: detail.number_of_seasons,
    status: detail.status,
    name: detail.name,
  };
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
  fallbackRegion?: string;
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
  if (providers.length > 0) {
    return providers.map((p) => ({
      name: p.provider_name,
      logoUrl: `https://image.tmdb.org/t/p/w92${p.logo_path}`,
    }));
  }

  // TMDB's regional streaming coverage (via JustWatch) is much sparser
  // outside the US, especially for less mainstream titles. Fall back to US
  // availability rather than showing nothing, but mark it so the UI can be
  // upfront that it may not apply locally.
  if (region === "US") return [];
  const usData = data.results?.US;
  const usProviders = usData?.flatrate ?? usData?.ads ?? usData?.free ?? [];
  return usProviders.map((p) => ({
    name: p.provider_name,
    logoUrl: `https://image.tmdb.org/t/p/w92${p.logo_path}`,
    fallbackRegion: "US",
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
