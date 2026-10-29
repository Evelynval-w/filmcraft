import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Film, Sparkles, Upload } from "lucide-react";
import { GenerateClipDialog } from "@/components/studio/GenerateClipDialog";
import { addMediaItem } from "@/stores/projects";
import type { MediaItem } from "@/types/project";

type MediaLibraryProps = {
  projectId: string;
  mediaPool: MediaItem[];
  onClipAdded: (clip: MediaItem) => void;
};

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

export function MediaLibrary({
  projectId,
  mediaPool,
  onClipAdded,
}: MediaLibraryProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const hasClips = mediaPool.length > 0;

  async function handleImport() {
    setImportError(null);
    try {
      const selection = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Video",
            extensions: ["mp4", "mov", "webm", "mkv", "m4v"],
          },
        ],
      });
      if (!selection) return;
      const path = selection as string;
      const item: MediaItem = {
        id: crypto.randomUUID(),
        name: basename(path),
        kind: "video",
        path,
        createdAt: new Date().toISOString(),
      };
      addMediaItem(projectId, item);
      onClipAdded(item);
    } catch (e) {
      setImportError(String(e));
    }
  }

  return (
    <aside className="w-72 shrink-0 border-r border-border flex flex-col bg-background">
      <div className="h-10 px-3 flex items-center justify-between border-b border-border gap-1">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Media
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={handleImport}
            title="Import a local .mp4"
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setDialogOpen(true)}
            title="Generate with Google Flow"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        {importError && (
          <div className="mx-2 mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] font-mono text-destructive break-words">
            {importError}
          </div>
        )}
        {!hasClips && (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4 gap-3">
            <Film className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">No clips yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>Import</strong> a local .mp4, or try{" "}
                <strong>Generate</strong> with Flow.
              </p>
            </div>
          </div>
        )}
        {hasClips && (
          <div className="p-2 space-y-2">
            {mediaPool.map((item) => (
              <ClipRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </ScrollArea>
      <GenerateClipDialog
        projectId={projectId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onClipAdded={onClipAdded}
      />
    </aside>
  );
}

function ClipRow({ item }: { item: MediaItem }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2 hover:border-primary/40 transition cursor-pointer">
      <div className="aspect-video rounded bg-gradient-to-br from-slate-800 to-slate-900 border border-border mb-2 flex items-center justify-center">
        <Film className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-xs font-medium truncate" title={item.name}>
        {item.name || "Untitled clip"}
      </div>
      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
        {item.durationSeconds ? `${item.durationSeconds}s` : "—"} · video
      </div>
    </div>
  );
}
