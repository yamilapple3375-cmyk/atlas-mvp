import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { genreLabel, genresForItem } from "./genres";
import { DiscoverItem } from "./tmdb";
import { ContextInput, EntertainmentProfile, MediaType } from "./types";

const MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

const COMPANY_PHRASE: Record<ContextInput["company"], string> = {
  solo: "by themselves",
  pareja: "with their partner",
  familia: "with family",
};

const TIME_PHRASE: Record<ContextInput["timeBudget"], string> = {
  corto: "only 15-30 minutes",
  tarde: "an hour or two",
  completo: "the whole afternoon free",
};

export interface AiPick {
  id: number;
  reason: string;
}

export async function pickWithAi(
  profile: EntertainmentProfile,
  context: ContextInput,
  candidates: DiscoverItem[],
  mediaType: MediaType,
  recentlyLikedTitles: string[],
): Promise<AiPick | null> {
  const anthropic = getClient();
  if (!anthropic || candidates.length === 0) return null;

  const candidateLines = candidates
    .map((c) => {
      const genres = genresForItem(mediaType, c.genreIds)
        .map((g) => g.label)
        .join(", ");
      return `id=${c.id} | "${c.title}" (${c.year ?? "?"}) | genres: ${genres || "unknown"} | rating ${c.voteAverage.toFixed(1)}/10 | ${c.overview.slice(0, 220)}`;
    })
    .join("\n");

  const prompt = `You are picking a ${mediaType === "movie" ? "movie" : "TV show"} for a real person to watch right now.

Their taste profile:
- Favorite genres: ${profile.favoriteGenres.map(genreLabel).join(", ") || "none set"}
- Avoids: ${profile.avoidGenres.map(genreLabel).join(", ") || "nothing in particular"}
- Usually prefers a tone that is: ${profile.tone === "light" ? "light and fun" : "intense or dark"}
- Recently liked: ${recentlyLikedTitles.slice(-12).join(", ") || "no ratings yet"}

Right now: they're ${COMPANY_PHRASE[context.company]}, in the mood "${context.mood}", with ${TIME_PHRASE[context.timeBudget]}.

Candidates (already filtered to exclude anything they've already seen or rated):
${candidateLines}

Pick the ONE candidate that best fits this person right now, and explain why in 1-2 warm, specific sentences, speaking directly to them ("You'll..."). Respond only by calling pick_recommendation.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      tools: [
        {
          name: "pick_recommendation",
          description: "Selects the best-fitting candidate for this person right now and explains the pick.",
          input_schema: {
            type: "object",
            properties: {
              id: { type: "number", description: "The id of the chosen candidate" },
              reason: { type: "string", description: "1-2 warm, specific sentences, second person" },
            },
            required: ["id", "reason"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "pick_recommendation" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) return null;

    const input = toolUse.input as { id: number; reason: string };
    if (!candidates.some((c) => c.id === input.id)) return null;
    return { id: input.id, reason: input.reason };
  } catch (err) {
    console.error("Claude recommendation failed, falling back to rules:", err);
    return null;
  }
}
