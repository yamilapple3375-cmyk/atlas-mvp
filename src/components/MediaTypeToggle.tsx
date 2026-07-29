"use client";

export type MediaFilter = "all" | "movie" | "tv";

const OPTIONS: { value: MediaFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "Series" },
];

export default function MediaTypeToggle({
  value,
  onChange,
}: {
  value: MediaFilter;
  onChange: (value: MediaFilter) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            value === opt.value ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
