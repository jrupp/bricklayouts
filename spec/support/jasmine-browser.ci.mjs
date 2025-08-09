import base from './jasmine-browser.mjs';

export default {
  ...base,
  browser: {
    ...(base.browser || {}),
    name: 'chrome',
    headless: true
  }
};