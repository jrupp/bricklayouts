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

let content;
try {
  content = fs.readFileSync(webdriverPath, 'utf8');
} catch (err) {
  console.error('⚠ Failed to read webdriver.js:', err.message);
  process.exit(0); // Don't fail the install
}

// Check if already patched by looking for our marker comment
if (content.includes('// Patched for WebGL support')) {
  console.log('✓ jasmine-browser-runner already patched for WebGL');
  process.exit(0);
}

// Use regex to find and replace the headlessChrome configuration with flexible whitespace
const oldConfigRegex = /const caps = webdriver\.Capabilities\.chrome\(\);[\s\S]*?caps\.set\('goog:chromeOptions',\s*\{[\s\S]*?args:\s*\[[\s\S]*?'--disable-gpu',[\s\S]*?\],[\s\S]*?\}\);/;

const newConfig = `const caps = webdriver.Capabilities.chrome();
      // Patched for WebGL support
      caps.set('goog:chromeOptions', {
        args: [
          '--headless=new',
          '--no-sandbox',
          'window-size=1024,768',
          '--disable-dev-shm-usage',
          '--enable-webgl',
          '--use-gl=angle',
          '--use-angle=swiftshader',
        ],
      });`;

if (oldConfigRegex.test(content)) {
  content = content.replace(oldConfigRegex, newConfig);
  
  try {
    fs.writeFileSync(webdriverPath, content, 'utf8');
    console.log('✓ Patched jasmine-browser-runner to enable WebGL in headless Chrome');
  } catch (err) {
    console.error('⚠ Failed to write patched webdriver.js:', err.message);
    console.error('  Tests may fail in headless Chrome without WebGL support');
    process.exit(0); // Don't fail the install
  }
} else {
  // If we can't find the expected pattern, check if it might already have WebGL flags
  if (content.includes('--enable-webgl') && content.includes('--use-gl=angle')) {
    console.log('✓ jasmine-browser-runner appears to have WebGL support already');
  } else {
    console.warn('⚠ Could not find expected configuration in webdriver.js');
    console.warn('  The file format may have changed in a jasmine-browser-runner update');
    console.warn('  Tests may fail in headless Chrome without WebGL support');
  }
  process.exit(0); // Don't fail the install
}
