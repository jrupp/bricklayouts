---
inclusion: always
---

# Testing Conventions

## Running Tests

To run the test suite for this project, use:

```bash
npx jasmine-browser-runner runSpecs --config=spec/support/jasmine-browser.agent.mjs
```

**Do NOT use** `npm test` or other commands - always use the command above.

## Test Framework

- **Unit Testing**: Jasmine (browser-based)
- **Property-Based Testing**: fast-check
- **Test Location**: `spec/support/` directory

## Test File Organization

- `spec/support/componentGroup.spec.mjs` - Tests for ComponentGroup model
- `spec/support/pose.spec.mjs` - Tests for Pose model
- `spec/support/layoutLayer.spec.mjs` - Tests for LayoutLayer model
- `spec/support/utils.spec.mjs` - Tests for anything in `src/utils/utils.js`
- `spec/support/something.spec.mjs` - Tests for LayoutController and other components
- When adding LayoutController tests, place them inside the existing `describe()` group for LayoutController
- Use the real (not mocked) LayoutController for tests
