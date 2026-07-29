import { NextResponse } from "next/server";
import { getPersonFilmography, searchPerson, searchTitles, SearchResultItem } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
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
