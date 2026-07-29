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
  pacing: string;
  tone: string;
  endings: string;
  format_preference: string;
  created_at: string;
}

interface FeedbackRow {
  media_id: number;
  media_type: string;
  title: string;
  feedback: string;
  genre_ids: number[] | null;
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
    pacing: data.pacing as EntertainmentProfile["pacing"],
    tone: data.tone as EntertainmentProfile["tone"],
    endings: data.endings as EntertainmentProfile["endings"],
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
    pacing: profile.pacing,
    tone: profile.tone,
    endings: profile.endings,
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

export async function getHistory(): Promise<FeedbackEntry[]> {
  const userId = await ensureSession();
  const { data, error } = await supabase
    .from("feedback_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<FeedbackRow[]>();

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.media_id,
    mediaType: row.media_type as MediaType,
    title: row.title,
    feedback: row.feedback as FeedbackValue,
    genreIds: row.genre_ids ?? [],
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
    created_at: entry.at,
  });
  if (error) throw new Error(error.message);
}
