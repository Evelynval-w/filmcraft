export type InputMode =
  | "prompt"
  | "script"
  | "voiceover"
  | "talking-head"
  | "avatar"
  | "persona"
  | "mcd-import";

export type MediaKind = "video" | "image" | "audio";

export type MediaItem = {
  id: string;
  name: string;
  kind: MediaKind;
  path: string;
  prompt?: string;
  durationSeconds?: number;
  createdAt: string;
};

/**
 * A locked character entry in the project's Character Bible.
 *
 * Follows the AI MCD methodology: wardrobe and props are specified INLINE
 * inside `verbatimSummary` (the user does not keep a separate Wardrobe/Prop
 * Bible). The summary is the exact text that will be copied-verbatim into
 * any Scene Image prompt that tags this character — it must never be
 * re-typed from memory once the character is approved.
 */
export type CharacterEntry = {
  id: string;
  /** Flow tag handle, e.g. "DARA". Short, upper-case recommended. */
  tagName: string;
  /** Path to the approved generation image on disk. */
  approvedImagePath?: string;
  /**
   * The exact text that goes into every tagged Scene Image prompt. Includes
   * identity paragraph + wardrobe + props. Immutable once `approved: true`.
   */
  verbatimSummary: string;
  /** Mandatory negative/blocking list — no prompt ships without one. */
  negativeList: string;
  /** True once reviewed and locked. Blocks edits to `verbatimSummary`. */
  approved: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * A locked location entry in the project's Location Bible.
 *
 * `masterSceneImagePath` is extracted on demand (the user tells Flow to
 * remove characters/props from an approved Scene Image to get the empty
 * room). Not pre-built like in the canonical AI MCD methodology.
 */
export type LocationEntry = {
  id: string;
  /** Flow tag handle, e.g. "KITCHEN_WARM_MORNING". */
  tagName: string;
  /** The exact text that goes into every tagged Scene Image prompt. */
  verbatimSummary: string;
  /** Mandatory negative/blocking list. */
  negativeList: string;
  /** Master scene (empty room) image path once extracted. */
  masterSceneImagePath?: string;
  /** True once reviewed and locked. */
  approved: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Bibles = {
  characters: CharacterEntry[];
  locations: LocationEntry[];
};

/**
 * One frozen moment in the story. Compiles to a Scene Image prompt by combining
 * the verbatim summaries of its tagged characters and location with the
 * per-scene blocking/action/camera details. Later gets a keyframe image and
 * a video clip attached.
 */
export type Scene = {
  id: string;
  /** 1-based display order. */
  index: number;
  /** Short label, e.g. "Dara at the kitchen window". Optional. */
  title?: string;
  /** The story beat — what emotionally/narratively happens. Not sent to Flow. */
  beat?: string;
  /** Characters tagged into this scene (ids referencing CharacterEntry). */
  characterIds: string[];
  /** The location tagged into this scene (id referencing LocationEntry). */
  locationId?: string;
  /**
   * Everything the Scene Image needs: where characters stand, body angles,
   * what they hold, the frozen action, shot size, camera position/framing.
   * One field — easier to think in prose than three empty boxes.
   */
  shotDescription: string;
  /** Per-scene additions on top of bible negatives (combined on compose). */
  negativeAdditions: string;
  /** The approved Scene Image keyframe (still, from Flow text-to-image). */
  sceneImagePath?: string;
  /** MediaItem id in mediaPool for the final video (from Flow image-to-video). */
  videoMediaId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  inputMode?: InputMode;
  mediaPool: MediaItem[];
  bibles: Bibles;
  scenes: Scene[];
};
