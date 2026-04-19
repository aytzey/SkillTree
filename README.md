# SkillTree Local

[![CI](https://github.com/aytzey/SkillTree/actions/workflows/ci.yml/badge.svg)](https://github.com/aytzey/SkillTree/actions/workflows/ci.yml)

Local-first Rust desktop app for planning skills, learning paths, and project roadmaps as editable trees. SkillTree Local runs without a server, stores everything on disk, and can use an Obsidian vault as its native document database.

This repository is intentionally no longer a web deployment target. The old Next.js code is kept as migration history; the product direction is a desktop app plus an optional Obsidian plugin.

## Why This Project Stands Out

- Rust desktop GUI built with `egui/eframe`, not a webview wrapper.
- Obsidian-compatible storage: every tree and node is a Markdown note, with `_skilltree.json` preserving IDs, graph edges, layout, and metadata.
- Works with or without Obsidian. The desktop app can use a normal app-data folder or a real vault folder.
- Cross-platform setup scripts for Linux, macOS, and Windows.
- Installer checks for Obsidian and attempts a platform-native install when it is missing.
- Startup auto-update checks GitHub Releases in the background and replaces the local binary when a newer compatible release exists.
- CI validates Rust, the Obsidian plugin bundle, installer paths, and doctor checks on Linux, macOS, and Windows.
- Tagged releases publish platform-specific desktop binaries plus the Obsidian plugin bundle.

## Product Model

SkillTree Local treats the file system as the source of truth:

- A skill tree is a folder.
- A tree overview is `tree.md`.
- A node is a Markdown file.
- Child nodes can live inside nested folders.
- Machine-critical graph state is mirrored in `_skilltree.json`.

That means the same content can be edited from the Rust app, Obsidian, Git, or any Markdown editor.

```text
SkillTree/
  frontend-mastery/
    tree.md
    _skilltree.json
    01-foundations.md
    01-foundations/
      01-html-css.md
      02-accessibility.md
```

Node frontmatter is shared by the desktop app and Obsidian:

```yaml
treeId: frontend-mastery
nodeId: node_foundations
parentId:
status: in-progress
difficulty: 3
progress: 45
positionX: 120
positionY: 260
requires: []
recommended: true
optional: false
```

Markdown sections map directly to app fields:

- Text under the H1 becomes the node description.
- `## Subtasks` stores checkbox tasks.
- `## Notes` stores longer working notes.
- `## Resources` stores links and references.

## Architecture

```text
crates/skilltree-local/        Rust desktop app
obsidian-plugin/               Obsidian desktop integration
scripts/setup.mjs              Cross-platform installer
scripts/doctor.mjs             Local health checks
.github/workflows/ci.yml       Pull-request and push validation
.github/workflows/release.yml  GitHub Release binary publishing
legacy-web/                    Archived Next.js migration source
```

The desktop app owns the core product experience. The Obsidian plugin is intentionally thin: it reads the same files, opens the same vault folder, and can launch the native app.

Detailed architecture notes are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quick Start

Run from source:

```bash
cargo run -p skilltree-local
```

Install locally:

```bash
npm run setup
```

Use a specific Obsidian vault:

```bash
npm run setup -- --vault "/home/aytzey/Documents/Obsidian Vault"
```

Skip Obsidian checks:

```bash
npm run setup -- --skip-obsidian
```

Skip Linux system package installation during setup:

```bash
SKILLTREE_SKIP_SYSTEM_DEPS=1 npm run setup
```

The app defaults to `/home/aytzey/Documents/Obsidian Vault/SkillTree` on this machine when that vault exists. Otherwise it uses the platform app data directory.

Override storage manually:

```bash
SKILLTREE_STORAGE_ROOT="/path/to/SkillTree" cargo run -p skilltree-local
```

Or point directly at an Obsidian vault:

```bash
OBSIDIAN_VAULT_PATH="/home/aytzey/Documents/Obsidian Vault" \
SKILLTREE_OBSIDIAN_ROOT="SkillTree" \
cargo run -p skilltree-local
```

## Installer Behavior

`npm run setup` performs the complete local installation:

- checks for Rust/Cargo
- installs common Linux build dependencies when a supported package manager is available
- checks for Obsidian
- installs Obsidian first when it is missing and a supported package manager is available
- builds the Rust release binary
- installs the desktop app
- installs the Obsidian plugin into the selected vault
- writes plugin settings so Obsidian can launch the desktop app

Platform wrappers are available:

```bash
bash scripts/setup.sh
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
```

Linux direct desktop install:

```bash
bash scripts/install-desktop.sh
```

Linux installs the binary to `~/.local/bin/skilltree-local` and creates a desktop launcher at `~/.local/share/applications/skilltree-local.desktop`.

## Obsidian Integration

The Obsidian plugin is desktop-only because it launches a local binary and works directly with vault files.

Install the plugin into a vault:

```bash
npm run obsidian:install -- "/home/aytzey/Documents/Obsidian Vault"
```

Then enable `SkillTree Control` from Obsidian community plugins.

If the launch button cannot find the app, set `Desktop app path` in plugin settings to:

```text
/home/aytzey/.local/bin/skilltree-local
```

## Auto Updates

On every startup, the desktop app checks `aytzey/SkillTree` GitHub Releases on a background thread. If a newer compatible release exists and includes an asset for the current target triple, the app downloads the archive, extracts `skilltree-local`, and replaces the installed binary.

Disable startup update checks:

```bash
SKILLTREE_DISABLE_AUTO_UPDATE=1 skilltree-local
```

Use `GITHUB_TOKEN` when hitting GitHub API limits or when testing against a private fork:

```bash
GITHUB_TOKEN=... skilltree-local
```

Release tags should follow `vX.Y.Z`. The release workflow publishes assets named like:

```text
skilltree-local-v0.1.0-x86_64-unknown-linux-gnu.tar.gz
skilltree-local-v0.1.0-x86_64-apple-darwin.tar.gz
skilltree-local-v0.1.0-aarch64-apple-darwin.tar.gz
skilltree-local-v0.1.0-x86_64-pc-windows-msvc.zip
```

## Release

Create a release by pushing a tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions builds and uploads:

- Linux desktop binary
- macOS desktop binary
- Apple Silicon desktop binary
- Windows desktop binary
- Obsidian plugin zip

## Verification

```bash
cargo fmt --check
cargo check -p skilltree-local
cargo clippy -p skilltree-local -- -D warnings
cargo test -p skilltree-local
npm run obsidian:build
npm audit
npm run doctor
```

## Legacy Web Code

The old Next.js app is archived under `legacy-web/` only as migration context. Its dependencies are intentionally removed from the root package so the active project installs quickly and audits cleanly.

Root commands now target the Rust desktop app:

```bash
npm run dev
npm run build
npm run start
```
