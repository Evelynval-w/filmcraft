import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  FolderInput,
  Sparkles,
  FileText,
  Mic,
  User,
  UserCircle2,
  Drama,
  type LucideIcon,
} from "lucide-react";
import { createProject } from "@/stores/projects";
import type { InputMode } from "@/types/project";

type ModeDef = {
  id: InputMode;
  title: string;
  description: string;
  icon: LucideIcon;
  recommended?: boolean;
};

const MODES: ModeDef[] = [
  {
    id: "mcd-import",
    title: "Import from AI MCD",
    description:
      "Open a scene plan built with the AI MCD methodology. Characters, locations, and image-to-video prompts come in pre-built.",
    icon: FolderInput,
    recommended: true,
  },
  {
    id: "prompt",
    title: "Prompt only",
    description:
      "Describe what you want. Script, voice, visuals, and assembly all generated.",
    icon: Sparkles,
  },
  {
    id: "script",
    title: "Custom script",
    description:
      "Paste your script. Voice, visuals, and assembly handled from there.",
    icon: FileText,
  },
  {
    id: "voiceover",
    title: "Custom voiceover",
    description: "Upload a voice track. Visuals written around it.",
    icon: Mic,
  },
  {
    id: "talking-head",
    title: "Talking head",
    description:
      "Upload footage of yourself talking. B-roll cut in automatically.",
    icon: User,
  },
  {
    id: "avatar",
    title: "AI avatar",
    description: "Pick a stock presenter, or build one from a single photo.",
    icon: UserCircle2,
  },
  {
    id: "persona",
    title: "Persona",
    description:
      "Avatar-led, fully generated footage. Pair with a custom script.",
    icon: Drama,
  },
];

type NewProjectProps = {
  onCreated: (projectId: string) => void;
  onCancel: () => void;
};

export function NewProject({ onCreated, onCancel }: NewProjectProps) {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  function handlePick(mode: InputMode) {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(true);
      nameRef.current?.focus();
      return;
    }
    const project = createProject(trimmed, mode);
    onCreated(project.id);
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <Button variant="ghost" onClick={onCancel} className="mb-6">
        <ChevronLeft className="h-4 w-4" />
        Back to projects
      </Button>

      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        New project
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        Name your video, then pick where it starts.
      </p>

      <div className="mb-10 max-w-md">
        <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
          Project name
        </label>
        <Input
          ref={nameRef}
          placeholder="Untitled project"
          value={name}
          onChange={(e) => {
            setName(e.currentTarget.value);
            if (nameError) setNameError(false);
          }}
          aria-invalid={nameError}
          className={nameError ? "border-destructive" : undefined}
          autoFocus
        />
        {nameError && (
          <p className="text-destructive text-xs mt-2">
            Give the project a name before picking a mode.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">
          Start from
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODES.map((m) => (
            <ModeCard key={m.id} mode={m} onPick={() => handlePick(m.id)} />
          ))}
        </div>
      </div>
    </main>
  );
}

function ModeCard({ mode, onPick }: { mode: ModeDef; onPick: () => void }) {
  const Icon = mode.icon;
  return (
    <Card
      onClick={onPick}
      className={`cursor-pointer transition hover:border-primary/60 ${
        mode.recommended ? "border-primary/40" : ""
      }`}
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Icon className="h-6 w-6" />
          {mode.recommended && (
            <Badge variant="secondary" className="text-[10px] uppercase">
              recommended for you
            </Badge>
          )}
        </div>
        <div>
          <div className="font-medium">{mode.title}</div>
          <p className="text-muted-foreground text-sm mt-1">
            {mode.description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
