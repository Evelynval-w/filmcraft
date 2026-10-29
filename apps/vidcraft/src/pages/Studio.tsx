import { useEffect, useState } from "react";
import { StudioHeader } from "@/components/studio/StudioHeader";
import { MediaLibrary } from "@/components/studio/MediaLibrary";
import { Preview } from "@/components/studio/Preview";
import { Timeline } from "@/components/studio/Timeline";
import { Inspector } from "@/components/studio/Inspector";
import { CommandBar } from "@/components/studio/CommandBar";
import { BiblesWorkspace } from "@/components/ai-mcd/BiblesWorkspace";
import { ScenesWorkspace } from "@/components/ai-mcd/ScenesWorkspace";
import { Button } from "@/components/ui/button";
import { Book, Clapperboard, Film } from "lucide-react";
import { getProject } from "@/stores/projects";
import type { Project } from "@/types/project";

type StudioProps = {
  projectId: string;
  onBack: () => void;
};

type Workspace = "bibles" | "scenes" | "timeline";

export function Studio({ projectId, onBack }: StudioProps) {
  const [project, setProject] = useState<Project | undefined>(undefined);
  const [workspace, setWorkspace] = useState<Workspace>("bibles");

  useEffect(() => {
    setProject(getProject(projectId));
  }, [projectId]);

  function refreshProject() {
    setProject(getProject(projectId));
  }

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
        {workspace === "timeline" && (
          <>
            <MediaLibrary
              projectId={projectId}
              mediaPool={project?.mediaPool ?? []}
              onClipAdded={refreshProject}
            />
            <div className="flex-1 flex flex-col min-w-0">
              <Preview />
              <Timeline />
            </div>
            <Inspector />
          </>
        )}
      </div>
      <CommandBar />
    </div>
  );
}

function WorkspaceSwitcher({
  value,
  onChange,
  charactersCount,
  locationsCount,
  scenesCount,
}: {
  value: Workspace;
  onChange: (next: Workspace) => void;
  charactersCount: number;
  locationsCount: number;
  scenesCount: number;
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
    </div>
  );
}
