import base from './jasmine-browser.mjs';

// Configuration for Copilot Agent sandbox environment
// Uses headlessChrome for automated testing. The selenium-manager is run in
// offline mode via the SE_MANAGER_PATH wrapper script to avoid hanging when
// trying to download chromedriver. See .github/copilot-instructions.md for
// the correct test command.
export default {
  ...base,
  // Use the built-in headless config path that jasmine-browser-runner v3 understands
  browser: 'headlessChrome'
};
