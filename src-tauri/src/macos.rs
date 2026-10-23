use tauri::{AppHandle, Manager};

/// Configure the always-on-top desktop companion. The window is mouse
/// transparent by default; the pet page then switches hit-testing on while the
/// cursor is over the robot's body.
pub fn configure_pet_window(app: &AppHandle) {
    let Some(pet) = app.get_webview_window("pet") else {
        return;
    };

    let _ = pet.set_always_on_top(true);
    #[cfg(target_os = "macos")]
    let _ = pet.set_visible_on_all_workspaces(true);
    let _ = pet.set_ignore_cursor_events(true);

    let state = app.state::<crate::config::AppConfigState>();
    let config = state.snapshot();

    if let (Some(x), Some(y)) = (config.pet_x, config.pet_y) {
        let _ = pet.set_position(tauri::PhysicalPosition::new(x.round() as i32, y.round() as i32));
        return;
    }

    // First launch: tuck the robot into the bottom-right corner with a margin.
    if let Ok(Some(monitor)) = pet.primary_monitor() {
        let size = pet.outer_size().unwrap_or(tauri::PhysicalSize::new(120, 120));
        let scale = monitor.scale_factor();
        let margin = (88.0 * scale) as i32;
        let x = monitor.position().x + monitor.size().width as i32 - size.width as i32 - margin;
        let y = monitor.position().y + monitor.size().height as i32 - size.height as i32 - margin;
        let _ = pet.set_position(tauri::PhysicalPosition::new(x, y));
    }
}

#[cfg(target_os = "macos")]
mod cursor {
    use std::ffi::c_void;

    #[repr(C)]
    struct CGPoint {
        x: f64,
        y: f64,
    }

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventCreate(source: *const c_void) -> *const c_void;
        fn CGEventGetLocation(event: *const c_void) -> CGPoint;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFRelease(cf: *const c_void);
    }

    /// Global mouse position in screen points, origin at the top-left of the
    /// main display. This works even while the pet window ignores mouse events.
    pub fn position() -> Option<(f64, f64)> {
        unsafe {
            let event = CGEventCreate(std::ptr::null());
            if event.is_null() {
                return None;
            }
            let point = CGEventGetLocation(event);
            CFRelease(event);
            Some((point.x, point.y))
        }
    }
}

#[cfg(target_os = "macos")]
pub use cursor::position as cursor_position;

#[cfg(not(target_os = "macos"))]
pub fn cursor_position() -> Option<(f64, f64)> {
    None
}
