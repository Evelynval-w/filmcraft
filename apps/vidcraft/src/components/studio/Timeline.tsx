import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Film, Unlink2 } from "lucide-react";
import type { Project, Scene, MediaItem } from "@/types/project";

type TimelineProps = {
  project: Project;
  selectedSceneId: string | undefined;
  onSelect: (sceneId: string) => void;
  onUnlinkClip: (sceneId: string) => void;
  onExport: () => void;
};

/**
 * Scene-driven timeline. The sequence of scenes IS the sequence of clips.
 * Each scene renders as a tile ordered by scene.index; tiles with a linked
 * videoMediaId are filled, ones without are ghosted so you see holes in the
 * assembly. Click a tile to select — the Preview panel loads that clip.
 */
export function Timeline({
  project,
  selectedSceneId,
  onSelect,
  onUnlinkClip,
  onExport,
}: TimelineProps) {
  const scenes = [...project.scenes].sort((a, b) => a.index - b.index);
  const mediaById = new Map(project.mediaPool.map((m) => [m.id, m]));
  const clipsCount = scenes.filter((s) => s.videoMediaId).length;

  return (
    <div className="h-56 border-t border-border bg-background shrink-0 flex flex-col">
      <div className="h-9 border-b border-border px-4 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-2">
          <Film className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Timeline — V1
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {scenes.length} scenes · {clipsCount} clips
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            scene order drives the sequence
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="h-7"
            onClick={onExport}
            disabled={clipsCount === 0}
            title={
              clipsCount === 0
                ? "Attach at least one clip to export"
                : "Merge all clips into one mp4"
            }
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {scenes.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="h-full flex items-center gap-2 p-3 min-w-min">
            {scenes.map((scene) => (
              <ClipTile
                key={scene.id}
                scene={scene}
                media={
                  scene.videoMediaId
                    ? mediaById.get(scene.videoMediaId)
                    : undefined
                }
                selected={scene.id === selectedSceneId}
                onSelect={() => onSelect(scene.id)}
                onUnlink={() => onUnlinkClip(scene.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
      <Film className="h-6 w-6" />
      <p className="text-xs">
        No scenes yet. Create scenes in the Scenes workspace, attach a clip to
        each, and they'll show up here in order.
      </p>
    </div>
  );
}

function ClipTile({
  scene,
  media,
  selected,
  onSelect,
  onUnlink,
}: {
  scene: Scene;
  media: MediaItem | undefined;
  selected: boolean;
  onSelect: () => void;
  onUnlink: () => void;
}) {
  const hasClip = Boolean(media);
  return (
    <div
      className={`relative shrink-0 w-40 h-32 rounded-md border-2 cursor-pointer transition flex flex-col ${
        selected
          ? "border-primary"
          : hasClip
            ? "border-border hover:border-primary/40"
            : "border-dashed border-border/60 hover:border-border"
      } ${hasClip ? "bg-slate-900/60" : "bg-muted/20"}`}
      onClick={onSelect}
    >
      <div className="h-5 px-2 flex items-center justify-between shrink-0">
        <code className="text-[10px] font-mono text-muted-foreground">
          #{scene.index.toString().padStart(2, "0")}
        </code>
        {hasClip && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onUnlink();
            }}
            aria-label="Unlink clip from this scene"
            title="Unlink clip (keeps the media in the pool)"
          >
            <Unlink2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden px-2">
        {hasClip ? (
          <Film className="h-5 w-5 text-muted-foreground" />
        ) : (
          <span className="text-[10px] text-muted-foreground text-center">
            no clip attached
          </span>
        )}
      </div>
      <div className="h-10 px-2 py-1 border-t border-border/50 shrink-0">
        <div className="flex items-center gap-1">
          <div
            className="text-[11px] font-medium truncate flex-1"
            title={scene.title ?? "(no title)"}
          >
            {scene.title ?? "(no title)"}
          </div>
          {(scene.trimInSeconds !== undefined ||
            scene.trimOutSeconds !== undefined) && (
            <span
              className="text-[9px] px-1 rounded bg-primary/20 text-primary font-mono shrink-0"
              title={`Trimmed: ${scene.trimInSeconds ?? 0}s → ${
                scene.trimOutSeconds ?? "end"
              }`}
            >
              trim
            </span>
          )}
        </div>
        <div
          className="text-[9px] text-muted-foreground truncate font-mono"
          title={media?.name}
        >
          {media?.name ?? "—"}
        </div>
      </div>
    </div>
  );
}
