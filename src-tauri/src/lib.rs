mod api;
mod config;
mod macos;
mod window;

use std::sync::atomic::{AtomicBool, Ordering};

use config::AppConfigState;
use tauri::{Manager, WindowEvent};
use tauri_plugin_sql::{Migration, MigrationKind};

/// Set when the user explicitly quits from the pet menu, so closing the main
/// window does not merely hide it.
pub struct QuitState(pub AtomicBool);

pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "initial schema, default bots and studio room",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }];

    let app = tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:deepseek-pet.db", migrations)
                .build(),
        )
        .manage(QuitState(AtomicBool::new(false)))
        .invoke_handler(tauri::generate_handler![
            api::deepseek_chat,
            api::test_deepseek,
            config::get_api_settings,
            config::save_api_settings,
            window::show_main,
            window::hide_main,
            window::notify_pet,
            window::show_pet_menu,
            window::start_pet_drag,
            window::update_pet_hit_test,
            window::remember_pet_position
        ])
        .setup(|app| {
            let state = AppConfigState::load(app.handle())?;
            app.manage(state);

            macos::configure_pet_window(app.handle());
            window::install_menu_events(app.handle());

            if let Err(err) = app.set_menu(tauri::menu::Menu::default(app.handle())?) {
                // A missing native menu is not fatal for the core experience.
                eprintln!("failed to install default app menu: {err}");
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                let quitting = window
                    .app_handle()
                    .state::<QuitState>()
                    .0
                    .load(Ordering::SeqCst);
                if !quitting {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building DeepSeek Group Pet");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen {
            has_visible_windows,
            ..
        } = event
        {
            if !has_visible_windows {
                window::show_main_window(app_handle);
            }
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app_handle, event);
    });
}
