import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  CheckCircle2,
  FileVideo,
  Loader2,
  Download,
  FolderOpen,
} from "lucide-react";
import type { Project } from "@/types/project";

type ExportResult = {
  output_path: string;
  clip_count: number;
  ffmpeg_path: string;
  trimmed_count: number;
};

type ExportDialogProps = {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Status =
  | { kind: "idle" }
  | { kind: "picking" }
  | { kind: "exporting" }
  | { kind: "done"; result: ExportResult }
  | { kind: "error"; message: string };

export function ExportDialog({
  project,
  open,
  onOpenChange,
}: ExportDialogProps) {
  const [outputPath, setOutputPath] = useState<string>("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [ffmpegInfo, setFfmpegInfo] = useState<string | null>(null);
  const [ffmpegError, setFfmpegError] = useState<string | null>(null);

  const ordered = useMemo(() => {
    const scenes = [...project.scenes].sort((a, b) => a.index - b.index);
    const mediaById = new Map(project.mediaPool.map((m) => [m.id, m]));
    return scenes.map((s) => ({
      scene: s,
      media: s.videoMediaId ? mediaById.get(s.videoMediaId) : undefined,
    }));
  }, [project]);

  const withClips = ordered.filter((o) => o.media);
  const withoutClips = ordered.filter((o) => !o.media);

  useEffect(() => {
    if (!open) return;
    setStatus({ kind: "idle" });
    setFfmpegInfo(null);
    setFfmpegError(null);
    void (async () => {
      try {
        const info = await invoke<string>("ffmpeg_probe");
        setFfmpegInfo(info);
      } catch (e) {
        setFfmpegError(String(e));
      }
    })();
    // Default output path = sanitized project name in Downloads folder
    // (dialog save picker lets the user override).
    setOutputPath("");
  }, [open]);

  async function pickOutput() {
    setStatus({ kind: "picking" });
    try {
      const picked = await save({
        defaultPath: `${sanitize(project.name)}.mp4`,
        filters: [{ name: "MP4 video", extensions: ["mp4"] }],
      });
      if (picked) setOutputPath(picked);
    } catch (e) {
      setStatus({ kind: "error", message: `could not open save dialog: ${e}` });
      return;
    }
    setStatus({ kind: "idle" });
  }

  async function runExport() {
    if (!outputPath) {
      await pickOutput();
      return;
    }
    const clips = withClips
      .filter((o) => o.media)
      .map((o) => ({
        path: o.media!.path,
        trim_in_seconds: o.scene.trimInSeconds,
        trim_out_seconds: o.scene.trimOutSeconds,
      }));

    setStatus({ kind: "exporting" });
    try {
      const result = await invoke<ExportResult>("export_sequence", {
        args: { clips, output_path: outputPath },
      });
      setStatus({ kind: "done", result });
    } catch (e) {
      setStatus({ kind: "error", message: String(e) });
    }
  }

  function revealOutput() {
    if (status.kind !== "done") return;
    const parent = parentDir(status.result.output_path);
    openUrl(parent).catch(() => undefined);
  }

  const canExport =
    withClips.length > 0 &&
    Boolean(outputPath) &&
    status.kind !== "exporting" &&
    !ffmpegError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export sequence</DialogTitle>
          <DialogDescription>
            Merge every scene's attached clip, in scene order, into one mp4.
          </DialogDescription>
        </DialogHeader>

        {ffmpegError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-medium">ffmpeg not available</div>
                <div className="font-mono text-[11px] opacity-90">
                  {ffmpegError}
                </div>
                <div className="text-foreground/80 pt-1">
                  Install it:{" "}
                  <code className="font-mono bg-background/60 px-1 rounded">
                    brew install ffmpeg
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

        {ffmpegInfo && !ffmpegError && (
          <div className="rounded-md border border-border bg-muted/30 p-2 text-[11px] font-mono text-muted-foreground truncate">
            {ffmpegInfo}
          </div>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Will export
            </h3>
            <Badge variant="secondary">{withClips.length} clips</Badge>
          </div>
          {withClips.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              No scenes have an attached clip yet. Attach clips in the Scenes
              workspace first.
            </div>
          ) : (
            <ScrollArea className="max-h-48 rounded-md border border-border">
              <div className="divide-y divide-border">
                {withClips.map((o) => {
                  const trimmed =
                    o.scene.trimInSeconds !== undefined ||
                    o.scene.trimOutSeconds !== undefined;
                  return (
                    <div
                      key={o.scene.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs"
                    >
                      <code className="font-mono text-muted-foreground w-8 shrink-0">
                        #{o.scene.index.toString().padStart(2, "0")}
                      </code>
                      <FileVideo className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate flex-1" title={o.scene.title}>
                        {o.scene.title ?? "(no title)"}
                      </span>
                      {trimmed && (
                        <span className="text-[10px] font-mono text-primary">
                          [{o.scene.trimInSeconds ?? 0}s →{" "}
                          {o.scene.trimOutSeconds ?? "end"}]
                        </span>
                      )}
                      <span
                        className="text-[10px] font-mono text-muted-foreground truncate max-w-[16ch]"
                        title={o.media?.name}
                      >
                        {o.media?.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </section>

        {withoutClips.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-destructive/80">
                Skipped — no clip
              </h3>
              <Badge variant="destructive" className="opacity-80">
                {withoutClips.length}
              </Badge>
            </div>
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive/90 space-y-0.5">
              {withoutClips.map((o) => (
                <div key={o.scene.id} className="flex items-center gap-2">
                  <code className="font-mono w-8 shrink-0">
                    #{o.scene.index.toString().padStart(2, "0")}
                  </code>
                  <span className="truncate">
                    {o.scene.title ?? "(no title)"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <Separator />

        <section className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Output file
          </h3>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono truncate"
              title={outputPath}
            >
              {outputPath || "(pick a location)"}
            </div>
            <Button
              variant="secondary"
              onClick={pickOutput}
              disabled={status.kind === "exporting"}
            >
              <FolderOpen className="h-4 w-4" />
              Choose…
            </Button>
          </div>
        </section>

        {status.kind === "exporting" && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Merging {withClips.length} clips with ffmpeg… this blocks until
            done; several seconds per clip for a re-encode.
          </div>
        )}

        {status.kind === "done" && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Export complete — {status.result.clip_count} clips merged
            </div>
            <div className="font-mono text-[11px] text-muted-foreground break-all">
              {status.result.output_path}
            </div>
            <Button variant="secondary" size="sm" onClick={revealOutput}>
              <FolderOpen className="h-3.5 w-3.5" />
              Reveal folder
            </Button>
          </div>
        )}

        {status.kind === "error" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" />
              Export failed
            </div>
            <pre className="font-mono text-[11px] whitespace-pre-wrap break-all opacity-90 max-h-40 overflow-auto">
              {status.message}
            </pre>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={runExport} disabled={!canExport}>
            {status.kind === "exporting" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function sanitize(name: string): string {
  const trimmed = name.trim() || "sequence";
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function parentDir(path: string): string {
  const i = path.replace(/\\/g, "/").lastIndexOf("/");
  return i < 0 ? path : path.slice(0, i);
}
