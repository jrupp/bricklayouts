import base from './jasmine-browser.mjs';

// Configuration for Copilot Agent sandbox environment
// This uses headlessChrome in offline mode to avoid hanging
// when selenium-manager tries to download chromedriver
export default {
  ...base,
  // Use the built-in headless config path that jasmine-browser-runner v3 understands
  browser: 'headlessChrome'
};
