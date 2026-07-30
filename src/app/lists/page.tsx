"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createList, getLists, ListSummary } from "@/lib/lists";

export default function ListsPage() {
  const [lists, setLists] = useState<ListSummary[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLists().then(setLists);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const list = await createList(name);
      setLists((current) => [...(current ?? []), list]);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't create that list.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <h1 className="text-2xl font-semibold">My Lists</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Your own collections — a top 10, a mood-based pick list, whatever you want.
      </p>

      <form onSubmit={handleCreate} className="mt-6 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New list name…"
          className="flex-1 rounded-full border border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-zinc-300">{error}</p>}

      {lists === null && (
        <p className="mt-10 text-center text-sm text-zinc-500">Loading your lists…</p>
      )}

      {lists !== null && lists.length === 0 && (
        <p className="mt-10 text-center text-sm text-zinc-500">
          No lists yet — create one above to start organizing your own collections.
        </p>
      )}

      {lists !== null && lists.length > 0 && (
        <div className="mt-8 flex flex-col gap-3">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/lists/${list.id}`}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4 transition hover:border-zinc-600"
            >
              <span className="font-medium">{list.name}</span>
              <span className="text-sm text-zinc-500">
                {list.itemCount} {list.itemCount === 1 ? "title" : "titles"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
