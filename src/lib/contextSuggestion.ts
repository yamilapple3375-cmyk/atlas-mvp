import { ContextInput } from "./types";

export interface ContextSuggestion {
  context: ContextInput;
  label: string;
}

/**
 * Rule-based "what's this moment probably like" guess from day-of-week and
 * time-of-day, so returning users get a one-tap starting point instead of an
 * empty form. Purely heuristic — no personal data involved.
 */
export function suggestContext(now: Date): ContextSuggestion {
  const day = now.getDay(); // 0 Sun ... 6 Sat
  const hour = now.getHours();
  const isWeekend = day === 0 || day === 6;
  const isFriday = day === 5;

  if ((isFriday || isWeekend) && hour >= 19 && hour < 23) {
    return {
      context: { company: "pareja", mood: "reir", timeBudget: "completo" },
      label: "Friday/weekend night — something fun, with time to spare",
    };
  }

  if (isWeekend && hour >= 9 && hour < 19) {
    return {
      context: { company: "familia", mood: "reir", timeBudget: "completo" },
      label: "Weekend daytime — a family pick with plenty of time",
    };
  }

  if (!isWeekend && hour >= 19 && hour < 22) {
    return {
      context: { company: "solo", mood: "relajarme", timeBudget: "tarde" },
      label: "Weeknight evening — something to unwind with, about a movie's worth of time",
    };
  }

  if (hour >= 22 || hour < 6) {
    return {
      context: { company: "solo", mood: "relajarme", timeBudget: "corto" },
      label: "Late night — a short, easy watch before bed",
    };
  }

  return {
    context: { company: "solo", mood: "pensar", timeBudget: "corto" },
    label: "Quick break — something short to fit right now",
  };
}
