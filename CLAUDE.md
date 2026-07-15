# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dev Tools (开发者工具箱) — a **Tauri 2 + React 19 + TypeScript** cross-platform desktop developer toolkit. Dual-purpose: (1) developer utilities (JSON formatter, clipboard history, calculator, encoding tools, regex/Cron tester, ID card tools) and (2) a local dev environment stack manager (nginx/OpenResty/Apache, PHP, MySQL/MariaDB, Redis, RabbitMQ with one-click install/start/stop).

## Commands

```bash
pnpm install                  # Install dependencies
pnpm dev                      # Frontend only (Vite dev server on port 5180)
pnpm tauri dev                # Full desktop app in dev mode
pnpm tauri build              # Production build
pnpm build                    # TypeScript check + Vite production build
pnpm typecheck                # TypeScript type-check only (tsc --noEmit)
pnpm lint                     # ESLint
```

## Architecture

### Frontend (`src/`)

- **Entry point**: `src/main.tsx` → `src/App.tsx`
- **`@/` path alias** maps to `./src/` (configured in both `vite.config.ts` and `tsconfig.app.json`)
- **App.tsx** gates on `isTauriEnv()` — shows a browser fallback message if opened outside Tauri. The active UI is the `StackPanel` (local dev environment manager). Legacy sidebar-based tool navigation (`sidebar.tsx`, `home.tsx`) exists but is not wired in the current App shell.
- **`src/lib/tauri.ts`**: Thin wrapper over `@tauri-apps/api/core`. All Rust command invocations must go through this module's `invoke<T>()` function, which enforces the Tauri-env check. Other API modules (`stack-api.ts`, `clipboard-api.ts`, `settings-api.ts`) use this wrapper.
- **Component modules** are self-contained under `src/components/` (e.g., `calculator/`, `clipboard/`, `stack/`). Each major tool has its own directory with its own sub-components, utilities, and types.
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` plugin. Custom theme via CSS variables with `--sb-*` prefix (defined in `src/index.css`). Supports light/dark/system themes via `useTheme()` hook.
- **`src/lib/`** holds shared utilities: Tauri wrapper, toast system, settings API, clipboard API, stack API, theme hook, keyboard shortcut parsing, calendar store, lunar calendar, JSON formatting helpers, date-time utils, updater, and Chinese region/ID card data.

### Rust Backend (`src-tauri/`)

- **Crate name**: `app_lib` (lib type, entry in `src/lib.rs`)
- **`main.rs`** is a thin launcher; all logic is in `lib.rs`
- **`lib.rs`** registers all Tauri plugins (log, shell) and `invoke_handler` commands. On setup, it handles boot-service auto-launch for the stack components.
- **Module map**:
  - `app_paths.rs` — data/log directories under `%LOCALAPPDATA%\dev-env\`
  - `settings.rs` — AppSettings (auto-start, close-to-tray, shortcuts) persisted as JSON; manages OS autostart via `auto-launch` crate; includes `install_update_and_restart` command for self-update
  - `diagnostics.rs` — panic hook + `record_client_error` command (frontend errors forwarded to crash log)
  - `system.rs` — `system_get_metrics` command (CPU, memory, disk, network via `sysinfo`)
  - `clipboard/` — clipboard history monitor, SQLite database, image I/O, OCR (Windows Media OCR via WinRT, macOS Vision framework)
  - `stack/` — local dev environment manager: component manifests, download/extract, service lifecycle (nginx/openresty/apache, PHP, MySQL/MariaDB, Redis, RabbitMQ), site/host management, path env, CLI tool detection (composer, python, go, node), config generation, autostart on boot
- **Tauri commands** are the API contract between frontend and backend. All `stack_*` commands return `StackState`. Clipboard commands use SQLite.

### Data Storage

- `%LOCALAPPDATA%\dev-env\settings.json` — app settings
- `%LOCALAPPDATA%\dev-env\clipboard.db` — clipboard history (SQLite)
- `%LOCALAPPDATA%\dev-env\logs\` — rotating app logs (max 512KB × 3 files)
- `%LOCALAPPDATA%\dev-env\crash.log` — crash/frontend-error diagnostics

### CI/CD

- **GitHub Actions** (`.github/workflows/release.yml`): triggered by `v*` tags, builds Windows/Linux/macOS via `tauri-apps/tauri-action`, generates `latest.json` for auto-updater, creates GitHub Release
- **Gitee CI** (`.gitee-ci.yml`): mirror CI for Chinese users, same cross-platform matrix

## Key Patterns

- All Tauri `invoke` calls from the frontend go through typed wrapper functions in `src/lib/*-api.ts` files — never use raw `invoke` in components
- Stack state is polled every 5 seconds via `setInterval` in `StackPanel`, with visibility-change pause/resume to save resources
- The stack download progress uses Tauri events (`stack-download-progress`) emitted from Rust, listened to in the frontend
- Window close minimizes to tray by default (`close_to_tray` setting); `Ctrl+Shift+V` toggles window visibility
- The app uses `protocol-asset` feature to serve local files (e.g., clipboard images) via Tauri's asset protocol with scope `$LOCALDATA/dev-env/**`
- Panic hook and frontend error forwarding both write to `crash.log` for diagnostics
