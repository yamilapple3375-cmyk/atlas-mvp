"use client";

import { useEffect, useRef, useState } from "react";
import { addToList, createList, getListsWithMembership, ListSummary, removeFromList } from "@/lib/lists";
import { MediaType } from "@/lib/types";

export default function AddToListButton({
  item,
}: {
  item: { id: number; mediaType: MediaType; title: string };
}) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<{ list: ListSummary; memberKeys: Set<string> }[] | null>(null);
  const [newName, setNewName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && lists === null) {
      getListsWithMembership().then(setLists);
    }
  }, [open, lists]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const key = `${item.mediaType}-${item.id}`;

  async function toggle(listId: number, isMember: boolean) {
    setLists((current) =>
      current
        ? current.map((entry) => {
            if (entry.list.id !== listId) return entry;
            const nextKeys = new Set(entry.memberKeys);
            if (isMember) nextKeys.delete(key);
            else nextKeys.add(key);
            return { ...entry, memberKeys: nextKeys };
          })
        : current,
    );
    try {
      if (isMember) await removeFromList(listId, item.id, item.mediaType);
      else await addToList(listId, item);
    } catch (err) {
      console.error("Couldn't update list:", err);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      const list = await createList(name);
      await addToList(list.id, item);
      setLists((current) => [
        ...(current ?? []),
        { list: { ...list, itemCount: 1 }, memberKeys: new Set([key]) },
      ]);
      setNewName("");
    } catch (err) {
      console.error("Couldn't create list:", err);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-zinc-700 px-5 py-2.5 text-sm text-zinc-200 transition hover:border-zinc-500"
      >
        + Add to list
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-xl border border-zinc-800 bg-zinc-950 p-3 shadow-xl">
          {lists === null && <p className="text-xs text-zinc-500">Loading…</p>}
          {lists !== null && lists.length === 0 && (
            <p className="text-xs text-zinc-500">No lists yet — create one below.</p>
          )}
          {lists !== null && lists.length > 0 && (
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {lists.map(({ list, memberKeys }) => {
                const isMember = memberKeys.has(key);
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => toggle(list.id, isMember)}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-900"
                  >
                    <span className="truncate">{list.name}</span>
                    <span>{isMember ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          )}
          <form onSubmit={handleCreate} className="mt-2 flex gap-1.5 border-t border-zinc-800 pt-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New list…"
              className="flex-1 rounded-full border border-zinc-700 bg-transparent px-3 py-1 text-xs text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-black disabled:opacity-50"
            >
              +
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
