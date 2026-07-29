"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProfile } from "@/lib/profile";

export default function Home() {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    getProfile().then((profile) => setHasProfile(profile !== null));
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
        Atlas
      </p>
      <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
        Decide less. Enjoy more.
      </h1>
      <p className="mt-6 max-w-md text-lg text-zinc-400">
        Before you open Netflix, open Atlas. We tell you what to watch based
        on your taste and the moment, in seconds.
      </p>

      <div className="mt-10">
        {hasProfile === null ? null : hasProfile ? (
          <Link
            href="/context"
            className="rounded-full bg-white px-8 py-3 text-base font-medium text-black transition hover:bg-zinc-200"
          >
            What should I watch today?
          </Link>
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
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-zinc-500">
          <Link href="/library" className="underline underline-offset-4 hover:text-zinc-300">
            My Library
          </Link>
          <Link href="/account" className="underline underline-offset-4 hover:text-zinc-300">
            Save my library
          </Link>
          <Link href="/onboarding" className="underline underline-offset-4 hover:text-zinc-300">
            Redo my taste profile
          </Link>
        </div>
      )}
    </main>
  );
}
