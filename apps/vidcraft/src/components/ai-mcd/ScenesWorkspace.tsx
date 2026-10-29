import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Clapperboard, ChevronUp, ChevronDown } from "lucide-react";
import {
  SceneDialog,
  type SceneDraft,
} from "@/components/ai-mcd/SceneDialog";
import {
  addMediaItem,
  addScene,
  deleteScene,
  reorderScene,
  updateScene,
} from "@/stores/projects";
import type { MediaItem, Project, Scene } from "@/types/project";

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

type ScenesWorkspaceProps = {
  project: Project;
  onProjectChange: () => void;
};

type Editing = { mode: "new" } | { mode: "edit"; id: string } | null;

export function ScenesWorkspace({
  project,
  onProjectChange,
}: ScenesWorkspaceProps) {
  const [editing, setEditing] = useState<Editing>(null);

  function handleSave(draft: SceneDraft) {
    if (!editing) return;
    const now = new Date().toISOString();
    if (editing.mode === "new") {
      addScene(project.id, {
        id: crypto.randomUUID(),
        title: draft.title.trim() || undefined,
        beat: draft.beat.trim() || undefined,
        characterIds: draft.characterIds,
        locationId: draft.locationId,
        shotDescription: draft.shotDescription.trim(),
        negativeAdditions: draft.negativeAdditions.trim(),
        sceneImagePath: draft.sceneImagePath,
        videoMediaId: draft.videoMediaId,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      updateScene(project.id, editing.id, {
        title: draft.title.trim() || undefined,
        beat: draft.beat.trim() || undefined,
        characterIds: draft.characterIds,
        locationId: draft.locationId,
        shotDescription: draft.shotDescription.trim(),
        negativeAdditions: draft.negativeAdditions.trim(),
        sceneImagePath: draft.sceneImagePath,
        videoMediaId: draft.videoMediaId,
      });
    }
    onProjectChange();
  }

  function handleImportVideo(path: string): MediaItem | undefined {
    const item: MediaItem = {
      id: crypto.randomUUID(),
      name: basename(path),
      kind: "video",
      path,
      createdAt: new Date().toISOString(),
    };
    addMediaItem(project.id, item);
    onProjectChange();
    return item;
  }

  function handleDelete() {
    if (!editing || editing.mode !== "edit") return;
    deleteScene(project.id, editing.id);
    onProjectChange();
  }

  function handleReorder(id: string, direction: "up" | "down") {
    reorderScene(project.id, id, direction);
    onProjectChange();
  }

  const sortedScenes = [...(project.scenes ?? [])].sort(
    (a, b) => a.index - b.index,
  );

  const initial: (SceneDraft & { index?: number }) | undefined =
    editing?.mode === "edit"
      ? (() => {
          const s = sortedScenes.find((x) => x.id === editing.id);
          if (!s) return undefined;
          return {
            id: s.id,
            index: s.index,
            title: s.title ?? "",
            beat: s.beat ?? "",
            characterIds: s.characterIds,
            locationId: s.locationId,
            shotDescription: s.shotDescription,
            negativeAdditions: s.negativeAdditions,
            sceneImagePath: s.sceneImagePath,
            videoMediaId: s.videoMediaId,
          };
        })()
      : undefined;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-lg font-medium">Scenes</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ordered. Each scene composes a Scene Image prompt from the
                tagged Bibles.
              </p>
            </div>
            <Button onClick={() => setEditing({ mode: "new" })}>
              <Plus className="h-4 w-4" />
              Add scene
            </Button>
          </div>

          {sortedScenes.length === 0 && (
            <div className="border border-dashed border-border rounded-xl py-16 text-center">
              <Clapperboard className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No scenes yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Lock a few Bible entries first, then add your first scene.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {sortedScenes.map((scene, i) => (
              <SceneRow
                key={scene.id}
                scene={scene}
                project={project}
                isFirst={i === 0}
                isLast={i === sortedScenes.length - 1}
                onEdit={() => setEditing({ mode: "edit", id: scene.id })}
                onReorder={(direction) => handleReorder(scene.id, direction)}
              />
            ))}
          </div>
        </div>
      </ScrollArea>

      {editing && (
        <SceneDialog
          bibles={project.bibles}
          mediaPool={project.mediaPool ?? []}
          open={true}
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
          initial={initial}
          onSave={handleSave}
          onDelete={editing.mode === "edit" ? handleDelete : undefined}
          onImportVideo={handleImportVideo}
        />
      )}
    </div>
  );
}

function SceneRow({
  scene,
  project,
  isFirst,
  isLast,
  onEdit,
  onReorder,
}: {
  scene: Scene;
  project: Project;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onReorder: (direction: "up" | "down") => void;
}) {
  const chars = scene.characterIds
    .map((id) => project.bibles.characters.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const loc = scene.locationId
    ? project.bibles.locations.find((l) => l.id === scene.locationId)
    : undefined;

  return (
    <div className="flex items-stretch gap-2">
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={isFirst}
          onClick={() => onReorder("up")}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={isLast}
          onClick={() => onReorder("down")}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
      <button
        onClick={onEdit}
        className="flex-1 text-left rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition cursor-pointer"
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <code className="font-mono text-xs text-muted-foreground">
              #{scene.index.toString().padStart(2, "0")}
            </code>
            <span className="font-medium truncate">
              {scene.title || "(no title)"}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {scene.sceneImagePath && (
              <Badge variant="secondary" className="text-[10px]">
                keyframe
              </Badge>
            )}
            {scene.videoMediaId && (
              <Badge variant="secondary" className="text-[10px]">
                clip
              </Badge>
            )}
          </div>
        </div>
        {scene.beat && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {scene.beat}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {chars.map((c) => (
            <Badge
              key={c.id}
              variant="secondary"
              className="text-[10px] font-mono"
            >
              {c.tagName}
            </Badge>
          ))}
          {loc && (
            <Badge
              variant="secondary"
              className="text-[10px] font-mono bg-muted/60"
            >
              @ {loc.tagName}
            </Badge>
          )}
        </div>
      </button>
    </div>
  );
}
