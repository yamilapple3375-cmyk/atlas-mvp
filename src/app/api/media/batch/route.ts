import { NextResponse } from "next/server";
import { getMediaDetails } from "@/lib/tmdb";
import { MediaType } from "@/lib/types";

interface BatchItem {
  id: number;
  mediaType: MediaType;
}

interface BatchRequestBody {
  items: BatchItem[];
}

export async function POST(request: Request) {
  let body: BatchRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = body.items ?? [];
  const results = await Promise.all(
    items.map(async (item) => {
      try {
        const details = await getMediaDetails(item.id, item.mediaType);
        return { ...details, mediaType: item.mediaType };
      } catch {
        return null;
      }
    }),
  );

  return NextResponse.json({ results: results.filter((r) => r !== null) });
}
