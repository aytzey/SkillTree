# Architecture

SkillTree Local is a local-first desktop application. The Rust app owns the product experience; Obsidian is an optional second surface over the same files.

## Goals

- No hosted backend.
- No browser runtime requirement.
- Human-editable storage.
- Git-friendly file format.
- Usable with or without Obsidian.
- Releasable as native desktop binaries.

## Components

```text
Rust desktop app
  -> reads/writes Markdown nodes
  -> reads/writes _skilltree.json manifests
  -> renders and edits trees with egui/eframe
  -> checks GitHub Releases for startup updates

Obsidian plugin
  -> reads the same vault folder
  -> exposes commands inside Obsidian
  -> launches the desktop binary

Installer scripts
  -> install/check Obsidian
  -> build the Rust release binary
  -> install the desktop app
  -> install the Obsidian plugin

GitHub Actions
  -> compile and test desktop app
  -> build plugin bundle
  -> exercise installer/doctor paths
  -> publish release assets for auto-update
```

## Storage

The storage layer maps app state to a folder tree.

```text
SkillTree/<tree-slug>/
  tree.md
  _skilltree.json
  <node>.md
  <node>/
    <child-node>.md
```

Markdown is the user-facing document format. `_skilltree.json` is the durable graph manifest for data that Markdown is not ideal at preserving, such as stable IDs, node positions, dependency edges, and ordering.

## Data Flow

1. On startup, the app resolves a storage root from environment variables, the known local Obsidian vault, or the platform app-data directory.
2. The app scans tree folders and loads manifests.
3. Markdown frontmatter and content sections are parsed into node fields.
4. Edits are persisted back to Markdown and the manifest.
5. Obsidian can open the same files without import/export.

## Auto-Update Flow

1. Startup creates a background update thread.
2. The updater checks `aytzey/SkillTree` GitHub Releases.
3. `self_update` compares the latest compatible release with `CARGO_PKG_VERSION`.
4. If a release asset matches the current target triple, the archive is downloaded.
5. The binary inside the archive replaces the current executable.
6. The running process continues; the new version is used after restart.

Update checks can be disabled with:

```bash
SKILLTREE_DISABLE_AUTO_UPDATE=1 skilltree-local
```

## Release Assets

The release workflow packages the binary at the archive root because the updater expects:

```text
skilltree-local
skilltree-local.exe
```

Asset filenames include the target triple so the updater can select the correct platform:

```text
skilltree-local-v0.1.0-x86_64-unknown-linux-gnu.tar.gz
skilltree-local-v0.1.0-x86_64-apple-darwin.tar.gz
skilltree-local-v0.1.0-aarch64-apple-darwin.tar.gz
skilltree-local-v0.1.0-x86_64-pc-windows-msvc.zip
```

## Non-Goals

- Hosted sync service.
- Web deployment.
- Database server.
- Obsidian-only operation.
- Electron/webview rewrite.
