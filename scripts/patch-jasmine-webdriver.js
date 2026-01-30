#!/usr/bin/env node
/**
 * Patches jasmine-browser-runner to enable GPU in headless Chrome for WebGL support.
 * 
 * PixiJS v8 requires WebGL to be available, but jasmine-browser-runner v3's default
 * headlessChrome configuration includes --disable-gpu which prevents WebGL from working.
 * This script patches the webdriver.js file to remove --disable-gpu and add flags needed
 * for WebGL to work in headless Chrome.
 */

const fs = require('fs');
const path = require('path');

const webdriverPath = path.join(__dirname, '..', 'node_modules', 'jasmine-browser-runner', 'lib', 'webdriver.js');

if (!fs.existsSync(webdriverPath)) {
  console.log('jasmine-browser-runner webdriver.js not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(webdriverPath, 'utf8');

// Replace the headlessChrome configuration to enable GPU and WebGL
const oldConfig = `      const caps = webdriver.Capabilities.chrome();
      caps.set('goog:chromeOptions', {
        args: [
          '--headless=new',
          '--no-sandbox',
          'window-size=1024,768',
          '--disable-gpu',
          '--disable-dev-shm-usage', // flag needed to avoid issues within docker https://stackoverflow.com/questions/56218242/headless-chromium-on-docker-fails
        ],
      });`;

const newConfig = `      const caps = webdriver.Capabilities.chrome();
      caps.set('goog:chromeOptions', {
        args: [
          '--headless=new',
          '--no-sandbox',
          'window-size=1024,768',
          '--disable-dev-shm-usage', // flag needed to avoid issues within docker https://stackoverflow.com/questions/56218242/headless-chromium-on-docker-fails
          '--enable-webgl',
          '--use-gl=angle',
          '--use-angle=swiftshader',
        ],
      });`;

if (content.includes(oldConfig)) {
  content = content.replace(oldConfig, newConfig);
  fs.writeFileSync(webdriverPath, content, 'utf8');
  console.log('✓ Patched jasmine-browser-runner to enable WebGL in headless Chrome');
} else if (content.includes('--enable-webgl')) {
  console.log('✓ jasmine-browser-runner already patched for WebGL');
} else {
  console.warn('⚠ Could not find expected configuration in webdriver.js - manual patching may be required');
  process.exit(1);
}
