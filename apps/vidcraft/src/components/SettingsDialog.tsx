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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings,
  CheckCircle2,
  AlertCircle,
  LogIn,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  getSettings,
  updateSettings,
  type AnthropicModel,
  type GoogleModel,
  type Provider,
  type Settings as DaraSettings,
} from "@/stores/settings";

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
  const [daraSettings, setDaraSettings] = useState<DaraSettings>(getSettings);
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

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
      setDaraSettings(getSettings());
      setKeySaved(false);
    }
  }, [open, refresh]);

  function patchDara(patch: Partial<DaraSettings>) {
    setDaraSettings((prev) => ({ ...prev, ...patch }));
    setKeySaved(false);
  }

  function handleSaveDara() {
    updateSettings({
      provider: daraSettings.provider,
      anthropicApiKey: daraSettings.anthropicApiKey.trim(),
      anthropicModel: daraSettings.anthropicModel,
      googleApiKey: daraSettings.googleApiKey.trim(),
      googleModel: daraSettings.googleModel,
    });
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  }

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

  const activeKey =
    daraSettings.provider === "anthropic"
      ? daraSettings.anthropicApiKey
      : daraSettings.googleApiKey;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
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

        <section className="space-y-3 pt-4">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Dara (Rush Agent)
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Natural-language editing. Pick a provider and give it your API
                key — stays on this machine.
              </p>
            </div>
            {activeKey && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Key saved
              </Badge>
            )}
          </header>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs">Provider</Label>
            <div className="flex gap-2">
              <ProviderPill
                active={daraSettings.provider === "google"}
                onClick={() => patchDara({ provider: "google" })}
                label="Google AI"
                sublabel="Gemini"
              />
              <ProviderPill
                active={daraSettings.provider === "anthropic"}
                onClick={() => patchDara({ provider: "anthropic" })}
                label="Anthropic"
                sublabel="Claude"
              />
            </div>
          </div>

          {daraSettings.provider === "google" ? (
            <GoogleSection
              apiKey={daraSettings.googleApiKey}
              model={daraSettings.googleModel}
              showKey={showKey}
              onToggleShow={() => setShowKey((v) => !v)}
              onApiKey={(v) => patchDara({ googleApiKey: v })}
              onModel={(m) => patchDara({ googleModel: m })}
            />
          ) : (
            <AnthropicSection
              apiKey={daraSettings.anthropicApiKey}
              model={daraSettings.anthropicModel}
              showKey={showKey}
              onToggleShow={() => setShowKey((v) => !v)}
              onApiKey={(v) => patchDara({ anthropicApiKey: v })}
              onModel={(m) => patchDara({ anthropicModel: m })}
            />
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleSaveDara} disabled={keySaved}>
              {keySaved ? "Saved" : "Save Dara settings"}
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

function ProviderPill({
  active,
  onClick,
  label,
  sublabel,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sublabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md border px-3 py-2 text-left transition ${
        active
          ? "border-primary bg-primary/10"
          : "border-border bg-background hover:border-border/80"
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px] text-muted-foreground font-mono">
        {sublabel}
      </div>
    </button>
  );
}

function GoogleSection(props: {
  apiKey: string;
  model: GoogleModel;
  showKey: boolean;
  onToggleShow: () => void;
  onApiKey: (v: string) => void;
  onModel: (m: GoogleModel) => void;
}) {
  return (
    <>
      <KeyField
        id="google-key"
        label="Google AI API key"
        placeholder="AIza..."
        value={props.apiKey}
        onChange={props.onApiKey}
        showKey={props.showKey}
        onToggleShow={props.onToggleShow}
        hintText="Create one at"
        hintHref="https://aistudio.google.com/app/apikey"
        hintLink="aistudio.google.com/app/apikey"
      />
      <div className="space-y-2">
        <Label htmlFor="google-model" className="text-xs">
          Model
        </Label>
        <select
          id="google-model"
          value={props.model}
          onChange={(e) => props.onModel(e.currentTarget.value as GoogleModel)}
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm font-mono"
        >
          <option value="gemini-3.8-flash">
            gemini-3.8-flash (recommended, fast)
          </option>
          <option value="gemini-3.8-pro">gemini-3.8-pro (strongest)</option>
          <option value="gemini-flash-latest">
            gemini-flash-latest (always current)
          </option>
        </select>
      </div>
    </>
  );
}

function AnthropicSection(props: {
  apiKey: string;
  model: AnthropicModel;
  showKey: boolean;
  onToggleShow: () => void;
  onApiKey: (v: string) => void;
  onModel: (m: AnthropicModel) => void;
}) {
  return (
    <>
      <KeyField
        id="anthropic-key"
        label="Anthropic API key"
        placeholder="sk-ant-..."
        value={props.apiKey}
        onChange={props.onApiKey}
        showKey={props.showKey}
        onToggleShow={props.onToggleShow}
        hintText="Create one at"
        hintHref="https://console.anthropic.com/settings/keys"
        hintLink="console.anthropic.com/settings/keys"
      />
      <div className="space-y-2">
        <Label htmlFor="anthropic-model" className="text-xs">
          Model
        </Label>
        <select
          id="anthropic-model"
          value={props.model}
          onChange={(e) =>
            props.onModel(e.currentTarget.value as AnthropicModel)
          }
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm font-mono"
        >
          <option value="claude-sonnet-5-5">
            claude-sonnet-5-5 (recommended)
          </option>
          <option value="claude-haiku-5-5">
            claude-haiku-5-5 (faster, cheaper)
          </option>
          <option value="claude-opus-5-5">
            claude-opus-5-5 (strongest)
          </option>
        </select>
      </div>
    </>
  );
}

function KeyField(props: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  showKey: boolean;
  onToggleShow: () => void;
  hintText: string;
  hintHref: string;
  hintLink: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id} className="text-xs">
        {props.label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={props.id}
          type={props.showKey ? "text" : "password"}
          value={props.value}
          onChange={(e) => props.onChange(e.currentTarget.value)}
          placeholder={props.placeholder}
          className="font-mono text-xs"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={props.onToggleShow}
          className="shrink-0"
          aria-label={props.showKey ? "Hide key" : "Show key"}
        >
          {props.showKey ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {props.hintText}{" "}
        <button
          type="button"
          className="underline hover:text-foreground"
          onClick={() => openUrl(props.hintHref).catch(() => undefined)}
        >
          {props.hintLink}
        </button>
        .
      </p>
    </div>
  );
}

export type { Provider };
