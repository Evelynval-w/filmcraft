import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { addMediaItem } from "@/stores/projects";
import type { MediaItem } from "@/types/project";

type GenerateVideoResult = {
  path: string;
  duration_seconds: number;
  prompt: string;
  model: string;
};

const MODELS = [
  { id: "Veo 3.1 Lite", label: "Veo 3.1 Lite", costHint: "cheapest" },
  { id: "Veo 3.1 Fast", label: "Veo 3.1 Fast", costHint: "mid" },
  { id: "Veo 3.1 Quality", label: "Veo 3.1 Quality", costHint: "best, pricey" },
  { id: "Omni 1.1 Flash", label: "Omni 1.1 Flash", costHint: "fast" },
] as const;

type GenerateClipDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClipAdded: (clip: MediaItem) => void;
};

const DURATIONS: Array<4 | 6 | 8 | 10> = [4, 6, 8, 10];

export function GenerateClipDialog({
  projectId,
  open,
  onOpenChange,
  onClipAdded,
}: GenerateClipDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<4 | 6 | 8 | 10>(8);
  const [model, setModel] = useState<string>(MODELS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await invoke<GenerateVideoResult>("gflow_generate_video", {
        args: {
          project_id: projectId,
          prompt: trimmed,
          duration,
          model,
        },
      });
      const item: MediaItem = {
        id: crypto.randomUUID(),
        name: trimmed.slice(0, 48),
        kind: "video",
        path: result.path,
        prompt: result.prompt,
        durationSeconds: result.duration_seconds,
        createdAt: new Date().toISOString(),
      };
      addMediaItem(projectId, item);
      onClipAdded(item);
      setPrompt("");
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generate clip with Google Flow
          </DialogTitle>
          <DialogDescription>
            Describe the shot. Flow generates it with Veo 3.1 using credits from
            your Google AI Pro plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-2">
              Prompt
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder="A medium shot of Dara at a kitchen counter, warm morning light, holding a chipped mug..."
              rows={5}
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-2">
              Model
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MODELS.map((m) => (
                <Button
                  key={m.id}
                  variant={model === m.id ? "default" : "secondary"}
                  size="sm"
                  disabled={busy}
                  onClick={() => setModel(m.id)}
                  className="justify-between"
                >
                  <span>{m.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {m.costHint}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-2">
              Duration
            </label>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <Button
                  key={d}
                  variant={duration === d ? "default" : "secondary"}
                  size="sm"
                  disabled={busy}
                  onClick={() => setDuration(d)}
                  className="flex-1"
                >
                  {d}s
                </Button>
              ))}
            </div>
          </div>

          {busy && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center gap-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                Generating... Flow can take 2–10 minutes end to end (queue +
                render + preview). Watch the Chrome window gflow opened for
                live progress.
              </span>
            </div>
          )}

          {error && !busy && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs font-mono text-destructive whitespace-pre-wrap break-words">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={busy || !prompt.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
