import { useEffect, useRef, useState } from "react";
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
import {
  AlertTriangle,
  ImagePlus,
  Lock,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { validateBibleEntry } from "@/lib/ai-mcd/rules";

export type BibleEntryKind = "character" | "location";

export type BibleEntryDraft = {
  id?: string;
  tagName: string;
  verbatimSummary: string;
  negativeList: string;
  approved: boolean;
  /** Approved image for a character, or master-scene image for a location. */
  imagePath?: string;
};

type BibleEntryDialogProps = {
  kind: BibleEntryKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: BibleEntryDraft;
  onSave: (draft: BibleEntryDraft) => void;
  onDelete?: () => void;
};

function emptyDraft(): BibleEntryDraft {
  return {
    tagName: "",
    verbatimSummary: "",
    negativeList: "",
    approved: false,
  };
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

export function BibleEntryDialog({
  kind,
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
}: BibleEntryDialogProps) {
  const [draft, setDraft] = useState<BibleEntryDraft>(initial ?? emptyDraft());
  const [pickError, setPickError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimeout = useRef<number | null>(null);
  const isEdit = Boolean(initial?.id);
  const kindLabel = kind === "character" ? "Character" : "Location";
  const imageLabel =
    kind === "character"
      ? "Approved character image"
      : "Master scene image (empty room)";

  useEffect(() => {
    if (open) {
      setDraft(initial ?? emptyDraft());
      setPickError(null);
      setConfirmDelete(false);
    }
  }, [open, initial]);

  function handleDeleteClick() {
    if (!onDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      if (confirmTimeout.current) window.clearTimeout(confirmTimeout.current);
      confirmTimeout.current = window.setTimeout(
        () => setConfirmDelete(false),
        3000,
      );
      return;
    }
    if (confirmTimeout.current) window.clearTimeout(confirmTimeout.current);
    onDelete();
    onOpenChange(false);
  }

  const issues = validateBibleEntry(draft);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const canSave = errors.length === 0;

  const summaryLocked = draft.approved && isEdit;

  function handleSave() {
    if (!canSave) return;
    onSave(draft);
    onOpenChange(false);
  }

  async function handlePickImage() {
    setPickError(null);
    try {
      const picked = await openFileDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      if (!picked) return;
      setDraft({ ...draft, imagePath: picked as string });
    } catch (e) {
      setPickError(String(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${kindLabel}` : `New ${kindLabel}`}
          </DialogTitle>
          <DialogDescription>
            {kind === "character"
              ? "Lock one actor. Wardrobe and props go inside the verbatim summary — this exact text gets copied into every Scene Image prompt that tags them."
              : "Lock one place. The verbatim summary becomes the environment paragraph in every Scene Image set here."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{imageLabel}</Label>
            <div className="mt-1 flex gap-3 items-start">
              <div className="h-32 w-32 shrink-0 rounded-md border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                {draft.imagePath ? (
                  <img
                    src={convertFileSrc(draft.imagePath)}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                ) : (
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handlePickImage}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    {draft.imagePath ? "Change image" : "Attach image"}
                  </Button>
                  {draft.imagePath && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDraft({ ...draft, imagePath: undefined })
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
                {draft.imagePath && (
                  <p
                    className="text-[10px] text-muted-foreground font-mono truncate"
                    title={draft.imagePath}
                  >
                    {basename(draft.imagePath)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {kind === "character"
                    ? "Pick the approved generation from Downloads (or wherever you saved it). This is the identity Flow tags against."
                    : "The empty-room image you extracted by removing the characters from an approved Scene Image."}
                </p>
                {pickError && (
                  <p className="text-destructive text-xs font-mono">
                    {pickError}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="tagName">Flow tag name</Label>
            <Input
              id="tagName"
              value={draft.tagName}
              onChange={(e) =>
                setDraft({ ...draft, tagName: e.currentTarget.value })
              }
              placeholder={
                kind === "character" ? "DARA" : "KITCHEN_WARM_MORNING"
              }
              className="mt-1 font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Short, upper-case. The handle you'll tag into Scene Image prompts.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="verbatimSummary">Verbatim summary</Label>
              {summaryLocked && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Lock className="h-3 w-3" />
                  locked (approved)
                </Badge>
              )}
            </div>
            <Textarea
              id="verbatimSummary"
              value={draft.verbatimSummary}
              onChange={(e) =>
                setDraft({ ...draft, verbatimSummary: e.currentTarget.value })
              }
              rows={6}
              disabled={summaryLocked}
              placeholder={
                kind === "character"
                  ? "A thirty-year-old Nigerian woman, dark skin, close-cropped natural hair, warm brown eyes. Wears a loose cream linen shirt over slim indigo trousers, worn leather belt, bare feet. Holds a chipped enamel mug in the right hand."
                  : "A compact kitchen with soft morning light from a single east-facing window. White tiled walls, oak counter running the length of the room. A chipped enamel sink at the far end. The floor is unpolished pine."
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              {kind === "character"
                ? "Wardrobe + props inline. Once approved, this text is immutable — scene prompts must copy it verbatim."
                : "Everything the Scene Image needs about this place. Once approved, immutable."}
            </p>
          </div>

          <div>
            <Label htmlFor="negativeList">Negative / blocking list</Label>
            <Textarea
              id="negativeList"
              value={draft.negativeList}
              onChange={(e) =>
                setDraft({ ...draft, negativeList: e.currentTarget.value })
              }
              rows={3}
              placeholder="No other people in frame. No modern electronics visible. No branded logos. No text or signage."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Mandatory. Every prompt must state what must NOT appear.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="approved"
              type="checkbox"
              checked={draft.approved}
              onChange={(e) =>
                setDraft({ ...draft, approved: e.currentTarget.checked })
              }
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="approved" className="cursor-pointer">
              Approved — lock verbatim summary
            </Label>
          </div>

          {(errors.length > 0 || warnings.length > 0) && (
            <div className="space-y-2">
              {errors.map((e, i) => (
                <div
                  key={`e-${i}`}
                  className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex gap-2"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{e.message}</span>
                </div>
              ))}
              {warnings.map((w, i) => (
                <div
                  key={`w-${i}`}
                  className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-xs text-yellow-500 flex gap-2"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {isEdit && onDelete && (
            <Button
              variant={confirmDelete ? "destructive" : "outline"}
              onClick={handleDeleteClick}
              className={
                confirmDelete
                  ? "mr-auto"
                  : "mr-auto border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
              }
            >
              <Trash2 className="h-4 w-4" />
              {confirmDelete
                ? `Click again to delete ${kindLabel.toLowerCase()}`
                : `Delete ${kindLabel.toLowerCase()}`}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            <Save className="h-4 w-4" />
            Save {kindLabel.toLowerCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
