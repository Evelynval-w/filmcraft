import type { Project } from "@/types/project";

/**
 * Compact JSON view of the project that Dara sees before each turn. Keep this
 * short: only identifiers, tags, titles, and a tiny preview of long strings.
 * Dara doesn't need the full verbatim bibles to decide what action to take;
 * it only needs to know what exists.
 */
export type ProjectContext = {
  projectName: string;
  inputMode?: string;
  characters: { tagName: string; approved: boolean; summaryPreview: string }[];
  locations: { tagName: string; approved: boolean; summaryPreview: string }[];
  scenes: {
    index: number;
    title: string;
    beat: string;
    characterTags: string[];
    locationTag: string | undefined;
    hasKeyframe: boolean;
    hasClip: boolean;
    shotPreview: string;
  }[];
  mediaPoolSize: number;
};

export function buildContext(project: Project): ProjectContext {
  const charIdToTag = new Map(
    project.bibles.characters.map((c) => [c.id, c.tagName]),
  );
  const locIdToTag = new Map(
    project.bibles.locations.map((l) => [l.id, l.tagName]),
  );

  return {
    projectName: project.name,
    inputMode: project.inputMode,
    characters: project.bibles.characters.map((c) => ({
      tagName: c.tagName,
      approved: c.approved,
      summaryPreview: preview(c.verbatimSummary, 160),
    })),
    locations: project.bibles.locations.map((l) => ({
      tagName: l.tagName,
      approved: l.approved,
      summaryPreview: preview(l.verbatimSummary, 160),
    })),
    scenes: [...project.scenes]
      .sort((a, b) => a.index - b.index)
      .map((s) => ({
        index: s.index,
        title: s.title ?? "",
        beat: s.beat ?? "",
        characterTags: s.characterIds
          .map((id) => charIdToTag.get(id))
          .filter((t): t is string => Boolean(t)),
        locationTag: s.locationId ? locIdToTag.get(s.locationId) : undefined,
        hasKeyframe: Boolean(s.sceneImagePath),
        hasClip: Boolean(s.videoMediaId),
        shotPreview: preview(s.shotDescription, 240),
      })),
    mediaPoolSize: project.mediaPool.length,
  };
}

function preview(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1) + "…";
}
