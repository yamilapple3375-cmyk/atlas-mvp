export type GenreKey =
  | "accion"
  | "aventura"
  | "animacion"
  | "comedia"
  | "crimen"
  | "documental"
  | "drama"
  | "familia"
  | "fantasia"
  | "terror"
  | "misterio"
  | "romance"
  | "scifi"
  | "thriller"
  | "guerra";

export type FormatPreference = "movies" | "series" | "both";
export type Tone = "light" | "intense";

export interface EntertainmentProfile {
  favoriteGenres: GenreKey[];
  avoidGenres: GenreKey[];
  tone: Tone;
  formatPreference: FormatPreference;
  createdAt: string;
}

export type Company = "solo" | "pareja" | "familia";
export type Mood =
  | "reir"
  | "pensar"
  | "relajarme"
  | "accion"
  | "intenso"
  | "llorar"
  | "miedo"
  | "romance"
  | "nostalgia";
export type TimeBudget = "corto" | "tarde" | "completo";

export interface ContextInput {
  company: Company;
  mood: Mood;
  timeBudget: TimeBudget;
}

export type MediaType = "movie" | "tv";
export type FeedbackValue = "like" | "dislike" | "seen";

export interface FeedbackEntry {
  id: number;
  mediaType: MediaType;
  title: string;
  feedback: FeedbackValue;
  genreIds: number[];
  season?: number | null;
  episode?: number | null;
  at: string;
}

export interface WatchProvider {
  name: string;
  logoUrl: string;
  fallbackRegion?: string;
}

export interface RecommendationCandidate {
  id: number;
  mediaType: MediaType;
  title: string;
  posterUrl: string | null;
  year: string | null;
}

export interface Recommendation {
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  posterUrl: string | null;
  year: string | null;
  runtimeMinutes: number | null;
  voteAverage: number;
  explanation: string;
  confidence: number;
  genreIds: number[];
  watchProviders: WatchProvider[];
  trailerUrl: string | null;
  alternatives: RecommendationCandidate[];
}
