import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Download } from "lucide-react";
import type { InputMode } from "@/types/project";

const MODE_LABEL: Record<InputMode, string> = {
  "mcd-import": "AI MCD import",
  prompt: "Prompt only",
  script: "Custom script",
  voiceover: "Custom voiceover",
  "talking-head": "Talking head",
  avatar: "AI avatar",
  persona: "Persona",
};

type StudioHeaderProps = {
  projectName: string;
  inputMode?: InputMode;
  onBack: () => void;
};

export function StudioHeader({
  projectName,
  inputMode,
  onBack,
}: StudioHeaderProps) {
  return (
    <div className="h-16 border-b border-border px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
          Projects
        </Button>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <h1 className="font-medium truncate max-w-[32ch]">{projectName}</h1>
          {inputMode && (
            <Badge variant="secondary" className="uppercase text-[10px]">
              {MODE_LABEL[inputMode]}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
}
