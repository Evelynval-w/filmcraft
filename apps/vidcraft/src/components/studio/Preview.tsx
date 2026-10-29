import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  RotateCcw,
} from "lucide-react";
import type { MediaItem, Scene } from "@/types/project";

type PreviewProps = {
  scene: Scene | undefined;
  media: MediaItem | undefined;
  onPrev?: () => void;
  onNext?: () => void;
  onTrimChange?: (patch: {
    trimInSeconds?: number;
    trimOutSeconds?: number;
  }) => void;
};

/**
 * HTML5 video preview. Loads the selected scene's clip and provides a scrub
 * bar plus Set-In / Set-Out buttons at the current playhead. Trim values are
 * written back up through onTrimChange so the parent persists them on the
 * scene — the trim is applied by the exporter, not by playback (playback
 * previews the full source so you can judge where to cut).
 */
export function Preview({
  scene,
  media,
  onPrev,
  onNext,
  onTrimChange,
}: PreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [media?.path]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  const trimIn = scene?.trimInSeconds;
  const trimOut = scene?.trimOutSeconds;
  const hasTrim = trimIn !== undefined || trimOut !== undefined;

  function setIn() {
    if (!onTrimChange) return;
    const next = round2(current);
    const outValue = scene?.trimOutSeconds;
    if (outValue !== undefined && next >= outValue) return;
    onTrimChange({ trimInSeconds: next });
  }
  function setOut() {
    if (!onTrimChange) return;
    const next = round2(current);
    const inValue = scene?.trimInSeconds ?? 0;
    if (next <= inValue) return;
    onTrimChange({ trimOutSeconds: next });
  }
  function resetTrim() {
    if (!onTrimChange) return;
    onTrimChange({ trimInSeconds: undefined, trimOutSeconds: undefined });
  }

  const trimInPct =
    duration > 0 && trimIn !== undefined ? (trimIn / duration) * 100 : null;
  const trimOutPct =
    duration > 0 && trimOut !== undefined ? (trimOut / duration) * 100 : null;

  return (
    <div className="flex-1 flex flex-col bg-black/60 min-h-0">
      <div
        className="flex-1 flex items-center justify-center p-4 outline-none"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === " ") {
            e.preventDefault();
            togglePlay();
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            onPrev?.();
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            onNext?.();
          } else if (e.key === "i" || e.key === "I") {
            e.preventDefault();
            setIn();
          } else if (e.key === "o" || e.key === "O") {
            e.preventDefault();
            setOut();
          }
        }}
      >
        {media ? (
          <video
            ref={videoRef}
            key={media.path}
            src={convertFileSrc(media.path)}
            className="max-h-full max-w-full border border-border bg-black"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              onNext?.();
            }}
            onLoadedMetadata={(e) =>
              setDuration(e.currentTarget.duration || 0)
            }
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          />
        ) : (
          <div className="aspect-video w-full max-w-4xl border border-border bg-black flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <span className="text-xs uppercase tracking-widest">
                no clip loaded
              </span>
              {scene && (
                <p className="text-[11px] text-muted-foreground/80">
                  Scene #{scene.index} has no clip yet. Attach one from the
                  Scenes workspace.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scrub bar with trim range overlay */}
      {media && (
        <div className="h-9 border-t border-border bg-background flex items-center px-4 gap-2 shrink-0">
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-14 text-right">
            {formatTime(current)}
          </span>
          <div className="relative flex-1 h-2">
            {/* Base track */}
            <div className="absolute inset-0 bg-muted rounded" />
            {/* Trim range highlight */}
            {duration > 0 && (
              <div
                className="absolute top-0 bottom-0 bg-primary/30 rounded"
                style={{
                  left: `${trimInPct ?? 0}%`,
                  right: `${100 - (trimOutPct ?? 100)}%`,
                }}
              />
            )}
            {/* Trim-in marker */}
            {trimInPct !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary"
                style={{ left: `${trimInPct}%` }}
                title={`In: ${formatTime(trimIn ?? 0)}`}
              />
            )}
            {/* Trim-out marker */}
            {trimOutPct !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary"
                style={{ left: `${trimOutPct}%` }}
                title={`Out: ${formatTime(trimOut ?? 0)}`}
              />
            )}
            {/* Scrub input, transparent on top */}
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={current}
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                const t = Number(e.currentTarget.value);
                v.currentTime = t;
                setCurrent(t);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-14">
            {formatTime(duration)}
          </span>
        </div>
      )}

      <div className="h-11 border-t border-border bg-background flex items-center justify-between px-4 shrink-0 gap-3">
        <div className="flex items-center gap-1 w-32">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!onPrev}
            onClick={() => onPrev?.()}
            title="Previous scene (←)"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!media}
            onClick={togglePlay}
            title="Play / pause (space)"
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!onNext}
            onClick={() => onNext?.()}
            title="Next scene (→)"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {media && onTrimChange ? (
          <div className="flex-1 flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-[11px]"
              onClick={setIn}
              title="Set in-point at playhead (I)"
            >
              <Scissors className="h-3 w-3" />
              Set In {trimIn !== undefined && `(${formatTime(trimIn)})`}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-[11px]"
              onClick={setOut}
              title="Set out-point at playhead (O)"
            >
              <Scissors className="h-3 w-3" />
              Set Out {trimOut !== undefined && `(${formatTime(trimOut)})`}
            </Button>
            {hasTrim && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={resetTrim}
                title="Clear trim — play full source"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="w-32 flex justify-end">
          {scene && (
            <Badge
              variant={hasTrim ? "default" : "secondary"}
              className="text-[10px]"
            >
              #{scene.index.toString().padStart(2, "0")}
              {hasTrim ? " · trimmed" : ""}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const ms = Math.round((seconds - total) * 10);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
