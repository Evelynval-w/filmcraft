import { Button } from "@/components/ui/button";
import { Play, SkipBack, SkipForward } from "lucide-react";

export function Preview() {
  return (
    <div className="flex-1 flex flex-col bg-black/60 min-h-0">
      <div className="flex-1 flex items-center justify-center">
        <div className="aspect-video max-h-full max-w-full border border-border bg-black flex items-center justify-center text-muted-foreground">
          <span className="text-xs uppercase tracking-widest">
            no clip loaded
          </span>
        </div>
      </div>
      <div className="h-11 border-t border-border bg-background flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
            <Play className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          00:00:00:00 / 00:00:00:00
        </span>
        <div className="w-24" />
      </div>
    </div>
  );
}
