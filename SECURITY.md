# Security

SkillTree Local is a local desktop application. It does not require a hosted backend and does not intentionally transmit vault content.

## Data

- Skill trees are stored on the local file system.
- Obsidian integration reads and writes the selected vault folder.
- Startup update checks contact GitHub Releases for version metadata and release assets.
- No skill tree content is sent to GitHub by the app.

## Auto Updates

The app updates from `aytzey/SkillTree` GitHub Releases. Release assets are selected by platform target triple and extracted locally.

Disable auto-update checks:

```bash
SKILLTREE_DISABLE_AUTO_UPDATE=1 skilltree-local
```

For private forks or rate-limit mitigation, provide a token at runtime:

```bash
GITHUB_TOKEN=... skilltree-local
```

Do not commit personal GitHub tokens, vault files, or `.env.local`.

## Reporting Issues

Open a GitHub issue with:

- operating system
- app version
- install method
- expected behavior
- actual behavior
- relevant logs or terminal output

Do not include private vault contents unless you have reduced them to a safe reproduction.
