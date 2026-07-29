import { GenreKey } from "./types";

export interface GenreDef {
  key: GenreKey;
  label: string;
  movieId: number;
  tvId: number;
}

// TMDB genre IDs. Movie and TV taxonomies differ, so some genres map to the
// closest available TV category (e.g. "Horror" has no TV genre in TMDB, so it
// falls back to Mystery) rather than an exact match.
export const GENRES: GenreDef[] = [
  { key: "accion", label: "Action", movieId: 28, tvId: 10759 },
  { key: "aventura", label: "Adventure", movieId: 12, tvId: 10759 },
  { key: "animacion", label: "Animation", movieId: 16, tvId: 16 },
  { key: "comedia", label: "Comedy", movieId: 35, tvId: 35 },
  { key: "crimen", label: "Crime", movieId: 80, tvId: 80 },
  { key: "documental", label: "Documentary", movieId: 99, tvId: 99 },
  { key: "drama", label: "Drama", movieId: 18, tvId: 18 },
  { key: "familia", label: "Family", movieId: 10751, tvId: 10751 },
  { key: "fantasia", label: "Fantasy", movieId: 14, tvId: 10765 },
  { key: "terror", label: "Horror", movieId: 27, tvId: 9648 },
  { key: "misterio", label: "Mystery", movieId: 9648, tvId: 9648 },
  { key: "romance", label: "Romance", movieId: 10749, tvId: 10766 },
  { key: "scifi", label: "Science Fiction", movieId: 878, tvId: 10765 },
  { key: "thriller", label: "Thriller", movieId: 53, tvId: 9648 },
  { key: "guerra", label: "War", movieId: 10752, tvId: 10768 },
];

export function genreLabel(key: GenreKey): string {
  return GENRES.find((g) => g.key === key)?.label ?? key;
}

export function genreIds(keys: GenreKey[], mediaType: "movie" | "tv"): number[] {
  const ids = keys.map((key) => {
    const def = GENRES.find((g) => g.key === key);
    if (!def) return null;
    return mediaType === "movie" ? def.movieId : def.tvId;
  });
  return Array.from(new Set(ids.filter((id): id is number => id !== null)));
}

export function genresForItem(
  mediaType: "movie" | "tv",
  itemGenreIds: number[],
): GenreDef[] {
  return GENRES.filter((def) => {
    const id = mediaType === "movie" ? def.movieId : def.tvId;
    return itemGenreIds.includes(id);
  });
}
