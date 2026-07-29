// One-time import: reads scripts/notion-library.json (exported from the user's
// Notion "Biblioteca" database) and inserts each title into Supabase
// feedback_history as the currently active anonymous user, after resolving
// each title to a real TMDB id + genre_ids via search.
//
// Usage:
//   SUPABASE_REFRESH_TOKEN=xxxx node scripts/import-notion-library.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const raw = readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

const env = loadEnvLocal();
const TMDB_API_KEY = env.TMDB_API_KEY;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const REFRESH_TOKEN = process.env.SUPABASE_REFRESH_TOKEN;

if (!TMDB_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing TMDB_API_KEY / Supabase env vars in .env.local");
  process.exit(1);
}
if (!REFRESH_TOKEN) {
  console.error("Set SUPABASE_REFRESH_TOKEN env var to the active session's refresh token.");
  process.exit(1);
}

async function getAccessToken() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ refresh_token: REFRESH_TOKEN }),
  });
  if (!res.ok) throw new Error(`Failed to refresh session: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { accessToken: data.access_token, userId: data.user.id };
}

async function searchTmdb(title, mediaType, year) {
  const endpoint = mediaType === "movie" ? "/search/movie" : "/search/tv";
  const yearParam = mediaType === "movie" ? "year" : "first_air_date_year";

  async function run(withYear) {
    const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
    url.searchParams.set("api_key", TMDB_API_KEY);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("query", title);
    if (withYear && year) url.searchParams.set(yearParam, String(year));
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0] ?? null;
  }

  return (await run(true)) ?? (await run(false));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const entries = JSON.parse(readFileSync(path.join(__dirname, "notion-library.json"), "utf-8"));
  const { accessToken, userId } = await getAccessToken();
  console.log(`Authenticated as user ${userId}. Importing ${entries.length} entries...`);

  const matched = [];
  const unmatched = [];

  const batches = chunk(entries, 5);
  for (const batch of batches) {
    const results = await Promise.all(
      batch.map(async (entry) => {
        try {
          const result = await searchTmdb(entry.title, entry.type, entry.year);
          if (!result) return { entry, result: null };
          return { entry, result };
        } catch (err) {
          return { entry, result: null, error: err.message };
        }
      }),
    );
    for (const r of results) {
      if (r.result) {
        matched.push({
          user_id: userId,
          media_id: r.result.id,
          media_type: r.entry.type,
          title: r.entry.title,
          feedback: "seen",
          genre_ids: r.result.genre_ids ?? [],
          created_at: new Date().toISOString(),
        });
      } else {
        unmatched.push(r.entry.title);
      }
    }
  }

  console.log(`Matched ${matched.length} / ${entries.length}. Inserting into Supabase...`);

  const insertBatches = chunk(matched, 50);
  let inserted = 0;
  for (const batch of insertBatches) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback_history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error(`Insert batch failed: ${res.status} ${await res.text()}`);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`\nDone. Inserted ${inserted} rows.`);
  if (unmatched.length > 0) {
    console.log(`\nCould not match ${unmatched.length} titles on TMDB:`);
    for (const title of unmatched) console.log(`  - ${title}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
