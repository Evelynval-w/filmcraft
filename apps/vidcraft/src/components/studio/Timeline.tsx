type Track = { id: string; label: string; kind: "video" | "audio" };

const DEFAULT_TRACKS: Track[] = [
  { id: "v2", label: "V2", kind: "video" },
  { id: "v1", label: "V1", kind: "video" },
  { id: "a1", label: "A1", kind: "audio" },
  { id: "a2", label: "A2", kind: "audio" },
];

const RULER_SECONDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function Timeline() {
  return (
    <div className="h-56 border-t border-border bg-background shrink-0 flex flex-col">
      <div className="h-6 border-b border-border flex shrink-0">
        <div className="w-16 border-r border-border bg-background/60" />
        <div className="flex-1 flex font-mono text-[10px] text-muted-foreground">
          {RULER_SECONDS.map((s) => (
            <div
              key={s}
              className="flex-1 border-r border-border/60 pl-1 flex items-center"
            >
              00:00:{s.toString().padStart(2, "0")}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {DEFAULT_TRACKS.map((t) => (
          <TrackRow key={t.id} track={t} />
        ))}
      </div>
    </div>
  );
}

function TrackRow({ track }: { track: Track }) {
  return (
    <div className="h-10 flex border-b border-border/60 last:border-b-0">
      <div className="w-16 border-r border-border flex items-center justify-center text-xs text-muted-foreground font-mono">
        {track.label}
      </div>
      <div
        className={`flex-1 ${
          track.kind === "video" ? "bg-slate-900/40" : "bg-slate-900/20"
        }`}
      />
    </div>
  );
}
