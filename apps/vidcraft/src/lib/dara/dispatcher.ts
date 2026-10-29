import type { DaraAction, Workspace } from "@/lib/dara/actions";
import {
  addCharacter,
  addLocation,
  addScene,
  deleteScene,
  getProject,
  reorderScene,
  updateScene,
} from "@/stores/projects";
import { composeSceneImagePrompt } from "@/lib/ai-mcd/compose";
import type { Project, Scene } from "@/types/project";

export type ActionOutcome =
  | { ok: true; label: string }
  | { ok: false; label: string; error: string };

export type DispatcherControls = {
  onProjectChange: () => void;
  switchWorkspace: (ws: Workspace) => void;
  /** Copy text to the system clipboard; return true if it worked. */
  writeClipboard: (text: string) => Promise<boolean>;
};

/**
 * Apply a list of Dara's actions to the project in order. Each action is
 * independent — one failure doesn't block the rest. Returns per-action
 * outcomes so the UI can show what landed and what didn't.
 */
export async function applyActions(
  projectId: string,
  actions: DaraAction[],
  controls: DispatcherControls,
): Promise<ActionOutcome[]> {
  const outcomes: ActionOutcome[] = [];
  for (const action of actions) {
    outcomes.push(await applyOne(projectId, action, controls));
  }
  return outcomes;
}

async function applyOne(
  projectId: string,
  action: DaraAction,
  controls: DispatcherControls,
): Promise<ActionOutcome> {
  try {
    switch (action.type) {
      case "create_character": {
        const project = getProject(projectId);
        if (!project) return fail(action, "project not found");
        if (
          project.bibles.characters.some(
            (c) => c.tagName === action.tagName.toUpperCase(),
          )
        ) {
          return fail(
            action,
            `character @${action.tagName} already exists; use update_scene to reference it`,
          );
        }
        if (!action.negativeList?.trim()) {
          return fail(
            action,
            "character must have a non-empty negativeList (AI MCD rule)",
          );
        }
        const now = new Date().toISOString();
        addCharacter(projectId, {
          id: crypto.randomUUID(),
          tagName: action.tagName.toUpperCase(),
          verbatimSummary: action.verbatimSummary.trim(),
          negativeList: action.negativeList.trim(),
          approved: false,
          createdAt: now,
          updatedAt: now,
        });
        controls.onProjectChange();
        return pass(action);
      }

      case "create_location": {
        const project = getProject(projectId);
        if (!project) return fail(action, "project not found");
        if (
          project.bibles.locations.some(
            (l) => l.tagName === action.tagName.toUpperCase(),
          )
        ) {
          return fail(action, `location @${action.tagName} already exists`);
        }
        if (!action.negativeList?.trim()) {
          return fail(
            action,
            "location must have a non-empty negativeList (AI MCD rule)",
          );
        }
        const now = new Date().toISOString();
        addLocation(projectId, {
          id: crypto.randomUUID(),
          tagName: action.tagName.toUpperCase(),
          verbatimSummary: action.verbatimSummary.trim(),
          negativeList: action.negativeList.trim(),
          approved: false,
          createdAt: now,
          updatedAt: now,
        });
        controls.onProjectChange();
        return pass(action);
      }

      case "create_scene": {
        const project = getProject(projectId);
        if (!project) return fail(action, "project not found");
        const resolved = resolveTags(
          project,
          action.characterTags,
          action.locationTag,
        );
        if (resolved.error) return fail(action, resolved.error);
        const now = new Date().toISOString();
        addScene(projectId, {
          id: crypto.randomUUID(),
          title: action.title?.trim() || undefined,
          beat: action.beat?.trim() || undefined,
          characterIds: resolved.characterIds,
          locationId: resolved.locationId,
          shotDescription: action.shotDescription.trim(),
          negativeAdditions: action.negativeAdditions?.trim() ?? "",
          createdAt: now,
          updatedAt: now,
        });
        controls.onProjectChange();
        return pass(action);
      }

      case "update_scene": {
        const project = getProject(projectId);
        if (!project) return fail(action, "project not found");
        const scene = sceneByIndex(project, action.sceneIndex);
        if (!scene) return fail(action, `no scene #${action.sceneIndex}`);
        const patch: Partial<Scene> = {};
        if (action.patch.title !== undefined)
          patch.title = action.patch.title?.trim() || undefined;
        if (action.patch.beat !== undefined)
          patch.beat = action.patch.beat?.trim() || undefined;
        if (action.patch.shotDescription !== undefined)
          patch.shotDescription = action.patch.shotDescription.trim();
        if (action.patch.negativeAdditions !== undefined)
          patch.negativeAdditions = action.patch.negativeAdditions.trim();
        if (action.patch.characterTags !== undefined) {
          const r = resolveTags(project, action.patch.characterTags, undefined);
          if (r.error) return fail(action, r.error);
          patch.characterIds = r.characterIds;
        }
        if (action.patch.locationTag !== undefined) {
          if (action.patch.locationTag === null) {
            patch.locationId = undefined;
          } else {
            const r = resolveTags(project, [], action.patch.locationTag);
            if (r.error) return fail(action, r.error);
            patch.locationId = r.locationId;
          }
        }
        if (action.patch.trimInSeconds !== undefined) {
          patch.trimInSeconds =
            action.patch.trimInSeconds === null
              ? undefined
              : action.patch.trimInSeconds;
        }
        if (action.patch.trimOutSeconds !== undefined) {
          patch.trimOutSeconds =
            action.patch.trimOutSeconds === null
              ? undefined
              : action.patch.trimOutSeconds;
        }
        updateScene(projectId, scene.id, patch);
        controls.onProjectChange();
        return pass(action);
      }

      case "delete_scene": {
        const project = getProject(projectId);
        if (!project) return fail(action, "project not found");
        const scene = sceneByIndex(project, action.sceneIndex);
        if (!scene) return fail(action, `no scene #${action.sceneIndex}`);
        deleteScene(projectId, scene.id);
        controls.onProjectChange();
        return pass(action);
      }

      case "reorder_scene": {
        const project = getProject(projectId);
        if (!project) return fail(action, "project not found");
        const scene = sceneByIndex(project, action.sceneIndex);
        if (!scene) return fail(action, `no scene #${action.sceneIndex}`);
        reorderScene(projectId, scene.id, action.direction);
        controls.onProjectChange();
        return pass(action);
      }

      case "copy_scene_prompt": {
        const project = getProject(projectId);
        if (!project) return fail(action, "project not found");
        const scene = sceneByIndex(project, action.sceneIndex);
        if (!scene) return fail(action, `no scene #${action.sceneIndex}`);
        const result = composeSceneImagePrompt(scene, project.bibles);
        const copied = await controls.writeClipboard(result.prompt);
        if (!copied)
          return fail(action, "clipboard write was blocked by the browser");
        return pass(action);
      }

      case "switch_workspace": {
        controls.switchWorkspace(action.workspace);
        return pass(action);
      }

      case "message": {
        return pass(action);
      }
    }
  } catch (e) {
    return fail(action, e instanceof Error ? e.message : String(e));
  }
}

function resolveTags(
  project: Project,
  characterTags: string[],
  locationTag: string | undefined,
): {
  characterIds: string[];
  locationId: string | undefined;
  error?: string;
} {
  const charsByTag = new Map(
    project.bibles.characters.map((c) => [c.tagName, c.id]),
  );
  const locsByTag = new Map(
    project.bibles.locations.map((l) => [l.tagName, l.id]),
  );
  const characterIds: string[] = [];
  for (const t of characterTags) {
    const id = charsByTag.get(t.toUpperCase());
    if (!id)
      return {
        characterIds: [],
        locationId: undefined,
        error: `unknown character tag @${t}`,
      };
    characterIds.push(id);
  }
  let locationId: string | undefined;
  if (locationTag) {
    locationId = locsByTag.get(locationTag.toUpperCase());
    if (!locationId)
      return {
        characterIds: [],
        locationId: undefined,
        error: `unknown location tag @${locationTag}`,
      };
  }
  return { characterIds, locationId };
}

function sceneByIndex(project: Project, index: number): Scene | undefined {
  return project.scenes.find((s) => s.index === index);
}

function labelOf(action: DaraAction): string {
  switch (action.type) {
    case "create_character":
      return `+ character @${action.tagName}`;
    case "create_location":
      return `+ location @${action.tagName}`;
    case "create_scene":
      return `+ scene "${action.title ?? "(no title)"}"`;
    case "update_scene":
      return `~ scene #${action.sceneIndex}`;
    case "delete_scene":
      return `× scene #${action.sceneIndex}`;
    case "reorder_scene":
      return `↕ scene #${action.sceneIndex} ${action.direction}`;
    case "copy_scene_prompt":
      return `⎘ copy prompt #${action.sceneIndex}`;
    case "switch_workspace":
      return `→ ${action.workspace}`;
    case "message":
      return `“${action.text.slice(0, 80)}”`;
  }
}

function pass(action: DaraAction): ActionOutcome {
  return { ok: true, label: labelOf(action) };
}

function fail(action: DaraAction, error: string): ActionOutcome {
  return { ok: false, label: labelOf(action), error };
}
