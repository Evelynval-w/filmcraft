//! Sequence export. Takes an ordered list of clip specs (path + optional
//! trim-in/out seconds) and merges them into a single mp4 using a
//! user-installed `ffmpeg` binary (same policy as gflow — external
//! user-installed tool, not shipped with vidcraft). FilmCraft's engine render
//! path will replace this later.
//!
//! Uses ffmpeg's filter_complex concat filter so clips with slightly
//! different codecs / sample rates / resolutions still merge cleanly. Trim is
//! applied per input via `-ss` and `-to` BEFORE each `-i`, which seeks before
//! decode (fast and keyframe-accurate for mp4).

use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use tokio::process::Command;

#[derive(Deserialize)]
pub struct ClipSpec {
    pub path: String,
    /// Start the clip at this second in source time; default 0.
    pub trim_in_seconds: Option<f64>,
    /// Stop the clip at this second in source time; default = end of file.
    pub trim_out_seconds: Option<f64>,
}

#[derive(Deserialize)]
pub struct ExportArgs {
    pub clips: Vec<ClipSpec>,
    pub output_path: String,
}

#[derive(Serialize)]
pub struct ExportResult {
    pub output_path: String,
    pub clip_count: usize,
    pub ffmpeg_path: String,
    pub trimmed_count: usize,
}

/// Resolve an ffmpeg binary. macOS GUI apps don't inherit shell PATH, so we
/// probe the common install locations before falling back to PATH.
fn resolve_ffmpeg() -> Option<PathBuf> {
    let candidates = [
        "/opt/homebrew/bin/ffmpeg",   // Apple Silicon Homebrew
        "/usr/local/bin/ffmpeg",      // Intel Homebrew
        "/usr/bin/ffmpeg",            // System
        "/opt/local/bin/ffmpeg",      // MacPorts
    ];
    for p in candidates {
        if Path::new(p).is_file() {
            return Some(PathBuf::from(p));
        }
    }
    Some(PathBuf::from("ffmpeg"))
}

#[tauri::command]
pub async fn ffmpeg_probe() -> Result<String, String> {
    let ffmpeg = resolve_ffmpeg()
        .ok_or_else(|| "ffmpeg not found in common locations".to_string())?;

    let output = Command::new(&ffmpeg)
        .arg("-version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| {
            format!(
                "could not run ffmpeg at {}: {e} — install it with `brew install ffmpeg`",
                ffmpeg.display()
            )
        })?;

    if !output.status.success() {
        return Err(format!(
            "ffmpeg -version failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let first_line = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .unwrap_or("")
        .to_string();

    Ok(if first_line.is_empty() {
        format!("found at {}", ffmpeg.display())
    } else {
        first_line
    })
}

#[tauri::command]
pub async fn export_sequence(args: ExportArgs) -> Result<ExportResult, String> {
    if args.clips.is_empty() {
        return Err("No clips to export — the sequence is empty.".to_string());
    }
    if args.output_path.trim().is_empty() {
        return Err("Output path is empty.".to_string());
    }

    for c in &args.clips {
        if !Path::new(&c.path).is_file() {
            return Err(format!("clip not found: {}", c.path));
        }
        if let (Some(a), Some(b)) = (c.trim_in_seconds, c.trim_out_seconds) {
            if b <= a {
                return Err(format!(
                    "clip {} has trim-out ({b}s) at or before trim-in ({a}s)",
                    c.path
                ));
            }
        }
    }

    let ffmpeg = resolve_ffmpeg()
        .ok_or_else(|| "could not resolve ffmpeg path".to_string())?;

    let n = args.clips.len();
    let trimmed_count = args
        .clips
        .iter()
        .filter(|c| c.trim_in_seconds.is_some() || c.trim_out_seconds.is_some())
        .count();

    // filter_complex: [0:v:0][0:a:0]...[N-1:v:0][N-1:a:0]concat=n=N:v=1:a=1[outv][outa]
    let mut filter = String::new();
    for i in 0..n {
        filter.push_str(&format!("[{i}:v:0][{i}:a:0]"));
    }
    filter.push_str(&format!("concat=n={n}:v=1:a=1[outv][outa]"));

    let mut cmd = Command::new(&ffmpeg);
    cmd.arg("-y");
    for clip in &args.clips {
        // -ss and -to BEFORE -i seek on the input (fast). Only emit when set.
        if let Some(ss) = clip.trim_in_seconds {
            cmd.arg("-ss").arg(format!("{ss:.3}"));
        }
        if let Some(to) = clip.trim_out_seconds {
            cmd.arg("-to").arg(format!("{to:.3}"));
        }
        cmd.arg("-i").arg(&clip.path);
    }
    cmd.arg("-filter_complex")
        .arg(&filter)
        .arg("-map")
        .arg("[outv]")
        .arg("-map")
        .arg("[outa]")
        .arg("-c:v")
        .arg("libx264")
        .arg("-crf")
        .arg("20")
        .arg("-preset")
        .arg("medium")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-c:a")
        .arg("aac")
        .arg("-b:a")
        .arg("192k")
        .arg(&args.output_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let output = cmd.output().await.map_err(|e| {
        format!(
            "failed to run ffmpeg at {}: {e} — install it with `brew install ffmpeg`",
            ffmpeg.display()
        )
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let tail = stderr
            .lines()
            .rev()
            .take(12)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        return Err(format!(
            "ffmpeg exited with status {}. Last lines:\n{}",
            output.status, tail
        ));
    }

    Ok(ExportResult {
        output_path: args.output_path,
        clip_count: n,
        ffmpeg_path: ffmpeg.display().to_string(),
        trimmed_count,
    })
}
