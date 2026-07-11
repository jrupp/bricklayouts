import base from './jasmine-browser.mjs';

process.env.CI = 'true';

export default {
  ...base,
  // Use the built-in headless config path that jasmine-browser-runner v3 understands
  browser: 'headlessChrome'
};