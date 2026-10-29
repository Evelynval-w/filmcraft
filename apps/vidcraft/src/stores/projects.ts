import type {
  Bibles,
  CharacterEntry,
  InputMode,
  LocationEntry,
  MediaItem,
  Project,
  Scene,
} from "@/types/project";
import type {
  MCDImportResult,
  ParsedScene,
} from "@/lib/ai-mcd/mcd-import";

const STORAGE_KEY = "vidcraft.projects.v1";

function emptyBibles(): Bibles {
  return { characters: [], locations: [] };
}

function safeRead(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as Project[]).map(normalize);
  } catch {
    return [];
  }
}

function normalize(p: Project): Project {
  return {
    ...p,
    mediaPool: Array.isArray(p.mediaPool) ? p.mediaPool : [],
    bibles: p.bibles
      ? {
          characters: Array.isArray(p.bibles.characters)
            ? p.bibles.characters
            : [],
          locations: Array.isArray(p.bibles.locations)
            ? p.bibles.locations
            : [],
        }
      : emptyBibles(),
    scenes: Array.isArray(p.scenes) ? p.scenes : [],
  };
}

function safeWrite(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // storage full or disabled; the in-memory copy still works for this session
  }
}

function updateProject(
  id: string,
  mutator: (p: Project) => Project,
): Project | undefined {
  const all = safeRead();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return undefined;
  const now = new Date().toISOString();
  const updated = { ...mutator(all[idx]), updatedAt: now };
  all[idx] = updated;
  safeWrite(all);
  return updated;
}

export function listProjects(): Project[] {
  return safeRead().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createProject(name: string, inputMode?: InputMode): Project {
  const now = new Date().toISOString();
  const project: Project = {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled project",
    createdAt: now,
    updatedAt: now,
    inputMode,
    mediaPool: [],
    bibles: emptyBibles(),
    scenes: [],
  };
  const all = safeRead();
  all.push(project);
  safeWrite(all);
  return project;
}

export function getProject(id: string): Project | undefined {
  return safeRead().find((p) => p.id === id);
}

export function deleteProject(id: string): void {
  const all = safeRead().filter((p) => p.id !== id);
  safeWrite(all);
}

export function addMediaItem(
  projectId: string,
  item: MediaItem,
): Project | undefined {
  return updateProject(projectId, (p) => ({
    ...p,
    mediaPool: [...p.mediaPool, item],
  }));
}

export function deleteMediaItem(
  projectId: string,
  itemId: string,
): Project | undefined {
  return updateProject(projectId, (p) => ({
    ...p,
    mediaPool: p.mediaPool.filter((m) => m.id !== itemId),
    scenes: p.scenes.map((s) =>
      s.videoMediaId === itemId ? { ...s, videoMediaId: undefined } : s,
    ),
  }));
}

// --- Character Bible ---

export function addCharacter(
  projectId: string,
  entry: CharacterEntry,
): Project | undefined {
  return updateProject(projectId, (p) => ({
    ...p,
    bibles: { ...p.bibles, characters: [...p.bibles.characters, entry] },
  }));
}

export function updateCharacter(
  projectId: string,
  entryId: string,
  patch: Partial<CharacterEntry>,
): Project | undefined {
  return updateProject(projectId, (p) => {
    const existing = p.bibles.characters.find((c) => c.id === entryId);
    if (!existing) return p;
    // Approved characters: forbid `verbatimSummary` edits (copy-verbatim rule).
    const safePatch: Partial<CharacterEntry> =
      existing.approved && patch.verbatimSummary !== undefined
        ? { ...patch, verbatimSummary: existing.verbatimSummary }
        : patch;
    return {
      ...p,
      bibles: {
        ...p.bibles,
        characters: p.bibles.characters.map((c) =>
          c.id === entryId
            ? { ...c, ...safePatch, updatedAt: new Date().toISOString() }
            : c,
        ),
      },
    };
  });
}

export function deleteCharacter(
  projectId: string,
  entryId: string,
): Project | undefined {
  return updateProject(projectId, (p) => ({
    ...p,
    bibles: {
      ...p.bibles,
      characters: p.bibles.characters.filter((c) => c.id !== entryId),
    },
  }));
}

// --- Location Bible ---

export function addLocation(
  projectId: string,
  entry: LocationEntry,
): Project | undefined {
  return updateProject(projectId, (p) => ({
    ...p,
    bibles: { ...p.bibles, locations: [...p.bibles.locations, entry] },
  }));
}

export function updateLocation(
  projectId: string,
  entryId: string,
  patch: Partial<LocationEntry>,
): Project | undefined {
  return updateProject(projectId, (p) => {
    const existing = p.bibles.locations.find((l) => l.id === entryId);
    if (!existing) return p;
    const safePatch: Partial<LocationEntry> =
      existing.approved && patch.verbatimSummary !== undefined
        ? { ...patch, verbatimSummary: existing.verbatimSummary }
        : patch;
    return {
      ...p,
      bibles: {
        ...p.bibles,
        locations: p.bibles.locations.map((l) =>
          l.id === entryId
            ? { ...l, ...safePatch, updatedAt: new Date().toISOString() }
            : l,
        ),
      },
    };
  });
}

export function deleteLocation(
  projectId: string,
  entryId: string,
): Project | undefined {
  return updateProject(projectId, (p) => ({
    ...p,
    bibles: {
      ...p.bibles,
      locations: p.bibles.locations.filter((l) => l.id !== entryId),
    },
  }));
}

// --- Scenes ---

export function addScene(
  projectId: string,
  scene: Omit<Scene, "index">,
): Project | undefined {
  return updateProject(projectId, (p) => {
    const nextIndex =
      p.scenes.reduce((max, s) => Math.max(max, s.index), 0) + 1;
    return {
      ...p,
      scenes: [...p.scenes, { ...scene, index: nextIndex } as Scene],
    };
  });
}

export function updateScene(
  projectId: string,
  sceneId: string,
  patch: Partial<Scene>,
): Project | undefined {
  return updateProject(projectId, (p) => ({
    ...p,
    scenes: p.scenes.map((s) =>
      s.id === sceneId
        ? { ...s, ...patch, updatedAt: new Date().toISOString() }
        : s,
    ),
  }));
}

export function deleteScene(
  projectId: string,
  sceneId: string,
): Project | undefined {
  return updateProject(projectId, (p) => {
    const kept = p.scenes
      .filter((s) => s.id !== sceneId)
      .sort((a, b) => a.index - b.index)
      .map((s, i) => ({ ...s, index: i + 1 }));
    return { ...p, scenes: kept };
  });
}

export function reorderScene(
  projectId: string,
  sceneId: string,
  direction: "up" | "down",
): Project | undefined {
  return updateProject(projectId, (p) => {
    const sorted = [...p.scenes].sort((a, b) => a.index - b.index);
    const i = sorted.findIndex((s) => s.id === sceneId);
    if (i < 0) return p;
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= sorted.length) return p;
    const swapped = [...sorted];
    swapped[i] = sorted[j];
    swapped[j] = sorted[i];
    return {
      ...p,
      scenes: swapped.map((s, k) => ({ ...s, index: k + 1 })),
    };
  });
}

// --- Bulk AI MCD import ---

export type MCDImportReport = {
  charactersAdded: number;
  locationsAdded: number;
  scenesAdded: number;
  scenesSkipped: { title: string; reason: string }[];
};

/**
 * Add every parsed character, location and scene from an AI MCD paste. Scene
 * character/location tags are resolved against the bibles AFTER characters and
 * locations have been added (so a scene can reference a character defined in
 * the same paste). Entries with unresolved tags are reported, not silently
 * dropped — nothing gets added for a scene whose location doesn't exist.
 */
export function importMCD(
  projectId: string,
  parsed: MCDImportResult,
): MCDImportReport | undefined {
  const report: MCDImportReport = {
    charactersAdded: 0,
    locationsAdded: 0,
    scenesAdded: 0,
    scenesSkipped: [],
  };
  const now = new Date().toISOString();

  const updated = updateProject(projectId, (p) => {
    const nextCharacters: CharacterEntry[] = [...p.bibles.characters];
    for (const c of parsed.characters) {
      if (nextCharacters.some((x) => x.tagName === c.tagName)) continue;
      nextCharacters.push({
        id: crypto.randomUUID(),
        tagName: c.tagName,
        verbatimSummary: c.verbatimSummary,
        negativeList: c.negativeList,
        approved: false,
        createdAt: now,
        updatedAt: now,
      });
      report.charactersAdded++;
    }

    const nextLocations: LocationEntry[] = [...p.bibles.locations];
    for (const l of parsed.locations) {
      if (nextLocations.some((x) => x.tagName === l.tagName)) continue;
      nextLocations.push({
        id: crypto.randomUUID(),
        tagName: l.tagName,
        verbatimSummary: l.verbatimSummary,
        negativeList: l.negativeList,
        approved: false,
        createdAt: now,
        updatedAt: now,
      });
      report.locationsAdded++;
    }

    const charsByTag = new Map(nextCharacters.map((c) => [c.tagName, c.id]));
    const locsByTag = new Map(nextLocations.map((l) => [l.tagName, l.id]));

    const nextScenes: Scene[] = [...p.scenes];
    let nextIndex =
      nextScenes.reduce((max, s) => Math.max(max, s.index), 0) + 1;

    for (const s of parsed.scenes) {
      const resolved = resolveSceneTags(s, charsByTag, locsByTag);
      if (resolved.error) {
        report.scenesSkipped.push({
          title: s.title ?? "(no title)",
          reason: resolved.error,
        });
        continue;
      }
      nextScenes.push({
        id: crypto.randomUUID(),
        index: nextIndex++,
        title: s.title,
        beat: s.beat,
        characterIds: resolved.characterIds,
        locationId: resolved.locationId,
        shotDescription: s.shotDescription,
        negativeAdditions: s.negativeAdditions,
        createdAt: now,
        updatedAt: now,
      });
      report.scenesAdded++;
    }

    return {
      ...p,
      bibles: { characters: nextCharacters, locations: nextLocations },
      scenes: nextScenes,
    };
  });

  return updated ? report : undefined;
}

function resolveSceneTags(
  scene: ParsedScene,
  charsByTag: Map<string, string>,
  locsByTag: Map<string, string>,
): {
  characterIds: string[];
  locationId: string | undefined;
  error?: string;
} {
  const characterIds: string[] = [];
  for (const tag of scene.characterTags) {
    const id = charsByTag.get(tag);
    if (!id) {
      return {
        characterIds: [],
        locationId: undefined,
        error: `unknown character tag "${tag}"`,
      };
    }
    characterIds.push(id);
  }
  let locationId: string | undefined;
  if (scene.locationTag) {
    locationId = locsByTag.get(scene.locationTag);
    if (!locationId) {
      return {
        characterIds: [],
        locationId: undefined,
        error: `unknown location tag "${scene.locationTag}"`,
      };
    }
  }
  return { characterIds, locationId };
}
