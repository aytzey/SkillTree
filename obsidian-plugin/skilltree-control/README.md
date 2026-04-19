# SkillTree Control for Obsidian

This is a desktop-only Obsidian plugin for controlling SkillTree Local roadmaps from vault folders and Markdown notes. It is intentionally thin: the Rust desktop app owns the core product experience, while this plugin exposes the same files inside Obsidian and can launch the native app.

## Vault mapping

- `SkillTree/<tree-slug>/tree.md` is the tree entry note.
- `SkillTree/<tree-slug>/_skilltree.json` is the canonical manifest that preserves node IDs, edge IDs, layout, and graph metadata.
- Every skill node is a Markdown note below the tree folder.
- Parent/requirement structure is reflected as nested Obsidian folders where possible.
- Node frontmatter stores the exact SkillTree fields (`nodeId`, `treeId`, `status`, `progress`, `positionX`, `positionY`, `requires`, `recommended`, `optional`).
- Markdown body sections map back to node content:
  - text under the H1 maps to `description`
  - `## Subtasks` checkboxes map to `subTasks`
  - `## Notes` maps to `notes`
  - `## Resources` links map to `resources`

## Local install

From the repo root:

```bash
npm run obsidian:install -- /absolute/path/to/your/ObsidianVault
```

Then restart Obsidian or reload community plugins and enable `SkillTree Control`.

The installer writes `data.json` with:

- `rootFolder`: the vault folder that contains skill trees
- `desktopAppPath`: the local native binary to launch

## Release bundle

Tagged GitHub releases include `skilltree-control-vX.Y.Z.zip` with:

- `manifest.json`
- `main.js`
- `styles.css`
