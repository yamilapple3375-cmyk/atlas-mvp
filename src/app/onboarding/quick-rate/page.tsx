"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addHistoryEntry, getProfile } from "@/lib/profile";
import { MediaType } from "@/lib/types";

interface QuickItem {
  id: number;
  mediaType: MediaType;
  title: string;
  posterUrl: string | null;
  genreIds: number[];
}

export default function QuickRatePage() {
  const router = useRouter();
  const [items, setItems] = useState<QuickItem[] | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then(async (profile) => {
      if (!profile) {
        router.replace("/onboarding");
        return;
      }

      try {
        const wantMovies = profile.formatPreference !== "series";
        const wantSeries = profile.formatPreference !== "movies";

        const requests: Promise<Response>[] = [];
        if (wantMovies) requests.push(fetch("/api/popular?mediaType=movie&page=1"));
        if (wantSeries) requests.push(fetch("/api/popular?mediaType=tv&page=1"));
        if (wantMovies && wantSeries) {
          // both: pull a second movie page too so the mix has real breadth
          requests.push(fetch("/api/popular?mediaType=movie&page=2"));
        } else {
          requests.push(fetch(`/api/popular?mediaType=${wantMovies ? "movie" : "tv"}&page=2`));
        }

        const responses = await Promise.all(requests);
        const bodies = await Promise.all(responses.map((r) => r.json()));
        const merged: QuickItem[] = bodies.flatMap((b) => b.results ?? []);

        const seen = new Set<string>();
        const deduped = merged.filter((item) => {
          const key = `${item.mediaType}-${item.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setItems(deduped);
      } catch {
        setError("We couldn't load titles right now.");
      }
    });
  }, [router]);

  async function toggle(item: QuickItem) {
    const key = `${item.mediaType}-${item.id}`;
    const isLiked = liked.has(key);
    setLiked((current) => {
      const next = new Set(current);
      if (isLiked) next.delete(key);
      else next.add(key);
      return next;
    });
    try {
      await addHistoryEntry({
        id: item.id,
        mediaType: item.mediaType,
        title: item.title,
        feedback: isLiked ? "seen" : "like",
        genreIds: item.genreIds,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Couldn't save quick rating:", err);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <h1 className="text-2xl font-semibold">Quick taste check</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Tap anything you&apos;ve watched and loved. Takes a minute, and it makes your first
        recommendations way better.
      </p>

      {error && <p className="mt-6 text-sm text-zinc-300">{error}</p>}

      {items === null && !error && (
        <p className="mt-10 text-center text-sm text-zinc-500">Loading titles…</p>
      )}

      {items !== null && (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((item) => {
            const key = `${item.mediaType}-${item.id}`;
            const isLiked = liked.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(item)}
                className="relative text-center"
              >
                {item.posterUrl ? (
                  <Image
                    src={item.posterUrl}
                    alt={item.title}
                    width={150}
                    height={225}
                    className={`w-full rounded-lg object-cover transition ${
                      isLiked ? "opacity-100 ring-2 ring-white" : "opacity-80 hover:opacity-100"
                    }`}
                  />
                ) : (
                  <div className="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-zinc-900 text-[10px] text-zinc-600">
                    No image
                  </div>
                )}
                <span
                  className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isLiked ? "bg-white text-black" : "bg-black/60 text-white"
                  }`}
                >
                  {isLiked ? "♥" : "♡"}
                </span>
                <p className="mt-1 truncate text-xs text-zinc-500">{item.title}</p>
              </button>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-20 mt-8 flex items-center justify-between gap-3 rounded-full border border-zinc-800 bg-black/90 px-5 py-3 backdrop-blur">
        <span className="text-sm text-zinc-400">{liked.size} liked</span>
        <button
          onClick={() => router.push("/context")}
          className="rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
        >
          Continue
        </button>
      </div>
    </main>
  );
}
