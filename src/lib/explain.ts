import { genreIds, genreLabel } from "./genres";
import { ContextInput, GenreKey, MediaType, Mood } from "./types";

export const COMPANY_PHRASE: Record<ContextInput["company"], string> = {
  solo: "by yourself",
  pareja: "with your partner",
  familia: "with family",
};

export const MOOD_PHRASE: Record<Mood, string> = {
  reir: "in the mood to laugh",
  pensar: "in the mood for something thought-provoking",
  relajarme: "in the mood to unwind",
  accion: "in the mood for action",
  intenso: "in the mood for something intense",
  llorar: "in the mood to feel something",
  miedo: "in the mood to be scared",
  romance: "in the mood for romance",
  nostalgia: "in the mood for something comforting",
};

export const TIME_PHRASE: Record<ContextInput["timeBudget"], string> = {
  corto: "not much time (15-30 min)",
  tarde: "an hour or two free",
  completo: "the whole afternoon to dive in",
};

export function matchedFavoriteGenres(
  favoriteGenres: GenreKey[],
  mediaType: MediaType,
  itemGenreIds: number[],
): GenreKey[] {
  return favoriteGenres.filter((key) => {
    const ids = genreIds([key], mediaType);
    return ids.some((id) => itemGenreIds.includes(id));
  });
}

export function buildExplanation(
  title: string,
  matchedGenres: GenreKey[],
  context: ContextInput,
  learnedBoost: boolean,
): string {
  const genrePart =
    matchedGenres.length > 0
      ? `because you like these genres: ${matchedGenres.map(genreLabel).join(", ")}`
      : "because it's one of the top picks within your profile";

  const learnedPart = learnedBoost
    ? " We also factored in what you've rated highly before."
    : "";

  return `We picked ${title} ${genrePart}. You also told us you're ${COMPANY_PHRASE[context.company]}, ${MOOD_PHRASE[context.mood]}, with ${TIME_PHRASE[context.timeBudget]}.${learnedPart}`;
}

export function computeConfidence(
  matchedCount: number,
  totalFavorites: number,
  voteAverage: number,
): number {
  const matchRatio = totalFavorites > 0 ? matchedCount / totalFavorites : 0;
  const score = 60 + matchRatio * 25 + (voteAverage >= 7 ? 10 : 0);
  return Math.max(55, Math.min(97, Math.round(score)));
}
