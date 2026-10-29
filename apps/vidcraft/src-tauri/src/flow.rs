//! gflow-cli bridge. Shells out to the `gflow` binary installed as a
//! devDependency of `apps/vidcraft`. Every call runs through `npx gflow`
//! so resolution climbs from the app's working directory.
//!
//! Follows the FilmCraft "never crash" rule: no unwrap/expect/panic.

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::Manager;
use tokio::process::Command;

#[derive(Serialize)]
pub struct GflowStatus {
    /// `gflow --version` succeeded.
    pub installed: bool,
    /// Reported version string, if `gflow --version` returned one.
    pub version: Option<String>,
    /// `gflow doctor` exited successfully (session signed in + ready).
    pub signed_in: bool,
    /// Last line of doctor output (or an error string); short enough to show
    /// in the Settings dialog.
    pub message: String,
}

impl GflowStatus {
    fn unreachable(reason: impl Into<String>) -> Self {
        Self {
            installed: false,
            version: None,
            signed_in: false,
            message: reason.into(),
        }
    }
}

#[tauri::command]
pub async fn gflow_status() -> Result<GflowStatus, String> {
    // Version probe. Confirms gflow is callable from this process.
    let version_output = match Command::new("npx")
        .args(["--yes", "gflow", "--version"])
        .output()
        .await
    {
        Ok(o) => o,
        Err(e) => {
            return Ok(GflowStatus::unreachable(format!(
                "could not launch npx: {e}"
            )));
        }
    };

    if !version_output.status.success() {
        return Ok(GflowStatus::unreachable(
            "gflow --version exited with a non-zero status",
        ));
    }

    let version = String::from_utf8_lossy(&version_output.stdout)
        .trim()
        .to_string();
    let version = if version.is_empty() {
        None
    } else {
        Some(version)
    };

    // Doctor probe. Confirms the Flow session is signed in.
    let doctor_output = match Command::new("npx")
        .args(["--yes", "gflow", "doctor"])
        .output()
        .await
    {
        Ok(o) => o,
        Err(e) => {
            return Ok(GflowStatus {
                installed: true,
                version,
                signed_in: false,
                message: format!("could not run gflow doctor: {e}"),
            });
        }
    };

    let signed_in = doctor_output.status.success();
    let stdout_text = String::from_utf8_lossy(&doctor_output.stdout);
    let stderr_text = String::from_utf8_lossy(&doctor_output.stderr);
    let combined = if signed_in { stdout_text } else { stderr_text };
    let message = combined
        .lines()
        .last()
        .unwrap_or("")
        .trim()
        .to_string();
    let message = if message.is_empty() {
        if signed_in {
            "signed in and ready".to_string()
        } else {
            "not signed in — click Sign in to launch Chrome".to_string()
        }
    } else {
        message
    };

    Ok(GflowStatus {
        installed: true,
        version,
        signed_in,
        message,
    })
}

#[tauri::command]
pub async fn gflow_auth_login() -> Result<(), String> {
    // Spawn detached: the user interacts with the Chrome window gflow opens.
    // We do not wait for the process to exit; the frontend polls `gflow_status`
    // after the user says they are done.
    Command::new("npx")
        .args(["--yes", "gflow", "auth", "login"])
        .spawn()
        .map_err(|e| format!("failed to launch gflow auth login: {e}"))?;
    Ok(())
}

#[derive(Deserialize)]
pub struct GenerateVideoArgs {
    pub project_id: String,
    pub prompt: String,
    /// 4, 6, 8, or 10 seconds. Enforced client-side; defaulted here if odd.
    pub duration: Option<u8>,
    /// Flow-visible model name. Defaults to "Veo 3.1 Lite" (cheapest).
    pub model: Option<String>,
}

#[derive(Serialize)]
pub struct GeneratedClip {
    pub path: String,
    pub duration_seconds: u8,
    pub prompt: String,
    pub model: String,
}

#[tauri::command]
pub async fn gflow_generate_video(
    app: tauri::AppHandle,
    args: GenerateVideoArgs,
) -> Result<GeneratedClip, String> {
    let duration = match args.duration {
        Some(4 | 6 | 8 | 10) => args.duration.unwrap_or(8),
        _ => 8,
    };

    let model = args
        .model
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| "Veo 3.1 Lite".to_string());

    // Resolve <app_data>/projects/<project_id>/media/<timestamp>/
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis().to_string())
        .unwrap_or_else(|_| "job".to_string());

    let out_dir: PathBuf = app_data
        .join("projects")
        .join(&args.project_id)
        .join("media")
        .join(&timestamp);

    tokio::fs::create_dir_all(&out_dir)
        .await
        .map_err(|e| format!("could not create output dir: {e}"))?;

    let out_dir_str = out_dir
        .to_str()
        .ok_or_else(|| "output path contains invalid UTF-8".to_string())?
        .to_string();

    let duration_str = duration.to_string();
    let job_id = format!("vidcraft-{timestamp}");
    // Cap gflow's own generation wait at 15 min. Flow at 99% has been observed
    // for several minutes before the `<video>` element gflow polls for finally
    // appears; 5 min cut it off too close to the finish.
    let timeout_str = "900";

    let output = Command::new("npx")
        .args([
            "--yes",
            "gflow",
            "video",
            "--id",
            &job_id,
            "--prompt",
            &args.prompt,
            "--model",
            &model,
            "--duration",
            &duration_str,
            "--timeout",
            timeout_str,
            "--out",
            &out_dir_str,
        ])
        .output()
        .await
        .map_err(|e| format!("failed to launch gflow video: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "gflow video failed. stderr: {} stdout: {}",
            stderr.trim(),
            stdout.trim()
        ));
    }

    // Find the produced mp4. gflow writes `<job-id>-NNN.mp4` plus a sidecar
    // json. Scan the output dir for the first mp4.
    let mut read_dir = tokio::fs::read_dir(&out_dir)
        .await
        .map_err(|e| format!("could not read output dir after generation: {e}"))?;

    let mut found: Option<PathBuf> = None;
    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| format!("directory iteration failed: {e}"))?
    {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("mp4") {
            found = Some(path);
            break;
        }
    }

    let mp4 = found.ok_or_else(|| {
        "gflow video reported success but no .mp4 appeared in the output dir"
            .to_string()
    })?;

    let mp4_str = mp4
        .to_str()
        .ok_or_else(|| "mp4 path contains invalid UTF-8".to_string())?
        .to_string();

    Ok(GeneratedClip {
        path: mp4_str,
        duration_seconds: duration,
        prompt: args.prompt,
        model,
    })
}
