import { ScrollArea } from "@/components/ui/scroll-area";
import { MousePointer2 } from "lucide-react";

export function Inspector() {
  return (
    <aside className="w-80 shrink-0 border-l border-border flex flex-col bg-background">
      <div className="h-10 px-4 flex items-center border-b border-border">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Inspector
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 gap-3">
          <MousePointer2 className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Nothing selected</p>
            <p className="text-xs text-muted-foreground mt-1">
              Select a clip on the timeline to edit its properties.
            </p>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
