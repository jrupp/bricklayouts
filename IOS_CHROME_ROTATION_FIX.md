# iOS Chrome Device Rotation Bug Fix

## Problem Statement
The application has a bug that only occurs on iOS Chrome browser when rotating the device, but does not happen on iOS Safari browser.

## Root Cause Analysis

### Current Implementation
The current implementation in `src/controller/layoutController.js` (lines 2303-2324) uses:
1. `window.addEventListener('resize', ...)` for window resize events
2. `window.matchMedia('(orientation: portrait)').addEventListener('change', ...)` for orientation changes

### The Issue with iOS Chrome
iOS Chrome has several quirks that differ from iOS Safari:

1. **Viewport Resize Timing**: When rotating on iOS Chrome, the `resize` event may fire before the visual viewport has fully stabilized. iOS Chrome's address bar shows/hides during rotation, causing additional viewport resizes.

2. **matchMedia Reliability**: The `matchMedia` orientation change listener in iOS Chrome can sometimes not fire, or fire at unexpected times due to iOS Chrome's unique handling of the viewport during rotation.

3. **Visual Viewport vs Layout Viewport**: iOS Chrome distinguishes between the "visual viewport" (what's visible) and the "layout viewport" (the full page size). During rotation, these can be out of sync temporarily.

4. **Address Bar Behavior**: Unlike Safari, Chrome on iOS shows/hides its address bar during scrolling and rotation, which causes the viewport size to change multiple times.

### Specific Problem
The current code listens to the `matchMedia` orientation change event, but on iOS Chrome:
- The orientation change event may fire before the viewport dimensions are fully updated
- The debounce delay (300ms) may not be sufficient for iOS Chrome to settle
- The visual viewport may not match the layout viewport when `drawGrid()` is called

## Solution Plan

### Fix Strategy
Use the **Visual Viewport API** in addition to the existing resize listener to better handle iOS Chrome's behavior:

1. **Add Visual Viewport Listener**: Listen to `visualViewport.resize` events (available in modern browsers including iOS Chrome)
2. **Increase Debounce Delay on iOS Chrome**: Detect iOS Chrome and use a longer debounce delay (500ms instead of 300ms)
3. **Keep Existing matchMedia Listener**: Maintain backward compatibility with browsers that don't support Visual Viewport API

### Implementation Steps

1. **Detect iOS Chrome**: Add browser detection for iOS Chrome specifically
2. **Add Visual Viewport Support**: Check for Visual Viewport API availability and add listener
3. **Adjust Debounce Timing**: Use longer debounce for iOS Chrome
4. **Ensure Handler Calls**: Make sure all paths call the same debounced handler

### Code Changes Required

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
  
  // Detect iOS Chrome
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
