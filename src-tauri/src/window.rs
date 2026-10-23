use std::sync::atomic::Ordering;

use serde::Deserialize;
use serde_json::json;
use tauri::menu::{Menu, MenuItem};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

use crate::config::AppConfigState;
use crate::macos;
use crate::QuitState;

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn show_main(app: AppHandle) {
    show_main_window(&app);
}

#[tauri::command]
pub fn hide_main(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
pub fn notify_pet(app: AppHandle, payload: serde_json::Value) {
    let _ = app.emit_to("pet", "pet://notification", payload);
}

#[tauri::command]
pub fn start_pet_drag(window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetHitZone {
    pub cx: f64,
    pub cy: f64,
    pub rx: f64,
    pub ry: f64,
}

/// Polled by the tiny pet window. macOS coordinates are in screen points while
/// Tauri's window position is physical, so normalize by the display scale.
#[tauri::command]
pub fn update_pet_hit_test(
    window: WebviewWindow,
    zone: PetHitZone,
) -> Result<bool, String> {
    let Some((cursor_x, cursor_y)) = macos::cursor_position() else {
        // If the native query is unavailable, keep the pet interactive.
        let _ = window.set_ignore_cursor_events(false);
        return Ok(true);
    };

    let position = window.outer_position().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let local_x = cursor_x - (position.x as f64 / scale);
    let local_y = cursor_y - (position.y as f64 / scale);

    let dx = (local_x - zone.cx) / zone.rx.max(1.0);
    let dy = (local_y - zone.cy) / zone.ry.max(1.0);
    let over = dx * dx + dy * dy <= 1.0;

    window
        .set_ignore_cursor_events(!over)
        .map_err(|e| e.to_string())?;
    Ok(over)
}

#[tauri::command]
pub fn remember_pet_position(
    window: WebviewWindow,
    state: State<'_, AppConfigState>,
) -> Result<(), String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    state.update(|config| {
        config.pet_x = Some(position.x as f64);
        config.pet_y = Some(position.y as f64);
    })?;
    Ok(())
}

#[tauri::command]
pub fn show_pet_menu(window: WebviewWindow) -> Result<(), String> {
    let open = MenuItem::with_id(&window, "pet-open", "打开设置", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let mute = MenuItem::with_id(&window, "pet-mute-all", "全部 Bot 静音", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let quit = MenuItem::with_id(&window, "pet-quit", "退出应用", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let menu = Menu::with_items(&window, &[&open, &mute, &quit]).map_err(|e| e.to_string())?;
    window.popup_menu(&menu).map_err(|e| e.to_string())
}

pub fn install_menu_events(app: &AppHandle) {
    let handle = app.clone();
    app.on_menu_event(move |app, event| {
        let id = event.id().as_ref();
        match id {
            "pet-open" => {
                show_main_window(app);
                let _ = app.emit_to(
                    "main",
                    "pet://menu",
                    json!({ "action": "open-settings" }),
                );
            }
            "pet-mute-all" => {
                let _ = app.emit_to(
                    "main",
                    "pet://menu",
                    json!({ "action": "mute-all" }),
                );
                let _ = app.emit_to(
                    "pet",
                    "pet://menu",
                    json!({ "action": "mute-all" }),
                );
            }
            "pet-quit" => {
                app.state::<QuitState>().0.store(true, Ordering::SeqCst);
                handle.exit(0);
            }
            _ => {}
        }
    });
}
