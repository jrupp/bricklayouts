/**
 * Returns true if `value` is (approximately) a multiple of `step` within a small tolerance.
 * This avoids floating-point issues like (614.4 % 51.2) !== 0.
 *
 * @param {number} value
 * @param {number} step
 * @param {number} [eps=1e-6] Tolerance on the quotient's distance to the nearest integer
 * @returns {boolean}
 */
export function isApproxMultiple(value, step, eps = 1e-6) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step === 0) return false;
  const q = value / step;
  return Math.abs(q - Math.round(q)) < eps;
}


/**
 * Gets the index of an option in a select element by its value.
 *
 * @param {string} selectElementId - The ID of the select element.
 * @param {string} optionValue - The value of the option to find.
 * @param {number} [defaultValue=-1] - The default value to return if not found.
 * @returns {number} The index of the option, or the default value if not found.
 */
export function getOptionIndexByValue(selectElementId, optionValue, defaultValue = -1) {
  const selectElement = document.getElementById(selectElementId);

  if (!selectElement) {
    console.warn(`Select element with ID '${selectElementId}' not found.`);
    return defaultValue;
  }

  // Iterate through the options collection of the select element
  for (let i = 0; i < selectElement.options.length; i++) {
    if (selectElement.options[i].value === optionValue) {
      return i; // Return the index if the value matches
    }
  }

  return defaultValue;
}

/**
 * Detects if the current browser is running on iOS (iPhone, iPad, iPod).
 * This includes Safari, Chrome, Firefox, and other browsers on iOS.
 *
 * @returns {boolean} True if running on iOS, false otherwise.
 */
export function isIOSBrowser() {
  // Check for iOS devices using user agent
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // Check for iPhone, iPod in user agent
  // Temporarily removed 'iPad' until I have time to actually test it on iPadOS
  const isIOSDevice = /iPhone|iPod/.test(userAgent);
  
  // Additional check for iOS 13+ on iPad which may show desktop user agent
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  // Temporarily removed ' || isIPadOS' until I have time to actually test it on iPadOS
  return isIOSDevice;
}