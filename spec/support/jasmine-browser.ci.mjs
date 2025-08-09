import base from './jasmine-browser.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Create a unique temporary profile directory for Chrome on each CI run
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jasmine-chrome-'));

export default {
  ...base,

  // Force Chrome in CI, headless
  browser: {
    ...(base.browser || {}),
    name: 'chrome',
    headless: true
  },

  // Pass Chrome flags via Selenium capabilities
  // This avoids profile lock issues and common CI pitfalls.
  capabilities: {
    'goog:chromeOptions': {
      args: [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        `--user-data-dir=${userDataDir}`
      ]
    }
  }
};