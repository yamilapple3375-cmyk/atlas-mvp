import { NextResponse } from "next/server";
import { getMediaDetails, getWatchProviders, getTrailerUrl } from "@/lib/tmdb";
import { MediaType } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaType: string; id: string }> },
) {
  const { mediaType: rawMediaType, id: rawId } = await params;
  const mediaType = rawMediaType as MediaType;
  const id = Number(rawId);

  if ((mediaType !== "movie" && mediaType !== "tv") || Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  try {
    const [details, watchProviders, trailerUrl] = await Promise.all([
      getMediaDetails(id, mediaType),
      getWatchProviders(id, mediaType).catch(() => []),
      getTrailerUrl(id, mediaType).catch(() => null),
    ]);
    return NextResponse.json({ ...details, mediaType, watchProviders, trailerUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `We couldn't reach TMDB: ${message}` }, { status: 502 });
  }
}
