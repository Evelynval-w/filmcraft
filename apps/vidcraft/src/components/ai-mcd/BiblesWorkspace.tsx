import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, User, MapPin, Lock } from "lucide-react";
import {
  BibleEntryDialog,
  type BibleEntryDraft,
  type BibleEntryKind,
} from "@/components/ai-mcd/BibleEntryDialog";
import {
  addCharacter,
  addLocation,
  deleteCharacter,
  deleteLocation,
  updateCharacter,
  updateLocation,
} from "@/stores/projects";
import type {
  CharacterEntry,
  LocationEntry,
  Project,
} from "@/types/project";

type BiblesWorkspaceProps = {
  project: Project;
  onProjectChange: () => void;
};

type EditingState =
  | { kind: BibleEntryKind; mode: "new" }
  | { kind: BibleEntryKind; mode: "edit"; id: string }
  | null;

export function BiblesWorkspace({
  project,
  onProjectChange,
}: BiblesWorkspaceProps) {
  const [editing, setEditing] = useState<EditingState>(null);

  function openNew(kind: BibleEntryKind) {
    setEditing({ kind, mode: "new" });
  }

  function openEdit(kind: BibleEntryKind, id: string) {
    setEditing({ kind, mode: "edit", id });
  }

  function handleSave(draft: BibleEntryDraft) {
    if (!editing) return;
    const now = new Date().toISOString();
    if (editing.kind === "character") {
      if (editing.mode === "new") {
        const entry: CharacterEntry = {
          id: crypto.randomUUID(),
          tagName: draft.tagName.trim(),
          verbatimSummary: draft.verbatimSummary.trim(),
          negativeList: draft.negativeList.trim(),
          approved: draft.approved,
          approvedImagePath: draft.imagePath,
          createdAt: now,
          updatedAt: now,
        };
        addCharacter(project.id, entry);
      } else {
        updateCharacter(project.id, editing.id, {
          tagName: draft.tagName.trim(),
          verbatimSummary: draft.verbatimSummary.trim(),
          negativeList: draft.negativeList.trim(),
          approved: draft.approved,
          approvedImagePath: draft.imagePath,
        });
      }
    } else {
      if (editing.mode === "new") {
        const entry: LocationEntry = {
          id: crypto.randomUUID(),
          tagName: draft.tagName.trim(),
          verbatimSummary: draft.verbatimSummary.trim(),
          negativeList: draft.negativeList.trim(),
          approved: draft.approved,
          masterSceneImagePath: draft.imagePath,
          createdAt: now,
          updatedAt: now,
        };
        addLocation(project.id, entry);
      } else {
        updateLocation(project.id, editing.id, {
          tagName: draft.tagName.trim(),
          verbatimSummary: draft.verbatimSummary.trim(),
          negativeList: draft.negativeList.trim(),
          approved: draft.approved,
          masterSceneImagePath: draft.imagePath,
        });
      }
    }
    onProjectChange();
  }

  function handleDelete() {
    if (!editing || editing.mode !== "edit") return;
    if (editing.kind === "character") {
      deleteCharacter(project.id, editing.id);
    } else {
      deleteLocation(project.id, editing.id);
    }
    onProjectChange();
  }

  const initial: BibleEntryDraft | undefined =
    editing?.mode === "edit"
      ? (() => {
          if (editing.kind === "character") {
            const source = (project.bibles?.characters ?? []).find(
              (c) => c.id === editing.id,
            );
            if (!source) return undefined;
            return {
              id: source.id,
              tagName: source.tagName,
              verbatimSummary: source.verbatimSummary,
              negativeList: source.negativeList,
              approved: source.approved,
              imagePath: source.approvedImagePath,
            };
          }
          const source = (project.bibles?.locations ?? []).find(
            (l) => l.id === editing.id,
          );
          if (!source) return undefined;
          return {
            id: source.id,
            tagName: source.tagName,
            verbatimSummary: source.verbatimSummary,
            negativeList: source.negativeList,
            approved: source.approved,
            imagePath: source.masterSceneImagePath,
          };
        })()
      : undefined;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Tabs defaultValue="characters" className="flex-1 flex flex-col min-h-0">
        <div className="h-11 border-b border-border px-4 flex items-center justify-between shrink-0">
          <TabsList>
            <TabsTrigger value="characters" className="gap-2">
              <User className="h-4 w-4" />
              Characters
              <Badge variant="secondary" className="text-[10px]">
                {project.bibles?.characters?.length ?? 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="locations" className="gap-2">
              <MapPin className="h-4 w-4" />
              Locations
              <Badge variant="secondary" className="text-[10px]">
                {project.bibles?.locations?.length ?? 0}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="characters"
          className="flex-1 min-h-0 overflow-hidden m-0"
        >
          <EntryGrid
            kind="character"
            entries={project.bibles?.characters ?? []}
            onNew={() => openNew("character")}
            onEdit={(id) => openEdit("character", id)}
          />
        </TabsContent>

        <TabsContent
          value="locations"
          className="flex-1 min-h-0 overflow-hidden m-0"
        >
          <EntryGrid
            kind="location"
            entries={project.bibles?.locations ?? []}
            onNew={() => openNew("location")}
            onEdit={(id) => openEdit("location", id)}
          />
        </TabsContent>
      </Tabs>

      {editing && (
        <BibleEntryDialog
          kind={editing.kind}
          open={true}
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
          initial={initial}
          onSave={handleSave}
          onDelete={editing.mode === "edit" ? handleDelete : undefined}
        />
      )}
    </div>
  );
}

type Entry = CharacterEntry | LocationEntry;

function EntryGrid({
  kind,
  entries,
  onNew,
  onEdit,
}: {
  kind: BibleEntryKind;
  entries: Entry[];
  onNew: () => void;
  onEdit: (id: string) => void;
}) {
  const label = kind === "character" ? "character" : "location";
  const Icon = kind === "character" ? User : MapPin;

  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium capitalize">
              {kind === "character" ? "Characters" : "Locations"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {kind === "character"
                ? "One locked identity per character. Wardrobe + props inline."
                : "One locked place. Verbatim summary feeds every Scene Image."}
            </p>
          </div>
          <Button onClick={onNew}>
            <Plus className="h-4 w-4" />
            Add {label}
          </Button>
        </div>

        {entries.length === 0 && (
          <div className="border border-dashed border-border rounded-xl py-16 text-center">
            <Icon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No {label}s yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add one to start locking your Bible.
            </p>
          </div>
        )}

        {entries.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {entries.map((e) => (
              <EntryCard key={e.id} entry={e} onClick={() => onEdit(e.id)} />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function EntryCard({
  entry,
  onClick,
}: {
  entry: Entry;
  onClick: () => void;
}) {
  const imagePath =
    (entry as CharacterEntry).approvedImagePath ??
    (entry as LocationEntry).masterSceneImagePath;
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition cursor-pointer flex gap-3"
    >
      <div className="h-20 w-20 shrink-0 rounded-md bg-muted/40 border border-border overflow-hidden flex items-center justify-center">
        {imagePath ? (
          <img
            src={convertFileSrc(imagePath)}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="text-[10px] text-muted-foreground">no image</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <code className="text-sm font-mono font-semibold truncate">
            {entry.tagName || "(no tag)"}
          </code>
          {entry.approved && (
            <Badge variant="secondary" className="gap-1 text-[10px] shrink-0">
              <Lock className="h-3 w-3" />
              locked
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-3">
          {entry.verbatimSummary || "(no verbatim summary)"}
        </p>
      </div>
    </button>
  );
}
