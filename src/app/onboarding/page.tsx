"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GENRES } from "@/lib/genres";
import { saveProfile } from "@/lib/profile";
import { EntertainmentProfile, FormatPreference, GenreKey, Tone } from "@/lib/types";

const STEPS = ["favoriteGenres", "avoidGenres", "tone", "format"] as const;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [favoriteGenres, setFavoriteGenres] = useState<GenreKey[]>([]);
  const [avoidGenres, setAvoidGenres] = useState<GenreKey[]>([]);
  const [tone, setTone] = useState<Tone | null>(null);
  const [formatPreference, setFormatPreference] =
    useState<FormatPreference | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const stepKey = STEPS[step];

  const canAdvance = (() => {
    switch (stepKey) {
      case "favoriteGenres":
        return favoriteGenres.length > 0;
      case "avoidGenres":
        return true;
      case "tone":
        return tone !== null;
      case "format":
        return formatPreference !== null;
      default:
        return false;
    }
  })();

  async function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    const profile: EntertainmentProfile = {
      favoriteGenres,
      avoidGenres,
      tone: tone!,
      formatPreference: formatPreference!,
      createdAt: new Date().toISOString(),
    };
    setSaving(true);
    setSaveError(null);
    try {
      await saveProfile(profile);
      router.push("/context");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "We couldn't save your profile.");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-8 flex gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i <= step ? "bg-white" : "bg-zinc-800"
            }`}
          />
        ))}
      </div>

      {stepKey === "favoriteGenres" && (
        <QuestionBlock title="Which genres do you enjoy most?" subtitle="Pick as many as you like.">
          <GenreGrid
            selected={favoriteGenres}
            onToggle={(key) => setFavoriteGenres((list) => toggle(list, key))}
          />
        </QuestionBlock>
      )}

      {stepKey === "avoidGenres" && (
        <QuestionBlock
          title="Which genres would you rather avoid?"
          subtitle="Optional. We won't recommend these unless you change it later."
        >
          <GenreGrid
            selected={avoidGenres}
            onToggle={(key) => setAvoidGenres((list) => toggle(list, key))}
            disabled={favoriteGenres}
          />
        </QuestionBlock>
      )}

      {stepKey === "tone" && (
        <QuestionBlock title="What tone are you usually looking for?">
          <ChoiceRow
            options={[
              { value: "light", label: "Light and fun" },
              { value: "intense", label: "Intense or dark" },
            ]}
            value={tone}
            onChange={(v) => setTone(v as Tone)}
          />
        </QuestionBlock>
      )}

      {stepKey === "format" && (
        <QuestionBlock title="Movies, series, or both?">
          <ChoiceRow
            options={[
              { value: "movies", label: "Mostly movies" },
              { value: "series", label: "Mostly series" },
              { value: "both", label: "Both equally" },
            ]}
            value={formatPreference}
            onChange={(v) => setFormatPreference(v as FormatPreference)}
          />
        </QuestionBlock>
      )}

      {saveError && (
        <p className="mt-4 text-sm text-red-400">{saveError}</p>
      )}

      <div className="mt-10 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || saving}
          className="text-sm text-zinc-500 disabled:opacity-0"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!canAdvance || saving}
          className="rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {saving ? "Saving…" : step === STEPS.length - 1 ? "Finish" : "Next"}
        </button>
      </div>
    </main>
  );
}

function QuestionBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function GenreGrid({
  selected,
  onToggle,
  disabled,
}: {
  selected: GenreKey[];
  onToggle: (key: GenreKey) => void;
  disabled?: GenreKey[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {GENRES.map((genre) => {
        const isSelected = selected.includes(genre.key);
        const isDisabled = disabled?.includes(genre.key);
        return (
          <button
            key={genre.key}
            type="button"
            disabled={isDisabled}
            onClick={() => onToggle(genre.key)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              isDisabled
                ? "cursor-not-allowed border-zinc-900 text-zinc-700"
                : isSelected
                  ? "border-white bg-white text-black"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            {genre.label}
          </button>
        );
      })}
    </div>
  );
}

function ChoiceRow({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-xl border px-5 py-4 text-left text-base transition ${
            value === opt.value
              ? "border-white bg-white text-black"
              : "border-zinc-700 text-zinc-200 hover:border-zinc-500"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
