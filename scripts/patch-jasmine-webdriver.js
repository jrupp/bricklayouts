#!/usr/bin/env node
/**
 * Patches jasmine-browser-runner to enable GPU in headless Chrome for WebGL support.
 * 
 * PixiJS v8 requires WebGL to be available, but recent Chrome versions in GitHub Actions
 * ubuntu-latest runners have issues with GPU when running headless.
 * 
 * This script first tries adding just --enable-unsafe-swiftshader flag (simplest fix).
 * If that flag is already present, it assumes a more comprehensive patch was applied.
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

// Check if already patched by looking for our marker comment or the swiftshader flag
if (content.includes('// Patched for WebGL support') || content.includes('--enable-unsafe-swiftshader')) {
  console.log('✓ jasmine-browser-runner already patched for WebGL');
  process.exit(0);
}

// Try the simple fix first: just add --enable-unsafe-swiftshader to the existing args
// This regex finds the headlessChrome args array and adds the flag after --disable-dev-shm-usage
const simpleFixRegex = /(if \(browserName === 'headlessChrome'\) \{[\s\S]*?'--disable-dev-shm-usage',.*?\n)(\s+\],)/;

if (simpleFixRegex.test(content)) {
  // Add the swiftshader flag after --disable-dev-shm-usage
  content = content.replace(
    simpleFixRegex,
    "$1          '--enable-unsafe-swiftshader', // Patched for WebGL support\n$2"
  );
  
  try {
    fs.writeFileSync(webdriverPath, content, 'utf8');
    console.log('✓ Patched jasmine-browser-runner to enable WebGL in headless Chrome (simple fix)');
  } catch (err) {
    console.error('⚠ Failed to write patched webdriver.js:', err.message);
    console.error('  Tests may fail in headless Chrome without WebGL support');
    process.exit(0);
  }
} else {
  console.warn('⚠ Could not find expected configuration in webdriver.js');
  console.warn('  The file format may have changed in a jasmine-browser-runner update');
  console.warn('  Tests may fail in headless Chrome without WebGL support');
  process.exit(0);
}
