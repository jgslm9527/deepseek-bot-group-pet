use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

const DEFAULT_BASE_URL: &str = "https://api.deepseek.com";

/// Persisted on the user's machine only. This file never lives in the source
/// tree and is written with user-only permissions on Unix.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    pub api_key: String,
    pub base_url: String,
    pub pet_x: Option<f64>,
    pub pet_y: Option<f64>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            base_url: DEFAULT_BASE_URL.to_string(),
            pet_x: None,
            pet_y: None,
        }
    }
}

impl AppConfig {
    pub fn endpoint(&self) -> String {
        let base = self.base_url.trim().trim_end_matches('/');
        if base.ends_with("/chat/completions") {
            base.to_string()
        } else {
            format!("{base}/chat/completions")
        }
    }
}

pub struct AppConfigState {
    pub inner: Mutex<AppConfig>,
    pub path: PathBuf,
    pub client: reqwest::Client,
}

impl AppConfigState {
    pub fn load(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let dir = app.path().app_config_dir()?;
        fs::create_dir_all(&dir)?;
        let path = dir.join("config.json");
        let config = read_config(&path).unwrap_or_default();
        let client = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(20))
            .user_agent("DeepSeek-Group-Pet/1.0")
            .build()?;
        Ok(Self {
            inner: Mutex::new(config),
            path,
            client,
        })
    }

    pub fn snapshot(&self) -> AppConfig {
        self.inner.lock().expect("config mutex poisoned").clone()
    }

    pub fn update<F>(&self, f: F) -> Result<AppConfig, String>
    where
        F: FnOnce(&mut AppConfig),
    {
        let next = {
            let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
            f(&mut guard);
            guard.clone()
        };
        write_config(&self.path, &next)?;
        Ok(next)
    }
}

fn read_config(path: &Path) -> Result<AppConfig, Box<dyn std::error::Error>> {
    let raw = fs::read_to_string(path)?;
    let config: AppConfig = serde_json::from_str(&raw)?;
    Ok(config)
}

pub fn write_config(path: &Path, config: &AppConfig) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| format!("无法写入本地配置文件：{e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600));
    }
    fs::rename(&tmp, path).map_err(|e| format!("无法保存本地配置文件：{e}"))?;
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSettingsPayload {
    /// `None` keeps the existing key; an empty string also leaves it untouched.
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub clear_api_key: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicApiSettings {
    pub base_url: String,
    pub has_key: bool,
    pub key_hint: String,
}

fn public_settings(config: &AppConfig) -> PublicApiSettings {
    let key = config.api_key.trim();
    let tail: String = key
        .chars()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    let hint = if key.chars().count() >= 4 {
        format!("••••••{tail}")
    } else {
        String::new()
    };
    PublicApiSettings {
        base_url: config.base_url.clone(),
        has_key: !key.is_empty(),
        key_hint: hint,
    }
}

#[tauri::command]
pub fn get_api_settings(state: State<'_, AppConfigState>) -> Result<PublicApiSettings, String> {
    let config = state.snapshot();
    Ok(public_settings(&config))
}

#[tauri::command]
pub fn save_api_settings(
    state: State<'_, AppConfigState>,
    payload: SaveSettingsPayload,
) -> Result<PublicApiSettings, String> {
    if let Some(url) = payload.base_url.as_deref() {
        let trimmed = url.trim();
        if !trimmed.is_empty()
            && !trimmed.starts_with("https://")
            && !trimmed.starts_with("http://")
        {
            return Err("API Base URL 必须以 http:// 或 https:// 开头".into());
        }
    }

    let config = state.update(|config| {
        if payload.clear_api_key.unwrap_or(false) {
            config.api_key.clear();
        } else if let Some(key) = payload.api_key.as_ref() {
            let key = key.trim();
            if !key.is_empty() {
                config.api_key = key.to_string();
            }
        }
        if let Some(url) = payload.base_url.as_ref() {
            let trimmed = url.trim();
            if !trimmed.is_empty() {
                config.base_url = trimmed.trim_end_matches('/').to_string();
            }
        }
        if config.base_url.is_empty() {
            config.base_url = DEFAULT_BASE_URL.to_string();
        }
    })?;

    Ok(public_settings(&config))
}
