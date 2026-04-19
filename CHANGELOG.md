# Changelog

All notable changes to SkillTree Local are documented here.

## 0.2.0

- Reworked the desktop UI to match the design handoff: macOS-style title row, two-row chrome with tag filter chips, sidebar + inspector framing.
- Embedded Cinzel and Inter TTFs so typography is consistent across platforms.
- Rewrote canvas rendering with GPU-interpolated radial-gradient meshes (background, vignette, orb body, halo) and smoothed edge glow.
- Polished inspector layout: square status pill, Details / Markdown tabs, gold-fill subtask checkboxes, mixed-case body type.
- Added an in-memory demo tree for fresh storage roots so the canvas is never barren on first launch.
- Added an OpenRouter integration: Settings modal with API key + model picker, Conjure (⌘J) dialog that generates prereq child skills with strict-JSON responses and writes them onto the canvas.
- API key is stored per-user at `~/.config/skilltree-local/settings.json` (mode 0600); nothing sensitive is tracked by git.

## 0.1.0

- Repositioned the project as a local-first Rust desktop app.
- Added `egui/eframe` native GUI entry point.
- Added Obsidian-compatible Markdown and JSON storage.
- Added optional Obsidian desktop plugin integration.
- Added cross-platform setup scripts for Linux, macOS, and Windows.
- Added installer behavior that checks for Obsidian and attempts platform-native installation when missing.
- Added startup GitHub Release auto-update support.
- Added CI across Linux, macOS, and Windows.
- Added release workflow that publishes desktop binaries and the Obsidian plugin bundle.
