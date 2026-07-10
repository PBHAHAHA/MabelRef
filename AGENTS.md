# MabelRef Agent Notes

MabelRef is an Electron Vue desktop application for visual reference boards.

## Stack

- Electron
- electron-vite
- Vue 3
- electron-builder
- Leafer Editor
- lucide-vue-next

## Repository Layout

```text
src/        application code
build/      packaging icons and platform resources
resources/  runtime static assets
docs/       release and maintainer documentation
out/        electron-vite build output
dist/       packaged application output
tests/      Node test suite
```

## Important Config

- `package.json`: scripts, dependencies, and Electron entry point
- `electron.vite.config.mjs`: main, preload, and renderer Vite config
- `electron-builder.yml`: packaging rules
- `eslint.config.mjs`: lint rules
- `AGENT.md`: collaboration guide for coding agents

## Rules

- Keep changes small and reviewable.
- Preserve Electron main/preload/renderer boundaries.
- Do not commit secrets, certificates, private keys, `.env` files, `out/`, or `dist/`.
- Update public Markdown files when release, signing, setup, or contributor behavior changes.
- Prefer `rg` for repository searches.
