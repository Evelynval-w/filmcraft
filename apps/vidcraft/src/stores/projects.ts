import type {
  Bibles,
  CharacterEntry,
  InputMode,
  LocationEntry,
  MediaItem,
  Project,
  Scene,
} from "@/types/project";

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
