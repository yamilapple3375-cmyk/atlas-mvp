"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getContext, getProfile, saveContext } from "@/lib/profile";
import { ContextSuggestion, suggestContext } from "@/lib/contextSuggestion";
import { Company, ContextInput, Mood, TimeBudget } from "@/lib/types";

const COMPANY_OPTIONS: { value: Company; label: string }[] = [
  { value: "solo", label: "By myself" },
  { value: "pareja", label: "With my partner" },
  { value: "familia", label: "With family" },
];

const MOOD_OPTIONS: { value: Mood; label: string }[] = [
  { value: "reir", label: "I want to laugh" },
  { value: "pensar", label: "I want to think" },
  { value: "relajarme", label: "I want to unwind" },
  { value: "accion", label: "I want action" },
  { value: "intenso", label: "I want something intense" },
];

const TIME_OPTIONS: { value: TimeBudget; label: string; hint: string }[] = [
  { value: "corto", label: "15–30 min", hint: "a quick episode" },
  { value: "tarde", label: "1–2 hours", hint: "a movie" },
  { value: "completo", label: "The whole afternoon", hint: "time to binge" },
];

export default function ContextPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [timeBudget, setTimeBudget] = useState<TimeBudget | null>(null);
  const [suggestion, setSuggestion] = useState<ContextSuggestion | null>(null);

  useEffect(() => {
    getProfile().then((profile) => {
      if (profile === null) {
        router.replace("/onboarding");
        return;
      }
      const lastContext = getContext();
      if (lastContext) {
        setCompany(lastContext.company);
        setMood(lastContext.mood);
        setTimeBudget(lastContext.timeBudget);
      }
      setSuggestion(suggestContext(new Date()));
      setReady(true);
    });
  }, [router]);

  function applySuggestion() {
    if (!suggestion) return;
    setCompany(suggestion.context.company);
    setMood(suggestion.context.mood);
    setTimeBudget(suggestion.context.timeBudget);
  }

  if (!ready) return null;

  const canSubmit = company !== null && mood !== null && timeBudget !== null;

  function handleSubmit() {
    const context: ContextInput = {
      company: company!,
      mood: mood!,
      timeBudget: timeBudget!,
    };
    saveContext(context);
    router.push("/recommendation");
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold">What&apos;s this moment like?</h1>
      <p className="mt-1 text-sm text-zinc-500">
        This helps us tailor the recommendation to right now, not just your general taste.
      </p>

      {suggestion && (
        <button
          type="button"
          onClick={applySuggestion}
          className="mt-6 flex items-center gap-2 rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-zinc-500"
        >
          <span aria-hidden>💡</span>
          <span>
            <span className="text-zinc-500">Suggested for now: </span>
            {suggestion.label}
          </span>
        </button>
      )}

      <div className="mt-8">
        <p className="mb-3 text-sm font-medium text-zinc-400">Company</p>
        <div className="flex flex-wrap gap-2">
          {COMPANY_OPTIONS.map((opt) => (
            <Pill
              key={opt.value}
              active={company === opt.value}
              onClick={() => setCompany(opt.value)}
            >
              {opt.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-medium text-zinc-400">Mood</p>
        <div className="flex flex-wrap gap-2">
          {MOOD_OPTIONS.map((opt) => (
            <Pill
              key={opt.value}
              active={mood === opt.value}
              onClick={() => setMood(opt.value)}
            >
              {opt.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-medium text-zinc-400">
          Time available
        </p>
        <div className="flex flex-col gap-3">
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTimeBudget(opt.value)}
              className={`flex items-center justify-between rounded-xl border px-5 py-4 text-left transition ${
                timeBudget === opt.value
                  ? "border-white bg-white text-black"
                  : "border-zinc-700 text-zinc-200 hover:border-zinc-500"
              }`}
            >
              <span className="font-medium">{opt.label}</span>
              <span
                className={`text-sm ${
                  timeBudget === opt.value ? "text-zinc-600" : "text-zinc-500"
                }`}
              >
                {opt.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-10 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        Tell me what to watch
      </button>
    </main>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition ${
        active
          ? "border-white bg-white text-black"
          : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}
