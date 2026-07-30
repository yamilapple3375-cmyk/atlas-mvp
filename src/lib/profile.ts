import { ensureSession, supabase } from "./supabaseClient";
import {
  ContextInput,
  EntertainmentProfile,
  FeedbackEntry,
  FeedbackValue,
  MediaType,
} from "./types";

const CONTEXT_KEY = "atlas_context";

interface ProfileRow {
  favorite_genres: string[];
  avoid_genres: string[];
  tone: string;
  format_preference: string;
  created_at: string;
}

interface FeedbackRow {
  media_id: number;
  media_type: string;
  title: string;
  feedback: string;
  genre_ids: number[] | null;
  season: number | null;
  episode: number | null;
  created_at: string;
}

export async function getProfile(): Promise<EntertainmentProfile | null> {
  const userId = await ensureSession();
  const { data, error } = await supabase
    .from("entertainment_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();

  if (error || !data) return null;

  return {
    favoriteGenres: data.favorite_genres as EntertainmentProfile["favoriteGenres"],
    avoidGenres: data.avoid_genres as EntertainmentProfile["avoidGenres"],
    tone: data.tone as EntertainmentProfile["tone"],
    formatPreference: data.format_preference as EntertainmentProfile["formatPreference"],
    createdAt: data.created_at,
  };
}

export async function saveProfile(profile: EntertainmentProfile): Promise<void> {
  const userId = await ensureSession();
  const { error } = await supabase.from("entertainment_profiles").upsert({
    user_id: userId,
    favorite_genres: profile.favoriteGenres,
    avoid_genres: profile.avoidGenres,
    tone: profile.tone,
    format_preference: profile.formatPreference,
    created_at: profile.createdAt,
  });
  if (error) throw new Error(error.message);
}

export function getContext(): ContextInput | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CONTEXT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ContextInput;
  } catch {
    return null;
  }
}

export function saveContext(context: ContextInput) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
}

const RECENTLY_SHOWN_KEY = "atlas_recently_shown";
const RECENTLY_SHOWN_LIMIT = 15;

export interface RecentlyShownEntry {
  id: number;
  mediaType: MediaType;
}

/**
 * Titles shown as a recommendation in this browser recently, whether or not
 * the user gave feedback on them. Purely a short-lived anti-repeat guard —
 * separate from feedback_history, which only reflects explicit ratings.
 */
export function getRecentlyShown(): RecentlyShownEntry[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(RECENTLY_SHOWN_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RecentlyShownEntry[];
  } catch {
    return [];
  }
}

export function addRecentlyShown(entry: RecentlyShownEntry) {
  if (typeof window === "undefined") return;
  const current = getRecentlyShown().filter(
    (e) => !(e.id === entry.id && e.mediaType === entry.mediaType),
  );
  const next = [...current, entry].slice(-RECENTLY_SHOWN_LIMIT);
  window.localStorage.setItem(RECENTLY_SHOWN_KEY, JSON.stringify(next));
}

const PAGE_SIZE = 1000;

export async function getHistory(): Promise<FeedbackEntry[]> {
  const userId = await ensureSession();
  const rows: FeedbackRow[] = [];

  for (let page = 0; ; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("feedback_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .range(from, to)
      .returns<FeedbackRow[]>();

    if (error || !data) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return rows.map((row) => ({
    id: row.media_id,
    mediaType: row.media_type as MediaType,
    title: row.title,
    feedback: row.feedback as FeedbackValue,
    genreIds: row.genre_ids ?? [],
    season: row.season,
    episode: row.episode,
    at: row.created_at,
  }));
}

export async function addHistoryEntry(entry: FeedbackEntry): Promise<void> {
  const userId = await ensureSession();
  const { error } = await supabase.from("feedback_history").insert({
    user_id: userId,
    media_id: entry.id,
    media_type: entry.mediaType,
    title: entry.title,
    feedback: entry.feedback,
    genre_ids: entry.genreIds,
    season: entry.season ?? null,
    episode: entry.episode ?? null,
    created_at: entry.at,
  });
  if (error) throw new Error(error.message);
}
