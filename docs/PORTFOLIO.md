# Portfolio Case Study

SkillTree Local is a desktop-first rewrite of a web skill-tree planner. The goal is to turn personal roadmaps into durable local documents that work in a native app, Obsidian, Git, and plain Markdown.

## Problem

Most roadmap tools are either hosted web apps or canvas files locked to one product. SkillTree Local treats learning plans as local documents:

- readable without the app
- versionable with Git
- editable from Obsidian
- structured enough for graph operations
- portable across machines

## Engineering Decisions

| Decision | Reason |
| --- | --- |
| Rust desktop app with `egui/eframe` | Native binary, fast startup, no bundled browser runtime. |
| Markdown plus JSON manifest | Markdown stays human-editable; JSON preserves graph IDs, edges, layout, and metadata. |
| Thin Obsidian plugin | Avoid duplicating product logic inside plugin JavaScript. |
| GitHub Release auto-update | Simple distribution model for standalone binaries. |
| Archived web prototype | Preserves migration history without confusing the active product direction. |

## Implementation Highlights

- Cross-platform Rust GUI in `crates/skilltree-local`.
- Obsidian-compatible vault mapping:
  - `tree.md` for tree entry notes
  - one Markdown file per skill node
  - nested folders for parent/child structure
  - `_skilltree.json` for graph state
- Desktop-only Obsidian plugin in `obsidian-plugin/skilltree-control`.
- Installer scripts:
  - `scripts/setup.mjs`
  - `scripts/setup.sh`
  - `scripts/setup.ps1`
  - `scripts/doctor.mjs`
- CI and release workflows:
  - Linux, macOS, Windows validation
  - Obsidian plugin bundle build
  - tagged desktop binary releases
  - release assets for startup auto-update

## Quality Signals

Local verification for the first release:

```bash
cargo fmt --check
cargo check -p skilltree-local
cargo clippy -p skilltree-local -- -D warnings
cargo test -p skilltree-local
npm run obsidian:build
npm audit
npm run doctor
```

GitHub verification:

- CI on `main`: green
- CI on `v0.1.0`: green
- Release workflow on `v0.1.0`: green
- Release assets published for Linux, macOS Intel, macOS Apple Silicon, Windows, and Obsidian

## What This Shows

This project is meant to show more than UI work:

- product direction
- migration judgment
- local data modeling
- native app packaging
- automation discipline
- cross-platform release thinking
- integration with an existing ecosystem, Obsidian

## Next Technical Improvements

- Signed update verification.
- More focused storage parser tests.
- Import/export test fixtures.
- App icons and signed installers.
- A screenshot or short demo video in the README.
- Optional graph layout engine for larger trees.
