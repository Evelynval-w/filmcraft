import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Badge } from "@/components/ui/badge";
import { Film } from "lucide-react";
import { SettingsDialog } from "@/components/SettingsDialog";

type EngineInfo = {
  engine: string;
  linked: boolean;
};

export function TopBar() {
  const [info, setInfo] = useState<EngineInfo | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    invoke<EngineInfo>("engine_info")
      .then(setInfo)
      .catch(() => setUnreachable(true));
  }, []);

  return (
    <header className="border-b border-border bg-background/60 backdrop-blur sticky top-0 z-10">
      <div className="flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5" />
          <span className="font-semibold tracking-tight">vidcraft</span>
          <span className="text-muted-foreground text-xs uppercase tracking-widest ml-2">
            launcher
          </span>
        </div>
        <div className="flex items-center gap-2">
          {unreachable && (
            <Badge variant="destructive">engine: unreachable</Badge>
          )}
          {info?.linked && (
            <Badge variant="secondary" className="font-mono text-xs">
              {info.engine} · linked
            </Badge>
          )}
          <SettingsDialog />
        </div>
      </div>
    </header>
  );
}
