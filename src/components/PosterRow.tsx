"use client";

import Image from "next/image";
import { LibraryItem } from "@/lib/useLibraryItems";

export default function PosterRow({
  title,
  items,
  onToggleFavorite,
  onOpen,
  wrap = false,
}: {
  title: string;
  items: LibraryItem[];
  onToggleFavorite: (item: LibraryItem) => void;
  onOpen: (item: LibraryItem) => void;
  wrap?: boolean;
}) {
  return (
    <div className="mt-10">
      <p className="mb-3 text-sm font-medium text-zinc-500">
        {title} <span className="text-zinc-700">· {items.length}</span>
      </p>
      <div className={`flex gap-3 ${wrap ? "flex-wrap" : "overflow-x-auto pb-1"}`}>
        {items.map((item) => (
          <div key={`${item.mediaType}-${item.id}`} className="w-24 shrink-0 text-center">
            <button className="relative block" onClick={() => onOpen(item)}>
              {item.posterUrl ? (
                <Image
                  src={item.posterUrl}
                  alt={item.title}
                  width={96}
                  height={144}
                  className="rounded-md object-cover"
                />
              ) : (
                <div className="flex h-[144px] w-[96px] items-center justify-center rounded-md bg-zinc-900 text-[10px] text-zinc-600">
                  No image
                </div>
              )}
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(item);
                }}
                aria-label={item.feedback === "like" ? "Remove favorite" : "Mark as favorite"}
                className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs transition ${
                  item.feedback === "like"
                    ? "bg-white text-black"
                    : "bg-black/60 text-white hover:bg-black/80"
                }`}
              >
                {item.feedback === "like" ? "♥" : "♡"}
              </span>
            </button>
            <p className="mt-1 truncate text-xs text-zinc-500">{item.title}</p>
            {(item.season != null || item.episode != null) && (
              <p className="truncate text-[10px] text-zinc-600">
                {item.season != null ? `S${item.season}` : ""}
                {item.season != null && item.episode != null ? " · " : ""}
                {item.episode != null ? `E${item.episode}` : ""}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
