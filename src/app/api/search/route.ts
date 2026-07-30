import { NextResponse } from "next/server";
import {
  discoverMovies,
  discoverTv,
  getPersonFilmography,
  searchPerson,
  searchTitles,
  SearchResultItem,
} from "@/lib/tmdb";
import { genreIds, GENRES } from "@/lib/genres";
import { GenreKey, MediaType } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const genre = searchParams.get("genre");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  if (genre) {
    if (!GENRES.some((g) => g.key === genre)) {
      return NextResponse.json({ error: "Unknown genre" }, { status: 400 });
    }
    const mediaType: MediaType = searchParams.get("mediaType") === "tv" ? "tv" : "movie";
    try {
      const ids = genreIds([genre as GenreKey], mediaType);
      const items =
        mediaType === "movie"
          ? await discoverMovies({ withGenres: ids, withoutGenres: [], page, voteCountGte: 100 })
          : await discoverTv({ withGenres: ids, withoutGenres: [], page, voteCountGte: 100 });
      const results: SearchResultItem[] = items.map((item) => ({ ...item, mediaType }));
      return NextResponse.json({ results, matchedPerson: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: `We couldn't reach TMDB: ${message}` }, { status: 502 });
    }
  }

  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  try {
    const [titleResults, person] = await Promise.all([searchTitles(q), searchPerson(q)]);

    let results: SearchResultItem[] = titleResults;
    let matchedPerson: string | null = null;

    if (person) {
      const filmography = await getPersonFilmography(person.id);
      const seenKeys = new Set(titleResults.map((r) => `${r.mediaType}-${r.id}`));
      const newFromFilmography = filmography.filter(
        (item) => !seenKeys.has(`${item.mediaType}-${item.id}`),
      );
      if (newFromFilmography.length > 0) {
        results = [...titleResults, ...newFromFilmography];
        matchedPerson = person.name;
      }
    }

    return NextResponse.json({ results, matchedPerson });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `We couldn't reach TMDB: ${message}` }, { status: 502 });
  }
}
