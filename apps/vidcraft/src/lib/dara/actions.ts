/**
 * The structured actions Dara can emit. The Dara LLM is instructed to return
 * JSON matching one of these shapes; the dispatcher runs them against the
 * project store and the UI control callbacks.
 *
 * Keep this minimal and composable — several small actions beat one big one,
 * because Dara can combine them in a sequence per user turn.
 */

export type Workspace = "bibles" | "scenes" | "timeline";

export type DaraAction =
  | {
      type: "create_character";
      tagName: string;
      verbatimSummary: string;
      negativeList: string;
    }
  | {
      type: "create_location";
      tagName: string;
      verbatimSummary: string;
      negativeList: string;
    }
  | {
      type: "create_scene";
      title?: string;
      beat?: string;
      /** Tags like "DARA" — resolved to character ids by the dispatcher. */
      characterTags: string[];
      /** Tag like "KITCHEN_WARM_MORNING" — optional. */
      locationTag?: string;
      shotDescription: string;
      negativeAdditions?: string;
    }
  | {
      type: "update_scene";
      /** 1-based scene index as shown in the UI. */
      sceneIndex: number;
      patch: {
        title?: string;
        beat?: string;
        characterTags?: string[];
        locationTag?: string | null;
        shotDescription?: string;
        negativeAdditions?: string;
        /** Trim-in seconds; null to clear. */
        trimInSeconds?: number | null;
        /** Trim-out seconds; null to clear. */
        trimOutSeconds?: number | null;
      };
    }
  | { type: "delete_scene"; sceneIndex: number }
  | {
      type: "reorder_scene";
      sceneIndex: number;
      direction: "up" | "down";
    }
  | { type: "copy_scene_prompt"; sceneIndex: number }
  | { type: "switch_workspace"; workspace: Workspace }
  | { type: "message"; text: string };

export function actionLabel(action: DaraAction): string {
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
      return "✎ note";
  }
}
