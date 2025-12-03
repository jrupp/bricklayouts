# GitHub Copilot Agent Instructions for BrickLayouts

This file contains important instructions for GitHub Copilot Coding Agents working on this repository.

## Running Tests

**IMPORTANT**: Do NOT use `npm test` to run tests, as it starts an interactive server that will hang.

### Correct way to run tests:

```bash
CI=true npx jasmine-browser-runner runSpecs --config=spec/support/jasmine-browser.ci.mjs
```

**Key points:**
- Set `CI=true` environment variable to run tests in headless Chrome mode
- Use the CI configuration file `spec/support/jasmine-browser.ci.mjs`
- Chrome/Chromium is already available in the GitHub Actions runner environment (no installation needed)
- This command runs tests in CI mode and will complete automatically in GitHub Actions
- **Note for Agents**: In the sandbox environment, this command may hang waiting for browser completion. The tests will run successfully in GitHub Actions CI. You can validate syntax instead with `node -c <filename>`

### Alternative: Syntax Check Only

If tests hang in the sandbox, you can at least validate JavaScript syntax:

```bash
node -c src/controller/layoutController.js
```

### Test Files Location

- Test specifications are in: `spec/support/`
- Test configuration: `spec/support/jasmine-browser.ci.mjs` (CI mode) and `spec/support/jasmine-browser.mjs` (interactive mode)

## Building and Development

### Install Dependencies

```bash
npm install
```

This will also run the `postinstall` script which copies required files from node_modules to src/.

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

## Key Technologies

- **PixiJS v8** - 2D rendering engine
- **Jasmine** - Testing framework
- **Tabulator** - Table/grid library
- **RBush** - Spatial indexing library

## Common Tasks

### Adding New Tests

Add test files to `spec/support/` with the pattern `*.spec.mjs`.

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

See `IOS_CHROME_ROTATION_FIX.md` for details on handling iOS Chrome rotation issues.

### Testing on Different Browsers

The app should work on:
- Desktop Chrome, Firefox, Safari, Edge
- Mobile Safari (iOS)
- Mobile Chrome (iOS and Android)

## Linting and Code Quality

Currently, there are no automated linting tools configured. Follow the existing code style in the repository.

## Important Notes for Agents

1. **Always run tests before and after making changes** to ensure nothing breaks
2. **Use the correct test command** (see above) - do not use `npm test`
3. **Check existing tests** in `spec/support/` before adding new ones to understand the testing patterns
4. **Keep changes minimal** - this is a working application, so minimize the scope of changes
5. **Browser compatibility matters** - consider iOS Chrome, Safari, and desktop browsers when making changes
6. **The Visual Viewport API** is used to handle iOS Chrome rotation issues - see layoutController.js `initWindowEvents()`
