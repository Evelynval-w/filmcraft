import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  CheckCircle2,
  AlertCircle,
  LogIn,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

type GflowStatus = {
  installed: boolean;
  version: string | null;
  signed_in: boolean;
  message: string;
};

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<GflowStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginLaunched, setLoginLaunched] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await invoke<GflowStatus>("gflow_status");
      setStatus(next);
    } catch (e) {
      setStatus({
        installed: false,
        version: null,
        signed_in: false,
        message: `error: ${String(e)}`,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  async function handleSignIn() {
    try {
      await invoke("gflow_auth_login");
      setLoginLaunched(true);
    } catch (e) {
      setStatus({
        installed: true,
        version: status?.version ?? null,
        signed_in: false,
        message: `failed to launch sign-in: ${String(e)}`,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Connections, authentication, and tools vidcraft needs to generate
            video.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3 pt-2">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Google Flow</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Powers clip generation (Veo 3.1) through the gflow-cli bridge.
              </p>
            </div>
            {status && status.signed_in && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Signed in
              </Badge>
            )}
            {status && !status.signed_in && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Not signed in
              </Badge>
            )}
          </header>

          <Separator />

          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">gflow-cli version</span>
              <span className="font-mono">
                {status?.version ?? (loading ? "..." : "unknown")}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">status</span>
              <span className="font-mono text-right truncate max-w-[32ch]">
                {status?.message ?? (loading ? "checking..." : "—")}
              </span>
            </div>
          </div>

          {loginLaunched && !status?.signed_in && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs">
              A Chrome window should be opening. Sign in with your Google AI
              Pro account. When Chrome shows the Flow homepage, come back here
              and click <strong>Refresh</strong>.
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            {!status?.signed_in && (
              <Button onClick={handleSignIn} disabled={loading}>
                <LogIn className="h-4 w-4" />
                Sign in to Google Flow
              </Button>
            )}
            <Button variant="ghost" onClick={refresh} disabled={loading}>
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              variant="ghost"
              className="ml-auto"
              onClick={() =>
                openUrl("https://github.com/swissmarley/gflow-cli").catch(
                  () => undefined,
                )
              }
            >
              <ExternalLink className="h-3.5 w-3.5" />
              gflow-cli docs
            </Button>
          </div>
        </section>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
