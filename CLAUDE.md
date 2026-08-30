# BrickLayouts

## Build & run

```bash
npm install          # also runs postinstall to copy files from node_modules to src/
npm start            # starts local dev server
```

## Running tests

**Do NOT use `npm test`** — it starts an interactive server that will hang.

```bash
# Local headless tests (CI)
npx jasmine-browser-runner runSpecs --config=spec/support/jasmine-browser.ci.mjs
```

- ~1130 specs, completes in ~6-9 seconds
- A WebGL patch is applied during CI for PixiJS v8 headless Chrome support

## Code style

- Follow [AirBnB JavaScript style guide](https://github.com/airbnb/javascript)
- ES modules (`import`/`export`), not CommonJS (`require`)
- 2-space indentation, semicolons required
- 100-character line length. Avoid having lines of code that are longer than 100 characters (including whitespace)
- Blank lines must not contain spaces or tabs

## Project structure

- `src/controller/` — controllers (layoutController is the main one)
- `src/model/` — models (component, connection, etc.)
- `src/utils/` — utility functions
- `spec/support/` — test specs (`*.spec.mjs`) and test config files
- `data/` — manifest and layout JSON data
- Cloud infrastructure (CDK, Lambda) lives in the separate `cdk-infrastructure` repo

## Key technologies

PixiJS v8 (rendering), Jasmine (testing), Tabulator (tables), RBush (spatial indexing), BeerCSS (material design CSS), AWS Cognito (authentication)

## Important conventions

- **404.html must have identical content to index.html** — required for GitHub Pages SPA routing
- Tests should verify proper calls are made OR final observable state — do not write static code analysis tests
- If testing internal calls becomes too complex with mocks, test final observable state instead
- Keep changes minimal in scope
- Consider browser compatibility: desktop Chrome/Firefox/Safari/Edge, mobile Safari (iOS), mobile Chrome (iOS/Android)
- The Visual Viewport API handles iOS Chrome rotation — see `layoutController.js` `initWindowEvents()`
- API Gateway Cognito authorizer expects ID tokens, not access tokens

## Undo system

- `src/controller/undoManager.js` manages an undo buffer using the Command Pattern
- `UNDO_BUFFER_SIZE` (module export, default 3) controls the buffer depth
- When adding new operations that modify the layout (add/remove/edit components, modify layers), record an undo entry via `this.undoManager.record({ type, data })`
- Undo entries store minimal inverse data, not full snapshots — each entry references components/layers by UUID
- Use `suppress()`/`unsuppress()` around bulk automated operations (imports, resets) that should not be undoable
- The `#isUndoing` flag automatically prevents re-recording during undo execution
- Hotkey: Ctrl+Z / Cmd+Z (no redo)
- No entries are recorded when `LayoutController.readOnly` is true
