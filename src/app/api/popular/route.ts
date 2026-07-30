import { NextResponse } from "next/server";
import { getPopular } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mediaType = searchParams.get("mediaType") === "tv" ? "tv" : "movie";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  try {
    const results = await getPopular(mediaType, page);
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `We couldn't reach TMDB: ${message}` }, { status: 502 });
  }
}
