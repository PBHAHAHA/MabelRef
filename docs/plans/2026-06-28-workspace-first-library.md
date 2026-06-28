# Workspace First Library Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fixed default library with a user-selected workspace folder that owns all categories and `.mabel` canvas files.

**Architecture:** The main process becomes the filesystem authority: it stores the last workspace path in Electron userData, validates that category/project paths stay inside the active workspace, scans categories from workspace subfolders, and writes `.mabel` files there. The renderer shows a workspace chooser before the editor and uses one project path as the single save target.

**Tech Stack:** Electron main/preload IPC, Vue 3 renderer components, Node `fs/promises`, shared pure modules tested with `node:test`.

---

### Task 1: Shared Workspace Model

**Files:**

- Create: `src/shared/mabelWorkspace.mjs`
- Test: `tests/mabelWorkspace.test.mjs`
- Modify: `src/shared/CLAUDE.md`

**Step 1: Write the failing tests**

Test that a workspace manifest is created with the expected shape, category/project tree scanning ignores hidden metadata, and containment validation rejects paths outside the workspace.

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because `src/shared/mabelWorkspace.mjs` does not exist.

**Step 3: Implement the pure module**

Create functions:

- `createWorkspaceManifest({ name, createdAt })`
- `normalizeWorkspaceTree({ rootPath, entries })`
- `isPathInside(parentPath, childPath)`

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS.

### Task 2: Main Process Workspace IPC

**Files:**

- Modify: `src/main/index.js`
- Modify: `src/preload/index.js`
- Modify: `src/main/CLAUDE.md`
- Modify: `src/preload/CLAUDE.md`

**Step 1: Add IPC design**

Expose:

- `workspace:get-current`
- `workspace:choose`
- `workspace:create`
- `workspace:scan`

Update library IPC to use the active workspace root instead of `~/Documents/Mabel Library`.

**Step 2: Implement active workspace persistence**

Store last workspace path in `app.getPath('userData')/workspace.json`. If missing or invalid, return `null` so renderer shows the chooser.

**Step 3: Validate category/project writes**

Before create category, create canvas, save, or open project, verify the target path is inside the active workspace.

**Step 4: Run verification**

Run: `npm test && npm run lint && npm run build`.

### Task 3: Renderer Workspace Gate

**Files:**

- Create: `src/renderer/src/components/WorkspaceGate.vue`
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/components/Sidebar.vue`
- Modify: `src/renderer/src/assets/main.css`
- Modify: renderer `CLAUDE.md` files

**Step 1: Add workspace state to App**

`App.vue` loads `window.api.workspace.getCurrent()` on mount. If no workspace exists, render `WorkspaceGate`; otherwise render the two-column editor.

**Step 2: Build chooser UI**

`WorkspaceGate` has two direct actions:

- Open workspace folder
- Create workspace folder

Both actions call IPC and then hand the workspace tree back to App.

**Step 3: Simplify save/new behavior**

Current project path becomes the save target. Sidebar `Save` saves current canvas to active project if one exists, and `Save As` remains a later feature.

**Step 4: Run verification**

Run: `npm test && npm run lint && npm run build`.

### Task 4: Documentation And Cleanup

**Files:**

- Modify: `src/CLAUDE.md`
- Modify: `src/shared/CLAUDE.md`
- Modify: `src/renderer/src/components/CLAUDE.md`
- Modify: `src/renderer/src/assets/CLAUDE.md`

**Step 1: Update architecture docs**

Document that workspace is the root, category is a folder, and canvas is a `.mabel` file.

**Step 2: Remove stale default library wording**

Search for `Mabel Library`, `default library`, and stale save/open references.

**Step 3: Final verification**

Run:

- `npm test`
- `npm run lint`
- `npm run build`
