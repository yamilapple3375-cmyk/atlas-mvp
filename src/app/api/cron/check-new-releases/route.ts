import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/resend";
import { getMovieCollection, getCollectionMovies, getTvSeasonInfo } from "@/lib/tmdb";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface FeedbackRow {
  user_id: string;
  media_id: number;
  media_type: string;
  feedback: string;
  title: string;
}

interface NotifiedRow {
  id: number;
  user_id: string;
  media_id: number;
  media_type: string;
  kind: string;
  detail: string;
}

interface Finding {
  html: string;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const PAGE_SIZE = 1000;

  async function fetchAll<T>(table: string, select: string): Promise<T[]> {
    const rows: T[] = [];
    for (let page = 0; ; page++) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await admin.from(table).select(select).range(from, to).returns<T[]>();
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return rows;
  }

  let allFeedback: FeedbackRow[];
  let notified: NotifiedRow[];
  try {
    allFeedback = await fetchAll<FeedbackRow>(
      "feedback_history",
      "user_id, media_id, media_type, feedback, title",
    );
    notified = await fetchAll<NotifiedRow>("notified_releases", "*");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }

  const byUser = new Map<string, FeedbackRow[]>();
  for (const row of allFeedback ?? []) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const baselineRows = new Map<string, NotifiedRow>();
  const sequelNotified = new Set<string>();
  for (const row of notified ?? []) {
    const key = `${row.user_id}-${row.media_type}-${row.media_id}`;
    if (row.kind === "season_baseline") baselineRows.set(key, row);
    if (row.kind === "sequel") sequelNotified.add(key);
  }

  let usersChecked = 0;
  let emailsSent = 0;
  const errors: string[] = [];

  for (const [userId, history] of byUser) {
    usersChecked++;
    const knownKeys = new Set(history.map((h) => `${h.media_type}-${h.media_id}`));
    const liked = history.filter((h) => h.feedback === "like");
    const likedMovies = liked.filter((h) => h.media_type === "movie");
    const likedShows = liked.filter((h) => h.media_type === "tv");

    const findings: Finding[] = [];
    const newSequelRows: { media_id: number; media_type: string; detail: string }[] = [];
    const baselineUpdates: { id: number; detail: string }[] = [];
    const baselineInserts: { media_id: number; media_type: string; detail: string }[] = [];

    await Promise.all(
      likedMovies.map(async (movie) => {
        try {
          const collection = await getMovieCollection(movie.media_id);
          if (!collection) return;
          const parts = await getCollectionMovies(collection.id);
          for (const part of parts) {
            if (part.id === movie.media_id) continue;
            if (knownKeys.has(`movie-${part.id}`)) continue;
            const key = `${userId}-movie-${part.id}`;
            if (sequelNotified.has(key)) continue;
            if (!part.releaseDate) continue;
            findings.push({
              html: `<li><strong>${part.title}</strong> — a new entry in the ${collection.name} collection you liked (${movie.title}).</li>`,
            });
            newSequelRows.push({ media_id: part.id, media_type: "movie", detail: part.title });
          }
        } catch (err) {
          errors.push(`movie ${movie.media_id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
    );

    await Promise.all(
      likedShows.map(async (show) => {
        try {
          const info = await getTvSeasonInfo(show.media_id);
          const key = `${userId}-tv-${show.media_id}`;
          const existing = baselineRows.get(key);
          if (!existing) {
            baselineInserts.push({
              media_id: show.media_id,
              media_type: "tv",
              detail: String(info.numberOfSeasons),
            });
            return;
          }
          const lastKnown = Number(existing.detail) || 0;
          if (info.numberOfSeasons > lastKnown) {
            findings.push({
              html: `<li><strong>${info.name}</strong> — Season ${info.numberOfSeasons} is out.</li>`,
            });
            baselineUpdates.push({ id: existing.id, detail: String(info.numberOfSeasons) });
          }
        } catch (err) {
          errors.push(`tv ${show.media_id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
    );

    if (findings.length > 0) {
      const { data: userData } = await admin.auth.admin.getUserById(userId);
      const email = userData?.user?.email;
      if (email) {
        try {
          await sendEmail(
            email,
            "New on Atlas — sequels and seasons you might have missed",
            `<p>Based on what you've liked, here's what's new:</p><ul>${findings.map((f) => f.html).join("")}</ul><p>— Atlas</p>`,
          );
          emailsSent++;
        } catch (err) {
          errors.push(`email ${userId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    if (newSequelRows.length > 0) {
      await admin
        .from("notified_releases")
        .insert(newSequelRows.map((r) => ({ user_id: userId, kind: "sequel", ...r })));
    }
    if (baselineInserts.length > 0) {
      await admin
        .from("notified_releases")
        .insert(baselineInserts.map((r) => ({ user_id: userId, kind: "season_baseline", ...r })));
    }
    for (const update of baselineUpdates) {
      await admin.from("notified_releases").update({ detail: update.detail }).eq("id", update.id);
    }
  }

  return NextResponse.json({ ok: true, usersChecked, emailsSent, errors });
}
