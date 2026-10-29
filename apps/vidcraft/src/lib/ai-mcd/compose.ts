import type {
  Bibles,
  CharacterEntry,
  LocationEntry,
  Scene,
} from "@/types/project";
import { findBrandNames } from "@/lib/ai-mcd/rules";

export type ComposeIssue = {
  severity: "error" | "warning";
  message: string;
};

export type ComposeResult = {
  prompt: string;
  issues: ComposeIssue[];
};

/**
 * Compose a Scene Image prompt from a scene + the project's bibles.
 *
 * Follows AI MCD rules:
 *   - Character and location summaries are copied VERBATIM from the bibles.
 *     Never re-typed, never paraphrased.
 *   - The negative/blocking list is mandatory and combines character + location
 *     bible negatives with per-scene additions.
 *   - Brand names in any copied text are flagged as warnings.
 *   - Unapproved characters / locations are flagged as warnings (they can drift).
 *
 * Output is plain prose ready to paste into Flow's prompt box.
 */
export function composeSceneImagePrompt(
  scene: Scene,
  bibles: Bibles,
): ComposeResult {
  const issues: ComposeIssue[] = [];
  const characters: CharacterEntry[] = scene.characterIds
    .map((id) => bibles.characters.find((c) => c.id === id))
    .filter((c): c is CharacterEntry => Boolean(c));

  const location: LocationEntry | undefined = scene.locationId
    ? bibles.locations.find((l) => l.id === scene.locationId)
    : undefined;

  if (scene.characterIds.length !== characters.length) {
    issues.push({
      severity: "error",
      message:
        "Some tagged characters are missing from the bible (deleted?). Fix before copying.",
    });
  }
  if (scene.locationId && !location) {
    issues.push({
      severity: "error",
      message:
        "The tagged location is missing from the bible (deleted?). Fix before copying.",
    });
  }

  for (const c of characters) {
    if (!c.approved) {
      issues.push({
        severity: "warning",
        message: `Character ${c.tagName} is not approved — Flow may drift its identity.`,
      });
    }
  }
  if (location && !location.approved) {
    issues.push({
      severity: "warning",
      message: `Location ${location.tagName} is not approved — Flow may drift the room.`,
    });
  }

  const parts: string[] = [];

  if (scene.title) {
    parts.push(`Scene ${scene.index}: ${scene.title}.`);
  } else {
    parts.push(`Scene ${scene.index}.`);
  }

  for (const c of characters) {
    parts.push(c.verbatimSummary.trim());
  }

  if (location) {
    parts.push(location.verbatimSummary.trim());
  }

  if (scene.shotDescription.trim()) {
    parts.push(scene.shotDescription.trim());
  }

  // Combine negatives from bibles + per-scene additions.
  const negativePieces: string[] = [];
  for (const c of characters) {
    if (c.negativeList.trim()) negativePieces.push(c.negativeList.trim());
  }
  if (location && location.negativeList.trim()) {
    negativePieces.push(location.negativeList.trim());
  }
  if (scene.negativeAdditions.trim()) {
    negativePieces.push(scene.negativeAdditions.trim());
  }
  const combinedNegative = dedupeSentences(negativePieces.join(" "));
  if (!combinedNegative) {
    issues.push({
      severity: "error",
      message:
        "No negative/blocking list — every Scene Image prompt must state what must NOT appear.",
    });
  } else {
    parts.push(`Negative / blocking list: ${combinedNegative}`);
  }

  const prompt = parts.join("\n\n");

  // Brand-name scan across the whole composed prompt.
  const brands = findBrandNames(prompt);
  if (brands.length > 0) {
    issues.push({
      severity: "warning",
      message: `Composed prompt contains real brand names (${brands
        .map((b) => b.brand)
        .join(", ")}). Flow may refuse. Replace with generic descriptors.`,
    });
  }

  return { prompt, issues };
}

/**
 * Simple sentence-level dedupe for combined negative lists: splits on sentence
 * terminators and drops repeats (case-insensitive). Preserves original order.
 */
function dedupeSentences(text: string): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const s of sentences) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(s);
  }
  return kept.join(" ");
}
