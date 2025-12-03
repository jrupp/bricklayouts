# iOS Chrome Device Rotation Bug Fix

## Problem Statement
The application has a bug that only occurs on iOS Chrome browser when rotating the device, but does not happen on iOS Safari browser. The grid and layout display visual distortion for 1-2 seconds after rotation before correcting itself.

## Root Cause Analysis

### The Issue with iOS Chrome
iOS Chrome has several quirks that differ from iOS Safari:

1. **Viewport Resize Timing**: When rotating on iOS Chrome, the `resize` event may fire before the visual viewport has fully stabilized. iOS Chrome's address bar shows/hides during rotation, causing additional viewport resizes.

2. **PixiJS Renderer Lag**: PixiJS is configured with `resizeTo: canvasContainer` which means it has internal resize handling. However, on iOS Chrome rotation, the renderer's internal update lags behind the actual container dimension changes.

3. **Event Firing Order**: Analysis of real device logs showed that orientation change events fire before the container has actually resized, causing `app.screen` dimensions to be out of sync with the container dimensions when `drawGrid()` is called.

4. **Visual Viewport vs Layout Viewport**: iOS Chrome distinguishes between the "visual viewport" (what's visible) and the "layout viewport" (the full page size). During rotation, these can be out of sync temporarily.

### Specific Problem Identified from Device Logs
From testing on real iOS Chrome device:
```
[Rotation Debug] orientation change event - matches portrait: false app.screen: 393 x 665
[Rotation Debug] window.resize event - app.screen: 393 x 665 window: 734 x 337
[Rotation Debug] visualViewport.resize event - visualViewport: 734 x 337 app.screen: 393 x 665
[Rotation Debug] drawGrid called - app.screen: 734 x 665  // WRONG HEIGHT!
[Rotation Debug] drawGrid called - container: 734 x 337   // Correct dimensions
[Rotation Debug] Screen size mismatch detected!
```

The problem: `app.screen` dimensions (734 x 665) don't match container dimensions (734 x 337) when drawGrid is called, causing distortion until the forced resize corrects it.

## Solution Implemented

### Fix Strategy
1. **Visual Viewport API**: Listen to `visualViewport.resize` events for iOS Chrome's viewport changes
2. **Increased Debounce**: Use 500ms debounce for iOS Chrome (vs 300ms default) to allow viewport settling
3. **Proactive Renderer Resize**: Always force `renderer.resize()` to match container dimensions BEFORE calling `drawGrid()`

This ensures the renderer dimensions are correct immediately, preventing any visual distortion.

### Final Implementation

File: `src/controller/layoutController.js` - `initWindowEvents()` method

```javascript
initWindowEvents() {
  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this), delay);
    };
  }
  
  // Debounce delay constants (in milliseconds)
  const DEBOUNCE_DELAY_DEFAULT = 300;
  const DEBOUNCE_DELAY_IOS_CHROME = 500;
  
  // Detect iOS Chrome (CriOS in user agent)
  const isIOSChrome = /CriOS/.test(navigator.userAgent);
  
  // Use longer debounce on iOS Chrome to account for viewport settling
  const debounceDelay = isIOSChrome ? DEBOUNCE_DELAY_IOS_CHROME : DEBOUNCE_DELAY_DEFAULT;
  
  const debouncedHandler = debounce(() => {
    // Force PixiJS renderer to resize to match container dimensions
    // This ensures app.screen dimensions are correct before drawing the grid
    // PixiJS's internal resize handling may lag behind the actual container size change
    const container = document.getElementById('canvasContainer');
    if (container) {
      this.app.renderer.resize(container.clientWidth, container.clientHeight);
    }
    
    this.drawGrid();
    this._positionSelectionToolbar();
  }, debounceDelay);
  
  const orientationQuery = window.matchMedia('(orientation: portrait)');
  
  window.addEventListener('resize', debouncedHandler);
  orientationQuery.addEventListener('change', debouncedHandler);
  
  // Visual Viewport API listener (for iOS Chrome and modern browsers)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', debouncedHandler);
  }
}
```
  const isIOSChrome = /CriOS/.test(navigator.userAgent);
  
  // Use longer debounce on iOS Chrome to account for viewport settling
  const debounceDelay = isIOSChrome ? 500 : 300;
  
  const debouncedHandler = debounce(() => {
    this.drawGrid();
    this._positionSelectionToolbar();
  }, debounceDelay);
  
  // Traditional resize listener (works on all browsers)
  window.addEventListener('resize', debouncedHandler);
  
  // Orientation change listener (for browsers that support it)
  const orientationQuery = window.matchMedia('(orientation: portrait)');
  orientationQuery.addEventListener('change', debouncedHandler);
  
  // Visual Viewport API listener (for iOS Chrome and modern browsers)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', debouncedHandler);
  }
}
```

## Testing Plan

### Test Cases to Add

1. **Visual Viewport Resize Test**: Verify that when `visualViewport.resize` fires, the grid is redrawn
2. **iOS Chrome Detection Test**: Verify that iOS Chrome is properly detected
3. **Debounce Timing Test**: Verify that the debounce delay is 500ms for iOS Chrome and 300ms for other browsers
4. **Multiple Event Coordination**: Verify that rapid firing of resize, orientationchange, and visualViewport events all properly debounce to a single grid redraw

### Manual Testing Checklist

- [ ] Test on iOS Safari - rotation should work (baseline)
- [ ] Test on iOS Chrome - rotation should now work correctly
- [ ] Test on desktop Chrome - should continue to work
- [ ] Test on desktop Firefox - should continue to work
- [ ] Test on Android Chrome - should continue to work
- [ ] Verify grid is properly positioned after rotation
- [ ] Verify selection toolbar is properly positioned after rotation
- [ ] Verify no visual glitches or flashing during rotation

## Benefits of This Approach

1. **Minimal Code Changes**: Only modifies the `initWindowEvents()` method
2. **Backward Compatible**: Keeps existing listeners for browsers without Visual Viewport API
3. **Progressive Enhancement**: Uses modern APIs when available
4. **iOS Chrome Specific**: Addresses the specific timing issues in iOS Chrome
5. **No Breaking Changes**: Existing behavior on other browsers remains unchanged

## References

- [Visual Viewport API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API)
- [iOS Chrome Viewport Behavior](https://developers.google.com/web/updates/2016/12/url-bar-resizing)
- [Window.matchMedia() - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)
