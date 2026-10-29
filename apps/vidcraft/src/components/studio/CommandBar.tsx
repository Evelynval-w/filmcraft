import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { getProject } from "@/stores/projects";
import { getSettings } from "@/stores/settings";
import { buildContext } from "@/lib/dara/context";
import { DARA_SYSTEM_PROMPT, buildUserTurn } from "@/lib/dara/prompt";
import { callDara } from "@/lib/dara/client";
import { applyActions, type ActionOutcome } from "@/lib/dara/dispatcher";
import type { Workspace } from "@/lib/dara/actions";

const HINTS = [
  "add a scene at the kitchen with Dara at the window realizing the envelope is empty",
  "add a 32yo nigerian woman character named ADA with a plain wrapper, warm skin, no jewelry",
  "copy the scene image prompt for scene 2",
  "move scene 3 up",
];

type CommandBarProps = {
  projectId: string;
  onProjectChange: () => void;
  onSwitchWorkspace: (workspace: Workspace) => void;
};

type Turn = {
  id: string;
  userText: string;
  state: "running" | "done" | "error";
  outcomes?: ActionOutcome[];
  message?: string;
  errorText?: string;
};

export function CommandBar({
  projectId,
  onProjectChange,
  onSwitchWorkspace,
}: CommandBarProps) {
  const [value, setValue] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    const text = value.trim();
    if (!text || busy) return;
    const turnId = crypto.randomUUID();
    setValue("");
    setBusy(true);
    setTurns((prev) => [
      { id: turnId, userText: text, state: "running" },
      ...prev,
    ]);

    const settings = getSettings();
    const project = getProject(projectId);
    if (!project) {
      finishTurn(turnId, { state: "error", errorText: "project not found" });
      setBusy(false);
      return;
    }

    const context = buildContext(project);
    const result = await callDara({
      settings,
      systemPrompt: DARA_SYSTEM_PROMPT,
      userTurn: buildUserTurn(text, context),
    });

    if (!result.ok) {
      finishTurn(turnId, { state: "error", errorText: result.error });
      setBusy(false);
      return;
    }

    const outcomes = await applyActions(projectId, result.actions, {
      onProjectChange,
      switchWorkspace: onSwitchWorkspace,
      writeClipboard: async (payload) => {
        try {
          await navigator.clipboard.writeText(payload);
          return true;
        } catch {
          return false;
        }
      },
    });

    const message = result.actions
      .filter((a) => a.type === "message")
      .map((a) => (a.type === "message" ? a.text : ""))
      .join("\n")
      .trim();

    finishTurn(turnId, {
      state: "done",
      outcomes,
      message: message || undefined,
    });
    setBusy(false);
  }

  function finishTurn(id: string, patch: Partial<Turn>) {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  const placeholder = `Ask Dara — try "${HINTS[Math.floor(Math.random() * HINTS.length)]}"`;

  return (
    <div className="border-t border-border bg-background shrink-0">
      {turns.length > 0 && (
        <div className="px-4 py-2 max-h-48 overflow-y-auto border-b border-border bg-muted/20">
          {turns.map((turn) => (
            <TurnView key={turn.id} turn={turn} />
          ))}
        </div>
      )}
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
                void handleSubmit();
              }
            }}
            placeholder={placeholder}
            rows={1}
            disabled={busy}
            className="resize-none min-h-9"
          />
        </div>
        <Button
          onClick={() => void handleSubmit()}
          className="self-start"
          disabled={!value.trim() || busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send
        </Button>
      </div>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  return (
    <div className="py-1.5 text-xs space-y-1">
      <div className="flex items-start gap-2">
        <span className="text-muted-foreground shrink-0 font-mono">you ›</span>
        <span>{turn.userText}</span>
      </div>
      {turn.state === "running" && (
        <div className="flex items-center gap-2 text-muted-foreground pl-9">
          <Loader2 className="h-3 w-3 animate-spin" />
          thinking…
        </div>
      )}
      {turn.state === "error" && (
        <div className="flex items-start gap-2 text-destructive pl-9">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span className="font-mono text-[11px]">{turn.errorText}</span>
        </div>
      )}
      {turn.state === "done" && (
        <div className="pl-9 space-y-1">
          {turn.message && (
            <div className="text-foreground italic">{turn.message}</div>
          )}
          {turn.outcomes?.map((o, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 font-mono text-[11px] ${
                o.ok ? "text-muted-foreground" : "text-destructive"
              }`}
            >
              {o.ok ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
              ) : (
                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
              )}
              <span>{o.label}</span>
              {!o.ok && (
                <span className="text-destructive/80">— {o.error}</span>
              )}
            </div>
          ))}
          {turn.outcomes && turn.outcomes.length === 0 && !turn.message && (
            <div className="text-muted-foreground italic">
              Dara returned no actions.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
