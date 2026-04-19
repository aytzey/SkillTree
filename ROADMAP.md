# Roadmap

SkillTree Local is already usable as a local-first desktop app with Obsidian-compatible storage. This roadmap keeps future work visible and makes it clear where contributions can land.

## Near Term

- Add app icon assets for Linux, macOS, and Windows.
- Add README screenshots and a short demo recording.
- Add more storage round-trip fixtures.
- Add release smoke tests that inspect published archives.
- Improve first-run empty state and sample tree creation.

## Desktop

- Better keyboard navigation.
- Search across trees and nodes.
- Drag-and-drop node ordering.
- Larger-tree layout improvements.
- Native file menu actions.

## Obsidian

- Commands for opening a tree from the active note.
- Better plugin status panel.
- Vault health check command.
- Bidirectional refresh hints when files change outside the app.

## Distribution

- Signed release assets.
- macOS app bundle packaging.
- Windows installer packaging.
- Linux AppImage or Flatpak packaging.
- Auto-update signature verification.

## Data Model

- Versioned manifest migrations.
- Conflict detection for simultaneous edits.
- Import/export fixtures.
- More explicit dependency metadata documentation.

## Non-Goals

- Hosted backend.
- Forced accounts.
- Web deployment as the primary product.
- Locking user data into a binary-only format.
