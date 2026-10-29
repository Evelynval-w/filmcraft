import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  MCD_EXAMPLE,
  parseMCDPaste,
  type MCDImportResult,
} from "@/lib/ai-mcd/mcd-import";
import { importMCD, type MCDImportReport } from "@/stores/projects";

type MCDImportDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

export function MCDImportDialog({
  projectId,
  open,
  onOpenChange,
  onImported,
}: MCDImportDialogProps) {
  const [paste, setPaste] = useState("");
  const [report, setReport] = useState<MCDImportReport | null>(null);

  const parsed: MCDImportResult = useMemo(() => parseMCDPaste(paste), [paste]);
  const nothing =
    parsed.characters.length === 0 &&
    parsed.locations.length === 0 &&
    parsed.scenes.length === 0;

  function handleImport() {
    const r = importMCD(projectId, parsed);
    if (r) {
      setReport(r);
      onImported();
    }
  }

  function handleClose(next: boolean) {
    if (!next) {
      setPaste("");
      setReport(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import from AI MCD</DialogTitle>
          <DialogDescription>
            Paste your AI MCD session output (characters, locations, scene
            breakdown) using the labeled-section format. Entries land in the
            bibles unlocked so you can review before approving.
          </DialogDescription>
        </DialogHeader>

        {report ? (
          <ImportReportView
            report={report}
            onDone={() => handleClose(false)}
          />
        ) : (
          <ImportForm
            paste={paste}
            setPaste={setPaste}
            parsed={parsed}
            nothing={nothing}
            onImport={handleImport}
            onCancel={() => handleClose(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({
  paste,
  setPaste,
  parsed,
  nothing,
  onImport,
  onCancel,
}: {
  paste: string;
  setPaste: (v: string) => void;
  parsed: MCDImportResult;
  nothing: boolean;
  onImport: () => void;
  onCancel: () => void;
}) {
  const canImport = !nothing && parsed.errors.length === 0;

  return (
    <>
      <div className="grid grid-cols-[1fr_280px] gap-4 min-h-0">
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Paste
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPaste(MCD_EXAMPLE)}
            >
              Fill example
            </Button>
          </div>
          <Textarea
            value={paste}
            onChange={(e) => setPaste(e.currentTarget.value)}
            placeholder={PLACEHOLDER}
            className="font-mono text-xs min-h-[420px] resize-none"
          />
        </div>

        <div className="flex flex-col gap-3 min-h-0">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Preview
          </span>
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <PreviewRow label="Characters" count={parsed.characters.length} />
            <PreviewRow label="Locations" count={parsed.locations.length} />
            <PreviewRow label="Scenes" count={parsed.scenes.length} />
          </div>

          {parsed.errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-destructive text-xs font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                {parsed.errors.length} parse
                {parsed.errors.length === 1 ? " error" : " errors"}
              </div>
              <ul className="text-[11px] text-destructive/80 space-y-1 max-h-32 overflow-auto">
                {parsed.errors.map((err, i) => (
                  <li key={i} className="font-mono">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-md border border-border bg-background p-3 text-[11px] text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Format cheat sheet</p>
            <p>
              <code className="font-mono"># CHARACTER: NAME</code> ·{" "}
              <code className="font-mono"># LOCATION: TAG</code> ·{" "}
              <code className="font-mono"># SCENE: Title</code>
            </p>
            <p>
              Fields per block (case-insensitive, line-start):{" "}
              <code className="font-mono">NEGATIVE</code>,{" "}
              <code className="font-mono">BEAT</code>,{" "}
              <code className="font-mono">CHARACTERS</code>,{" "}
              <code className="font-mono">LOCATION</code>,{" "}
              <code className="font-mono">SHOT</code>.
            </p>
            <p>
              Characters and locations both need a{" "}
              <code className="font-mono">NEGATIVE</code> line (AI MCD rule).
            </p>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onImport} disabled={!canImport}>
          <Download className="h-4 w-4" />
          Import {totalLabel(parsed)}
        </Button>
      </DialogFooter>
    </>
  );
}

function ImportReportView({
  report,
  onDone,
}: {
  report: MCDImportReport;
  onDone: () => void;
}) {
  return (
    <div className="py-2 space-y-4">
      <div className="rounded-md border border-primary/40 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Import complete
        </div>
        <ul className="text-sm text-foreground space-y-1 pl-6 list-disc">
          <li>{report.charactersAdded} character(s) added</li>
          <li>{report.locationsAdded} location(s) added</li>
          <li>{report.scenesAdded} scene(s) added</li>
        </ul>
      </div>

      {report.scenesSkipped.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertCircle className="h-4 w-4" />
            {report.scenesSkipped.length} scene(s) skipped
          </div>
          <ul className="text-xs space-y-1 pl-6 list-disc text-destructive/80">
            {report.scenesSkipped.map((s, i) => (
              <li key={i}>
                <strong>{s.title}</strong>: {s.reason}
              </li>
            ))}
          </ul>
          <Separator className="my-2" />
          <p className="text-[11px] text-muted-foreground">
            Fix the tag names in your paste and import again. Already-imported
            entries are not duplicated.
          </p>
        </div>
      )}

      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </div>
  );
}

function PreviewRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={count > 0 ? "secondary" : "outline"}>{count}</Badge>
    </div>
  );
}

function totalLabel(parsed: MCDImportResult): string {
  const n =
    parsed.characters.length + parsed.locations.length + parsed.scenes.length;
  return n > 0 ? `${n} entries` : "";
}

const PLACEHOLDER = `# CHARACTER: DARA
A 32-year-old Nigerian woman... (verbatim identity + wardrobe + props)
NEGATIVE: no sunglasses, no modern makeup

# LOCATION: KITCHEN_WARM_MORNING
A modest Lagos kitchen at 7am...
NEGATIVE: no modern appliances, no stainless steel

# SCENE: Dara at the window
BEAT: She realizes the money is missing.
CHARACTERS: DARA
LOCATION: KITCHEN_WARM_MORNING
SHOT: Medium shot, soft morning light...
NEGATIVE: no phone`;
