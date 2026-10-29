import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Clapperboard, Trash2 } from "lucide-react";
import { deleteProject, listProjects } from "@/stores/projects";
import type { Project, InputMode } from "@/types/project";

const MODE_LABEL: Record<InputMode, string> = {
  "mcd-import": "AI MCD",
  prompt: "Prompt",
  script: "Script",
  voiceover: "Voiceover",
  "talking-head": "Talking head",
  avatar: "Avatar",
  persona: "Persona",
};

type HomeProps = {
  onOpenProject: (projectId: string) => void;
  onNewProject: () => void;
};

export function Home({ onOpenProject, onNewProject }: HomeProps) {
  const [projects, setProjects] = useState<Project[]>(() => listProjects());
  const hasProjects = projects.length > 0;

  function handleDelete(id: string) {
    deleteProject(id);
    setProjects(listProjects());
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Open a video to continue editing, or start a new one.
          </p>
        </div>
        <Button onClick={onNewProject}>
          <Plus className="h-4 w-4" />
          New project
        </Button>
      </div>

      {!hasProjects && <EmptyState onNewProject={onNewProject} />}

      {hasProjects && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => onOpenProject(p.id)}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState(props: { onNewProject: () => void }) {
  return (
    <div className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center py-24 gap-4">
      <Clapperboard className="h-10 w-10 text-muted-foreground" />
      <div>
        <h2 className="text-lg font-medium">No projects yet</h2>
        <p className="text-muted-foreground text-sm mt-1 max-w-sm">
          Start your first video. Import from an AI MCD scene plan, write a
          prompt, or paste a script.
        </p>
      </div>
      <Button onClick={props.onNewProject}>
        <Plus className="h-4 w-4" />
        New project
      </Button>
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const confirmTimeout = useRef<number | null>(null);
  const updated = new Date(project.updatedAt);

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm) {
      setConfirm(true);
      if (confirmTimeout.current) window.clearTimeout(confirmTimeout.current);
      confirmTimeout.current = window.setTimeout(() => setConfirm(false), 3000);
      return;
    }
    if (confirmTimeout.current) window.clearTimeout(confirmTimeout.current);
    onDelete();
  }

  return (
    <Card
      className="group relative cursor-pointer hover:border-primary/40 transition"
      onClick={onOpen}
    >
      <button
        onClick={handleDeleteClick}
        aria-label={confirm ? "Click again to delete" : "Delete project"}
        className={`absolute top-2 right-2 z-10 h-7 rounded-md border transition flex items-center gap-1 px-2 text-[11px] font-medium ${
          confirm
            ? "border-destructive bg-destructive text-destructive-foreground opacity-100"
            : "border-border bg-background/80 backdrop-blur text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:border-destructive/40"
        }`}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {confirm ? "Click again" : ""}
      </button>
      <CardHeader>
        <CardTitle className="truncate pr-10">{project.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="aspect-video rounded-md bg-gradient-to-br from-slate-800 to-slate-900 border border-border" />
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground truncate">
          {updated.toLocaleString()}
        </p>
        {project.inputMode && (
          <Badge variant="secondary" className="text-[10px] uppercase">
            {MODE_LABEL[project.inputMode]}
          </Badge>
        )}
      </CardFooter>
    </Card>
  );
}
