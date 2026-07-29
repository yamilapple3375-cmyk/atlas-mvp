"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getHistory, getProfile } from "@/lib/profile";
import { MediaType } from "@/lib/types";

interface FavoritePreview {
  id: number;
  mediaType: MediaType;
  title: string;
  posterUrl: string | null;
}

export default function Home() {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [favorites, setFavorites] = useState<FavoritePreview[]>([]);

  useEffect(() => {
    getProfile().then(async (profile) => {
      setHasProfile(profile !== null);
      if (!profile) return;

      const history = await getHistory();
      const latestByKey = new Map<string, (typeof history)[number]>();
      for (const entry of history) {
        const key = `${entry.mediaType}-${entry.id}`;
        const existing = latestByKey.get(key);
        if (!existing || new Date(entry.at) >= new Date(existing.at)) {
          latestByKey.set(key, entry);
        }
      }
      const liked = Array.from(latestByKey.values())
        .filter((e) => e.feedback === "like")
        .slice(-8)
        .reverse();
      if (liked.length === 0) return;

      try {
        const res = await fetch("/api/media/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: liked.map((e) => ({ id: e.id, mediaType: e.mediaType })),
          }),
        });
        const data = await res.json();
        const detailsByKey = new Map<string, { posterUrl: string | null }>();
        for (const d of data.results ?? []) {
          detailsByKey.set(`${d.mediaType}-${d.id}`, { posterUrl: d.posterUrl });
        }
        setFavorites(
          liked.map((e) => ({
            id: e.id,
            mediaType: e.mediaType,
            title: e.title,
            posterUrl: detailsByKey.get(`${e.mediaType}-${e.id}`)?.posterUrl ?? null,
          })),
        );
      } catch {
        // Non-critical preview — fail silently, library page still works.
      }
    });
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16 text-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Atlas</p>
        <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
          Decide less. Enjoy more.
        </h1>
        <p className="mt-6 max-w-md text-lg text-zinc-400">
          Before you open Netflix, open Atlas. We tell you what to watch based
          on your taste and the moment, in seconds.
        </p>

        <div className="mt-10">
          {hasProfile === null ? null : hasProfile ? (
            <>
              <Link
                href="/context"
                className="rounded-full bg-white px-8 py-3 text-base font-medium text-black transition hover:bg-zinc-200"
              >
                What should I watch today?
              </Link>
              <div>
                <Link
                  href="/discovery-weekly"
                  className="mt-4 inline-block text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
                >
                  ✨ This week&apos;s Discovery pick
                </Link>
              </div>
            </>
          ) : (
            <Link
              href="/onboarding"
              className="rounded-full bg-white px-8 py-3 text-base font-medium text-black transition hover:bg-zinc-200"
            >
              Get started
            </Link>
          )}
        </div>

        {hasProfile && (
          <Link
            href="/onboarding"
            className="mt-4 text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-300"
          >
            Redo my taste profile
          </Link>
        )}
      </div>

      {favorites.length > 0 && (
        <div className="w-full max-w-lg text-left">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500">Your favorites</p>
            <Link href="/library" className="text-xs text-zinc-500 underline underline-offset-4 hover:text-zinc-300">
              See all
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {favorites.map((item) => (
              <div key={`${item.mediaType}-${item.id}`} className="w-20 shrink-0 text-center">
                {item.posterUrl ? (
                  <Image
                    src={item.posterUrl}
                    alt={item.title}
                    width={80}
                    height={120}
                    className="rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-[120px] w-[80px] items-center justify-center rounded-md bg-zinc-900 text-[10px] text-zinc-600">
                    No image
                  </div>
                )}
                <p className="mt-1 truncate text-xs text-zinc-500">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
