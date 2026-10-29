import { useEffect, useMemo, useState } from "react";
import { StudioHeader } from "@/components/studio/StudioHeader";
import { MediaLibrary } from "@/components/studio/MediaLibrary";
import { Preview } from "@/components/studio/Preview";
import { Timeline } from "@/components/studio/Timeline";
import { Inspector } from "@/components/studio/Inspector";
import { CommandBar } from "@/components/studio/CommandBar";
import { BiblesWorkspace } from "@/components/ai-mcd/BiblesWorkspace";
import { ScenesWorkspace } from "@/components/ai-mcd/ScenesWorkspace";
import { MCDImportDialog } from "@/components/ai-mcd/MCDImportDialog";
import { ExportDialog } from "@/components/studio/ExportDialog";
import { Button } from "@/components/ui/button";
import { Book, Clapperboard, Film, FolderInput } from "lucide-react";
import { getProject, updateScene } from "@/stores/projects";
import type { Project } from "@/types/project";

type StudioProps = {
  projectId: string;
  onBack: () => void;
};

type Workspace = "bibles" | "scenes" | "timeline";

export function Studio({ projectId, onBack }: StudioProps) {
  const [project, setProject] = useState<Project | undefined>(undefined);
  const [workspace, setWorkspace] = useState<Workspace>("bibles");
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    setProject(getProject(projectId));
  }, [projectId]);

  function refreshProject() {
    setProject(getProject(projectId));
  }

  const sortedScenes = useMemo(
    () =>
      project ? [...project.scenes].sort((a, b) => a.index - b.index) : [],
    [project],
  );

  // Default-select the first scene with a clip whenever we enter the timeline.
  useEffect(() => {
    if (workspace !== "timeline") return;
    if (selectedSceneId) {
      const stillExists = sortedScenes.some((s) => s.id === selectedSceneId);
      if (stillExists) return;
    }
    const firstWithClip = sortedScenes.find((s) => s.videoMediaId);
    if (firstWithClip) {
      setSelectedSceneId(firstWithClip.id);
    } else if (sortedScenes.length > 0) {
      setSelectedSceneId(sortedScenes[0].id);
    } else {
      setSelectedSceneId(undefined);
    }
  }, [workspace, sortedScenes, selectedSceneId]);

  const selectedScene = sortedScenes.find((s) => s.id === selectedSceneId);
  const selectedMedia =
    selectedScene?.videoMediaId && project
      ? project.mediaPool.find((m) => m.id === selectedScene.videoMediaId)
      : undefined;

  function selectAdjacent(direction: 1 | -1) {
    if (!selectedScene) return;
    const i = sortedScenes.findIndex((s) => s.id === selectedScene.id);
    if (i < 0) return;
    for (
      let k = i + direction;
      k >= 0 && k < sortedScenes.length;
      k += direction
    ) {
      if (sortedScenes[k].videoMediaId) {
        setSelectedSceneId(sortedScenes[k].id);
        return;
      }
    }
  }

  function handleUnlinkClip(sceneId: string) {
    updateScene(projectId, sceneId, {
      videoMediaId: undefined,
      trimInSeconds: undefined,
      trimOutSeconds: undefined,
    });
    refreshProject();
  }

  function handleTrimChange(patch: {
    trimInSeconds?: number;
    trimOutSeconds?: number;
  }) {
    if (!selectedScene) return;
    updateScene(projectId, selectedScene.id, patch);
    refreshProject();
  }

  const showMCDImport = project?.inputMode === "mcd-import";
  const nextWithClip = selectedScene
    ? sortedScenes
        .slice(sortedScenes.findIndex((s) => s.id === selectedScene.id) + 1)
        .find((s) => s.videoMediaId)
    : undefined;
  const prevWithClip = selectedScene
    ? [...sortedScenes]
        .slice(0, sortedScenes.findIndex((s) => s.id === selectedScene.id))
        .reverse()
        .find((s) => s.videoMediaId)
    : undefined;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <StudioHeader
        projectName={project?.name ?? "Project"}
        inputMode={project?.inputMode}
        onBack={onBack}
      />
      <WorkspaceSwitcher
        value={workspace}
        onChange={setWorkspace}
        charactersCount={project?.bibles?.characters?.length ?? 0}
        locationsCount={project?.bibles?.locations?.length ?? 0}
        scenesCount={project?.scenes?.length ?? 0}
        showImportButton={showMCDImport}
        onImport={() => setImportOpen(true)}
      />
      <div className="flex-1 flex min-h-0">
        {workspace === "bibles" && project && (
          <BiblesWorkspace
            project={project}
            onProjectChange={refreshProject}
          />
        )}
        {workspace === "scenes" && project && (
          <ScenesWorkspace
            project={project}
            onProjectChange={refreshProject}
          />
        )}
        {workspace === "timeline" && project && (
          <>
            <MediaLibrary
              projectId={projectId}
              mediaPool={project.mediaPool}
              onClipAdded={refreshProject}
              onClipRemoved={refreshProject}
            />
            <div className="flex-1 flex flex-col min-w-0">
              <Preview
                scene={selectedScene}
                media={selectedMedia}
                onPrev={prevWithClip ? () => selectAdjacent(-1) : undefined}
                onNext={nextWithClip ? () => selectAdjacent(1) : undefined}
                onTrimChange={handleTrimChange}
              />
              <Timeline
                project={project}
                selectedSceneId={selectedSceneId}
                onSelect={setSelectedSceneId}
                onUnlinkClip={handleUnlinkClip}
                onExport={() => setExportOpen(true)}
              />
            </div>
            <Inspector />
          </>
        )}
      </div>
      <CommandBar
        projectId={projectId}
        onProjectChange={refreshProject}
        onSwitchWorkspace={setWorkspace}
      />
      {importOpen && (
        <MCDImportDialog
          projectId={projectId}
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={refreshProject}
        />
      )}
      {exportOpen && project && (
        <ExportDialog
          project={project}
          open={exportOpen}
          onOpenChange={setExportOpen}
        />
      )}
    </div>
  );
}

function WorkspaceSwitcher({
  value,
  onChange,
  charactersCount,
  locationsCount,
  scenesCount,
  showImportButton,
  onImport,
}: {
  value: Workspace;
  onChange: (next: Workspace) => void;
  charactersCount: number;
  locationsCount: number;
  scenesCount: number;
  showImportButton: boolean;
  onImport: () => void;
}) {
  return (
    <div className="h-10 border-b border-border px-4 flex items-center gap-1 shrink-0 bg-background">
      <Button
        variant={value === "bibles" ? "secondary" : "ghost"}
        size="sm"
        className="h-7"
        onClick={() => onChange("bibles")}
      >
        <Book className="h-3.5 w-3.5" />
        Bibles
        <span className="text-muted-foreground text-[10px] font-mono ml-1">
          {charactersCount + locationsCount}
        </span>
      </Button>
      <Button
        variant={value === "scenes" ? "secondary" : "ghost"}
        size="sm"
        className="h-7"
        onClick={() => onChange("scenes")}
      >
        <Clapperboard className="h-3.5 w-3.5" />
        Scenes
        <span className="text-muted-foreground text-[10px] font-mono ml-1">
          {scenesCount}
        </span>
      </Button>
      <Button
        variant={value === "timeline" ? "secondary" : "ghost"}
        size="sm"
        className="h-7"
        onClick={() => onChange("timeline")}
      >
        <Film className="h-3.5 w-3.5" />
        Timeline
      </Button>
      {showImportButton && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 ml-auto"
          onClick={onImport}
        >
          <FolderInput className="h-3.5 w-3.5" />
          Import AI MCD
        </Button>
      )}
    </div>
  );
}
