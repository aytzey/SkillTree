# Contributing

SkillTree Local is desktop-first. New product work should improve the Rust app, the local file model, installer reliability, or Obsidian interoperability.

## Development

```bash
npm ci
cargo run -p skilltree-local
```

Build the desktop app:

```bash
cargo build -p skilltree-local --release
```

Build the Obsidian plugin:

```bash
npm run obsidian:build
```

## Verification

Run these before opening a pull request:

```bash
cargo fmt --check
cargo check -p skilltree-local
cargo clippy -p skilltree-local -- -D warnings
cargo test -p skilltree-local
npm run obsidian:build
npm audit
npm run doctor -- --skip-obsidian
```

## Project Rules

- Keep the app usable without a network connection after installation.
- Keep Markdown and `_skilltree.json` backward compatible whenever possible.
- Do not make web deployment the primary path.
- Keep the Obsidian plugin thin; shared behavior belongs in the desktop app or storage model.
- Prefer focused changes with clear verification.

## Release Process

1. Update versions in `crates/skilltree-local/Cargo.toml`, `package.json`, and `obsidian-plugin/skilltree-control/manifest.json`.
2. Update `CHANGELOG.md`.
3. Run the verification commands.
4. Tag the release:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

The release workflow builds and uploads the platform assets used by startup auto-update.
