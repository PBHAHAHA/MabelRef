# Agent Collaboration Guide

This repository may be edited by human maintainers and AI coding agents. Agents should optimize for small, reviewable changes and keep the project easy to understand.

## Project Principles

- Keep the app local-first and dependable.
- Prefer simple, explicit code over broad abstractions.
- Respect Electron process boundaries.
- Do not commit generated build output.
- Do not commit secrets, certificates, private keys, tokens, or local environment files.
- Update documentation when behavior, commands, release flow, or architecture changes.

## Architecture

MabelRef is an Electron Vue desktop application.

```text
src/
  main/       Electron main process, native APIs, IPC handlers
  preload/    secure renderer bridge
  renderer/   Vue UI and canvas workflow
  shared/     dependency-light project and library logic
build/        packaging resources
resources/    runtime assets
docs/         release and maintainer documentation
tests/        Node test suite
```

## Development Commands

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```

## Change Discipline

Before editing:

1. Read the files that own the behavior.
2. Check existing tests and local patterns.
3. Keep the change scoped to the requested problem.

Before finishing:

1. Run the most relevant available check.
2. Report any failing check and whether it predates the change.
3. Summarize changed files and user-visible impact.

## Documentation Map

- `README.md`: public project overview and setup.
- `CONTRIBUTING.md`: contribution rules.
- `SECURITY.md`: vulnerability reporting.
- `CODE_OF_CONDUCT.md`: community behavior.
- `CHANGELOG.md`: release notes.
- `docs/windows-signing.md`: Windows signing policy.
- `docs/open-source.md`: public release readiness.
- `CLAUDE.md` and nested `CLAUDE.md` files: repository navigation notes.
