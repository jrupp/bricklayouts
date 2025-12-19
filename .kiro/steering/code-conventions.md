---
inclusion: always
---

# Instructions for Kiro

## Code Conventions

Currently, there are no automated linting tools configured.
This project wants to follow the AirBNB JavaScript style guide as closely as possible, but has not implemented that in all files yet. For all new code, follow the AirBNB style guide as closely as possible. Especially pay attention to:
- 2 space indentation
- Use of semicolons
- Blank lines should not have spaces or tabs

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
