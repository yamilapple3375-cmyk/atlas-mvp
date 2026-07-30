"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addHistoryEntry } from "@/lib/profile";
import { deleteList, getList, ListSummary, renameList } from "@/lib/lists";
import { FeedbackValue } from "@/lib/types";
import { LibraryItem } from "@/lib/useLibraryItems";
import { useListItems } from "@/lib/useListItems";
import PosterRow from "@/components/PosterRow";
import MediaDetailModal, { ItemDetail } from "@/components/MediaDetailModal";

export default function ListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listId = Number(params.id);

  const [list, setList] = useState<ListSummary | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const { items, setItems, error, reload } = useListItems(listId);

  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    getList(listId).then((l) => {
      if (!l) {
        router.replace("/lists");
        return;
      }
      setList(l);
      setNameDraft(l.name);
    });
  }, [listId, router]);

  async function toggleFavorite(item: LibraryItem) {
    const nextFeedback: FeedbackValue = item.feedback === "like" ? "seen" : "like";
    setItems((current) =>
      current
        ? current.map((i) =>
            i.id === item.id && i.mediaType === item.mediaType
              ? { ...i, feedback: nextFeedback }
              : i,
          )
        : current,
    );
    setSelectedItem((s) => (s && s.id === item.id ? { ...s, feedback: nextFeedback } : s));
    try {
      await addHistoryEntry({
        id: item.id,
        mediaType: item.mediaType,
        title: item.title,
        feedback: nextFeedback,
        genreIds: item.genreIds,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Couldn't update favorite:", err);
    }
  }

  async function openDetail(item: LibraryItem) {
    setSelectedItem(item);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/media/${item.mediaType}/${item.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "We couldn't load this title.");
      setDetail(data as ItemDetail);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "We couldn't load this title.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedItem(null);
    setDetail(null);
    setDetailError(null);
    // membership may have changed via the "Add to list" picker inside the modal
    reload();
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const name = nameDraft.trim();
    if (!name || !list) return;
    try {
      await renameList(list.id, name);
      setList({ ...list, name });
      setRenaming(false);
    } catch (err) {
      console.error("Couldn't rename list:", err);
    }
  }

  async function handleDelete() {
    if (!list) return;
    try {
      await deleteList(list.id);
      router.push("/lists");
    } catch (err) {
      console.error("Couldn't delete list:", err);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <Link href="/lists" className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-300">
        ← All lists
      </Link>

      {renaming ? (
        <form onSubmit={handleRename} className="mt-4 flex gap-2">
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            autoFocus
            className="flex-1 rounded-full border border-zinc-700 bg-transparent px-4 py-2 text-lg text-white focus:border-zinc-500 focus:outline-none"
          />
          <button type="submit" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
            Save
          </button>
        </form>
      ) : (
        <div className="mt-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{list?.name ?? "…"}</h1>
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <button onClick={() => setRenaming(true)} className="underline underline-offset-4 hover:text-zinc-300">
              Rename
            </button>
            <button onClick={handleDelete} className="underline underline-offset-4 hover:text-zinc-300">
              Delete
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-6 text-sm text-zinc-300">{error}</p>}

      {items === null && !error && (
        <p className="mt-10 text-center text-sm text-zinc-500">Loading…</p>
      )}

      {items !== null && items.length === 0 && (
        <p className="mt-10 text-center text-sm text-zinc-500">
          Nothing here yet. Open any title (from Search, Library, or a recommendation) and use
          &quot;+ Add to list&quot; to bring it in.
        </p>
      )}

      {items !== null && items.length > 0 && (
        <PosterRow title={list?.name ?? "Titles"} items={items} onToggleFavorite={toggleFavorite} onOpen={openDetail} wrap />
      )}

      {selectedItem && (
        <MediaDetailModal
          item={selectedItem}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
          onToggleFavorite={toggleFavorite}
        />
      )}
    </main>
  );
}
