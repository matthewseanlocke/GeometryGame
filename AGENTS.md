# AGENTS.md

Guidance for autonomous coding agents working in this repository.

## Project Snapshot

- Stack: React 19 + TypeScript + Vite 7 + Tailwind CSS.
- Entry point: `src/main.tsx`.
- Main app: `src/App.tsx`.
- Canvas gameplay logic: `src/components/GameCanvas.tsx`.
- Geometry utilities and shared types: `src/utils/geometry.ts`.
- Class name merge helper: `src/utils/cn.ts`.
- Lint config: `eslint.config.js`.
- TS config: `tsconfig.app.json`, `tsconfig.node.json`.

## Rules Sources (Cursor / Copilot)

- `.cursorrules`: not present.
- `.cursor/rules/`: not present.
- `.github/copilot-instructions.md`: not present.
- Therefore, this file is the primary agent instruction source in-repo.

## Install / Setup

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Production build: `npm run build`
- Preview build: `npm run preview`

## Build / Lint / Test Commands

### Core commands

- `npm run dev` - run Vite dev server.
- `npm run build` - run `tsc -b` and Vite production build.
- `npm run lint` - run ESLint over the repo.
- `npm run preview` - serve the built app locally.

### Single-file linting

- Lint one file: `npx eslint src/components/GameCanvas.tsx`
- Lint a folder: `npx eslint src/components`

### Testing status

- There is currently no test script in `package.json`.
- There are no project test files under `src` (only dependency tests in `node_modules`).
- A direct "single test" command is not available until a test runner is added.

### Single-test command (when tests are introduced)

- Recommended future runner: Vitest for this Vite + TS stack.
- Typical single-file run: `npx vitest run src/utils/geometry.test.ts`
- Typical single-test-by-name run:
  `npx vitest run src/utils/geometry.test.ts -t "returns inside for nested polygon"`

### Known command caveats

- Vite warns if Node is below 20.19; repository currently builds but prints a version warning on 20.18.x.
- Lint currently reports several existing issues; do not assume lint is green before making changes.

## Coding Style Guidelines

Follow existing code conventions first; only introduce new patterns when they clearly improve maintainability.

### Imports

- Prefer ESM imports and explicit relative paths.
- Group imports: external packages first, then internal modules.
- Keep type-only imports explicit with `import type { ... }`.
- Avoid wildcard imports.
- Keep import lists stable and sorted if touching a file heavily.

### Formatting

- Respect existing formatting per file (some files use semicolons and 4-space indentation; newer files use 2 spaces and no semicolons).
- Do not reformat entire files unless requested.
- Keep functions short where practical; extract helpers for non-trivial geometry/math chunks.
- Prefer trailing commas in multiline literals where existing style already uses them.

### TypeScript usage

- Keep `strict` assumptions in mind (`tsconfig.app.json` has strict mode and unused checks).
- Always type public function params/returns in utility modules.
- Prefer precise union types (already used for `ShapeType`, `PlacementResult`).
- Avoid `any`.
- Avoid `@ts-ignore`; if suppression is unavoidable, use `@ts-expect-error` with a short reason.
- Use non-null assertions only when DOM invariants are guaranteed (e.g., root mount).

### React patterns

- Use function components and hooks.
- Keep hook dependency arrays correct; include referenced callbacks/values unless intentionally stable.
- Avoid declaring callbacks after effects/callbacks that consume them when lint rules complain about stale bindings.
- Prefer `useCallback`/`useMemo` only when they prevent real re-render or effect churn.
- Keep transient mutable animation state in refs (`useRef`) when frame-loop performance matters.

### State and data flow

- Keep app-level gameplay progression state in `App.tsx`.
- Keep canvas rendering/interactions local to `GameCanvas.tsx` unless cross-component coordination is needed.
- Derive display state from source state instead of duplicating values.
- When adding new game constants, define them near existing configuration constants.

### Naming conventions

- Components: `PascalCase` (`GameCanvas`, `ModeVisual`).
- Functions/variables: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` for global/static config values.
- Type aliases/interfaces: `PascalCase`.
- Event handlers: `handleX` naming (`handlePointerDown`, `handleLifeLost`).

### Error handling and logging

- Fail fast with guards for null DOM refs and invalid dimensions.
- Use early returns for invalid runtime conditions.
- Keep console logging minimal in committed code; remove noisy debug logs once behavior is validated.
- In non-critical browser API cleanup (e.g., pointer capture release), swallow expected errors deliberately and document intent briefly.

### Geometry and canvas logic

- Keep geometry calculations deterministic and side-effect free in `src/utils/geometry.ts`.
- Prefer pure helper functions for polygon math and collision checks.
- In animation loops, avoid per-frame allocations where possible.
- Preserve device-pixel-ratio scaling behavior when touching canvas setup or render loops.

### CSS / Tailwind

- Utility classes are used heavily; prefer utilities for straightforward styling.
- Inline `style` objects are acceptable for dynamic positioning and sizing in overlays/HUD.
- Reuse theme colors (`geo-dark`, existing cyan/red/purple accents) unless redesign is intentional.
- Keep animations centralized in `src/index.css` when reusable.

## Change Management for Agents

- Make minimal, focused changes for each task.
- Do not modify `dist/` unless explicitly asked.
- Do not edit `node_modules/`.
- If a change affects gameplay logic, sanity check both INSIDE and OUTSIDE phases.
- Run the narrowest verification command first, then broader checks.
- If UI/gameplay behavior changes, bump the on-screen build number in `src/App.tsx` (bottom-right HUD) using numeric format only: `vX.Y.Z`.

## Suggested Verification Flow

- For UI/gameplay tweaks: run `npm run dev` and manually verify interaction.
- For utility/type refactors: run `npm run build`.
- For lint-sensitive updates: run `npx eslint <changed-file>` then `npm run lint` if needed.
- If tests are added later: run single-test command first, then full test suite.

## Agent Output Expectations

- Report exactly which files changed.
- Include commands run and key outcomes (success/failure + notable warnings).
- Call out pre-existing issues separately from newly introduced issues.
- Offer concise next steps only when useful.
