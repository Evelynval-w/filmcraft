import { useEffect, useMemo, useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Copy,
  ImagePlus,
  Save,
  Sparkles,
  Trash2,
  User,
  MapPin,
  Video,
  X,
} from "lucide-react";
import { composeSceneImagePrompt } from "@/lib/ai-mcd/compose";
import type {
  Bibles,
  MediaItem,
  Scene,
} from "@/types/project";

export type SceneDraft = {
  id?: string;
  title: string;
  beat: string;
  characterIds: string[];
  locationId?: string;
  shotDescription: string;
  negativeAdditions: string;
  sceneImagePath?: string;
  videoMediaId?: string;
};

type SceneDialogProps = {
  bibles: Bibles;
  mediaPool: MediaItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: SceneDraft & { index?: number };
  onSave: (draft: SceneDraft) => void;
  onDelete?: () => void;
  /** Called when the user picks a local .mp4 that isn't in the pool yet. */
  onImportVideo: (path: string) => MediaItem | undefined;
};

function emptyDraft(): SceneDraft {
  return {
    title: "",
    beat: "",
    characterIds: [],
    locationId: undefined,
    shotDescription: "",
    negativeAdditions: "",
    sceneImagePath: undefined,
    videoMediaId: undefined,
  };
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

export function SceneDialog({
  bibles,
  mediaPool,
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
  onImportVideo,
}: SceneDialogProps) {
  const [draft, setDraft] = useState<SceneDraft>(initial ?? emptyDraft());
  const [pickError, setPickError] = useState<string | null>(null);
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (open) {
      setDraft(initial ?? emptyDraft());
      setPickError(null);
    }
  }, [open, initial]);

  const composed = useMemo(() => {
    const sceneForCompose: Scene = {
      id: draft.id ?? "preview",
      index: initial?.index ?? 1,
      title: draft.title,
      beat: draft.beat,
      characterIds: draft.characterIds,
      locationId: draft.locationId,
      shotDescription: draft.shotDescription,
      negativeAdditions: draft.negativeAdditions,
      createdAt: "",
      updatedAt: "",
    };
    return composeSceneImagePrompt(sceneForCompose, bibles);
  }, [draft, bibles, initial?.index]);

  const errors = composed.issues.filter((i) => i.severity === "error");
  const warnings = composed.issues.filter((i) => i.severity === "warning");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(composed.prompt);
    } catch {
      /* clipboard denied; silent */
    }
  }

  function toggleCharacter(id: string) {
    setDraft((d) => ({
      ...d,
      characterIds: d.characterIds.includes(id)
        ? d.characterIds.filter((x) => x !== id)
        : [...d.characterIds, id],
    }));
  }

  async function handlePickSceneImage() {
    setPickError(null);
    try {
      const picked = await openFileDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      if (!picked) return;
      setDraft({ ...draft, sceneImagePath: picked as string });
    } catch (e) {
      setPickError(String(e));
    }
  }

  async function handlePickSceneVideo() {
    setPickError(null);
    try {
      const picked = await openFileDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "Video", extensions: ["mp4", "mov", "webm", "mkv", "m4v"] }],
      });
      if (!picked) return;
      const item = onImportVideo(picked as string);
      if (item) setDraft({ ...draft, videoMediaId: item.id });
    } catch (e) {
      setPickError(String(e));
    }
  }

  const linkedVideo = draft.videoMediaId
    ? mediaPool.find((m) => m.id === draft.videoMediaId)
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit scene" : "New scene"}</DialogTitle>
          <DialogDescription>
            Pick characters + location from the Bibles, describe the shot. The
            Scene Image prompt composes automatically on the right. Later,
            attach the keyframe and the final video Flow produced.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: inputs */}
          <div className="space-y-5">
            {/* 1. Identity */}
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                1. Scene identity
              </h3>
              <div>
                <Label htmlFor="sceneTitle">Title (optional)</Label>
                <Input
                  id="sceneTitle"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.currentTarget.value })
                  }
                  placeholder="Dara at the kitchen window"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="sceneBeat">
                  Story beat (narrative only, not sent to Flow)
                </Label>
                <Textarea
                  id="sceneBeat"
                  value={draft.beat}
                  onChange={(e) =>
                    setDraft({ ...draft, beat: e.currentTarget.value })
                  }
                  rows={2}
                  placeholder="She hears the key in the lock before she sees him."
                  className="mt-1"
                />
              </div>
            </section>

            <Separator />

            {/* 2. Tags */}
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                2. Who and where
              </h3>

              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <User className="h-3.5 w-3.5" />
                  Characters in this scene
                </Label>
                {bibles.characters.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No characters yet — add one in the Bibles tab first.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-auto pr-1">
                    {bibles.characters.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 py-1 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={draft.characterIds.includes(c.id)}
                          onChange={() => toggleCharacter(c.id)}
                          className="h-4 w-4 rounded border-input"
                        />
                        <code className="font-mono">{c.tagName}</code>
                        {!c.approved && (
                          <Badge variant="secondary" className="text-[10px]">
                            unapproved
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <MapPin className="h-3.5 w-3.5" />
                  Location
                </Label>
                {bibles.locations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No locations yet — add one in the Bibles tab first.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-auto pr-1">
                    {bibles.locations.map((l) => (
                      <label
                        key={l.id}
                        className="flex items-center gap-2 py-1 text-sm cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="scene-location"
                          checked={draft.locationId === l.id}
                          onChange={() =>
                            setDraft({ ...draft, locationId: l.id })
                          }
                          className="h-4 w-4"
                        />
                        <code className="font-mono">{l.tagName}</code>
                        {!l.approved && (
                          <Badge variant="secondary" className="text-[10px]">
                            unapproved
                          </Badge>
                        )}
                      </label>
                    ))}
                    {draft.locationId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() =>
                          setDraft({ ...draft, locationId: undefined })
                        }
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </section>

            <Separator />

            {/* 3. The shot */}
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                3. The shot
              </h3>
              <div>
                <Label htmlFor="shotDescription">What's in the shot</Label>
                <Textarea
                  id="shotDescription"
                  value={draft.shotDescription}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      shotDescription: e.currentTarget.value,
                    })
                  }
                  rows={5}
                  placeholder="Dara stands at the far counter, body angled three-quarters toward the window, right hand holding the enamel mug just below her chin. Medium shot, 50mm lens at 1.4m height, 2m from subject, slight dutch tilt. She is frozen mid-breath — looking out past the glass."
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Blocking + the frozen action + shot size + camera. One prose
                  paragraph — easier than three empty boxes.
                </p>
              </div>
              <div>
                <Label htmlFor="negAdd">Negative additions (per scene)</Label>
                <Textarea
                  id="negAdd"
                  value={draft.negativeAdditions}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      negativeAdditions: e.currentTarget.value,
                    })
                  }
                  rows={2}
                  placeholder="No visible breath or vapor. No other people in frame."
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Combined with the tagged bibles' negative lists on compose.
                </p>
              </div>
            </section>

            <Separator />

            {/* 4. Assets */}
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                4. Assets (attach after Flow renders them)
              </h3>

              {/* Scene Image = still keyframe */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <ImagePlus className="h-3.5 w-3.5" />
                  Scene Image — the frozen keyframe (.png / .jpg)
                </Label>
                <div className="flex gap-3 items-start">
                  <div className="h-24 w-24 shrink-0 rounded-md border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                    {draft.sceneImagePath ? (
                      <img
                        src={convertFileSrc(draft.sceneImagePath)}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handlePickSceneImage}
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        {draft.sceneImagePath ? "Change" : "Attach"}
                      </Button>
                      {draft.sceneImagePath && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDraft({ ...draft, sceneImagePath: undefined })
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The still Flow produced from the composed prompt. Acts
                      as the first-frame reference for the video.
                    </p>
                  </div>
                </div>
              </div>

              {/* Scene Video = final clip */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Video className="h-3.5 w-3.5" />
                  Scene Video — the final clip (.mp4)
                </Label>
                <div className="flex gap-3 items-start">
                  <div className="h-24 w-24 shrink-0 rounded-md border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                    {linkedVideo ? (
                      <Video className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Video className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handlePickSceneVideo}
                      >
                        <Video className="h-3.5 w-3.5" />
                        {linkedVideo ? "Change" : "Attach"}
                      </Button>
                      {linkedVideo && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDraft({ ...draft, videoMediaId: undefined })
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                          Unlink
                        </Button>
                      )}
                    </div>
                    {linkedVideo && (
                      <p
                        className="text-[11px] text-muted-foreground font-mono truncate"
                        title={linkedVideo.path}
                      >
                        {basename(linkedVideo.path)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      The image-to-video result from Flow. Also appears in the
                      Media Library automatically.
                    </p>
                  </div>
                </div>
              </div>

              {pickError && (
                <p className="text-destructive text-xs font-mono break-words">
                  {pickError}
                </p>
              )}
            </section>
          </div>

          {/* RIGHT: composed preview */}
          <div className="space-y-3 lg:sticky lg:top-0 self-start">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Composed Scene Image prompt
              </Label>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                disabled={!composed.prompt.trim() || errors.length > 0}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 font-mono text-xs whitespace-pre-wrap max-h-96 overflow-auto min-h-[12rem]">
              {composed.prompt || (
                <span className="text-muted-foreground italic">
                  Pick a character + location to compose...
                </span>
              )}
            </div>

            {(errors.length > 0 || warnings.length > 0) && (
              <div className="space-y-2">
                {errors.map((e, i) => (
                  <div
                    key={`e-${i}`}
                    className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive flex gap-2"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{e.message}</span>
                  </div>
                ))}
                {warnings.map((w, i) => (
                  <div
                    key={`w-${i}`}
                    className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-2 text-xs text-yellow-500 flex gap-2"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Paste this into Google Flow. When the keyframe is approved,
              attach it under section 4; later, attach the final video the
              same way.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {isEdit && onDelete && (
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm("Delete scene?")) {
                  onDelete();
                  onOpenChange(false);
                }
              }}
              className="mr-auto text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            <Save className="h-4 w-4" />
            Save scene
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
