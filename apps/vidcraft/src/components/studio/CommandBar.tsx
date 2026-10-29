import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles } from "lucide-react";

const HINTS = [
  "add a scene at the kitchen with Dara talking to the father",
  "trim the last clip by 2 seconds",
  "swap scene 3 with a new take, same prompt",
  "regenerate the opening with golden-hour lighting",
];

export function CommandBar() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  function handleSubmit() {
    const text = value.trim();
    if (!text) return;
    setStatus(`"${text}" — Rush Agent lands in Phase 6; nothing was executed.`);
    setValue("");
  }

  return (
    <div className="border-t border-border bg-background shrink-0">
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex items-center gap-2 pt-2">
          <Sparkles className="h-4 w-4" />
          <Badge variant="secondary" className="text-[10px] uppercase">
            Dara
          </Badge>
        </div>
        <div className="flex-1">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={`Ask Dara — try "${HINTS[0]}"`}
            rows={1}
            className="resize-none min-h-9"
          />
          {status && (
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              {status}
            </p>
          )}
        </div>
        <Button onClick={handleSubmit} className="self-start" disabled={!value.trim()}>
          <Send className="h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
}
