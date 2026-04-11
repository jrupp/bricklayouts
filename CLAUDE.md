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
CI=true npx jasmine-browser-runner runSpecs --config=spec/support/jasmine-browser.ci.mjs
```

- ~667 specs, completes in ~6-7 seconds
- A WebGL patch is applied during CI for PixiJS v8 headless Chrome support

## Code style

- Follow [AirBnB JavaScript style guide](https://github.com/airbnb/javascript)
- ES modules (`import`/`export`), not CommonJS (`require`)
- 2-space indentation, semicolons required
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
