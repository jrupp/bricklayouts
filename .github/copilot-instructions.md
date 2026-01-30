# GitHub Copilot Agent Instructions for BrickLayouts

This file contains important instructions for GitHub Copilot Coding Agents working on this repository.

## Running Tests

**IMPORTANT**: Do NOT use `npm test` to run tests, as it starts an interactive server that will hang.

### Correct way to run tests in the Copilot Agent sandbox:

```bash
SE_MANAGER_PATH=$(pwd)/.github/selenium-manager-offline.sh npx jasmine-browser-runner runSpecs --config=spec/support/jasmine-browser.agent.mjs
```

**Key points:**
- The `SE_MANAGER_PATH` environment variable points to a wrapper script that forces selenium-manager to run in offline mode
- This prevents selenium-manager from trying to download chromedriver, which would hang in the sandbox environment
- The wrapper script uses the system-installed chromedriver and Chrome that are already available
- Use the agent configuration file `spec/support/jasmine-browser.agent.mjs` (for agent sandbox)
- Tests complete in ~6-7 seconds with 666 specs
- **Note**: In GitHub Actions, a patch is automatically applied to enable WebGL support in headless Chrome, which is required for PixiJS v8 tests. This patch only runs in CI, not during local development.

### Alternative test commands:

**For GitHub Actions CI:**
```bash
CI=true npx jasmine-browser-runner runSpecs --config=spec/support/jasmine-browser.ci.mjs
```

**For local interactive development:**
```bash
npm start  # then navigate to the jasmine test page
```

### Why the special configuration is needed:

The selenium-webdriver library (used by jasmine-browser-runner) includes a selenium-manager tool that automatically downloads browser drivers. In the sandbox environment, selenium-manager's network requests hang indefinitely, preventing tests from running. The solution uses selenium-manager's `--offline` flag to skip downloads and use the system-installed chromedriver instead.

### Test Files Location

- Test specifications are in: `spec/support/`
- Test configuration files:
  - `spec/support/jasmine-browser.agent.mjs` - Agent sandbox configuration
  - `spec/support/jasmine-browser.ci.mjs` - CI configuration  
  - `spec/support/jasmine-browser.mjs` - Interactive development configuration

## Building and Development

### Install Dependencies

```bash
npm install
```

This will run the `postinstall` script which copies required files from node_modules to src/.

**Note**: The jasmine-browser-runner WebGL patch is only applied in GitHub Actions CI, not during local development. Local developers can run tests normally without needing the patch.

### Start Development Server

```bash
npm start
```

This starts an http-server for local development at the address shown on screen.

## Project Structure

- `src/` - Source code
  - `src/controller/` - Controller classes (layoutController, etc.)
  - `src/model/` - Model classes (component, connection, etc.)
  - `src/utils/` - Utility functions
- `spec/` - Test specifications
- `data/` - Manifest and layout data
- `index.html` - Main application entry point
- `styles.css` - Main stylesheet
- `404.html` - This is a single page app, so 404.html should have the exact same content as `index.html`, to support GitHub Pages routing.

## Key Technologies

- **PixiJS v8** - 2D rendering engine
- **Jasmine** - Testing framework
- **Tabulator** - Table/grid library
- **RBush** - Spatial indexing library
- **BeerCSS** - CSS utility library for material design styling

## Common Tasks

### Adding New Tests

Add test files to `spec/support/` with the pattern `*.spec.mjs`.

Tests should either check that all the proper calls are made, or that the final observable state is correct. Do not write static code analysis tests. If testing all of the internal calls becomes too complex or requires too many mocks, focus on testing the final observable state instead.

### Modifying Controllers

Main controller is `src/controller/layoutController.js` - handles layout, canvas, and user interactions.

### Working with Components

Components are defined in `src/model/component.js` and use data from `data/manifest.json`.

## Browser Compatibility Notes

### iOS Chrome Specifics

iOS Chrome has unique behavior regarding:
- Viewport resizing during rotation
- Visual viewport vs layout viewport
- Address bar showing/hiding
- `matchMedia` orientation change events

### Testing on Different Browsers

The app should work on:
- Desktop Chrome, Firefox, Safari, Edge
- Mobile Safari (iOS)
- Mobile Chrome (iOS and Android)

## Linting and Code Quality

Currently, there are no automated linting tools configured.
This project wants to follow the AirBNB JavaScript style guide as closely as possible, but has not implemented that in all files yet. For all new code, follow the AirBNB style guide as closely as possible. Especially pay attention to:
- 2 space indentation
- Use of semicolons
- Blank lines should not have spaces or tabs

## Important Notes for Agents

1. **Always run tests before and after making changes** to ensure nothing breaks
2. **Use the correct test command** (see above) - do not use `npm test`
3. **Check existing tests** in `spec/support/` before adding new ones to understand the testing patterns
4. **Keep changes minimal** - this is a working application, so minimize the scope of changes
5. **Browser compatibility matters** - consider iOS Chrome, Safari, and desktop browsers when making changes
6. **The Visual Viewport API** is used to handle iOS Chrome rotation issues - see layoutController.js `initWindowEvents()`
