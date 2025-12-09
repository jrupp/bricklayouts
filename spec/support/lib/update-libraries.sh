#!/bin/bash
set -euo pipefail

# Update script for fast-check and pure-rand libraries
# This script downloads the latest compatible versions from jsDelivr CDN
# and modifies fast-check to use the local pure-rand copy

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Library versions - update these when you want to upgrade
FAST_CHECK_VERSION="${FAST_CHECK_VERSION:-3.15.0}"
PURE_RAND_VERSION="${PURE_RAND_VERSION:-6.0.4}"

echo "Downloading fast-check@${FAST_CHECK_VERSION} and pure-rand@${PURE_RAND_VERSION}..."

# Download fast-check
echo "Downloading fast-check..."
wget -q -O fast-check.mjs "https://cdn.jsdelivr.net/npm/fast-check@${FAST_CHECK_VERSION}/+esm"
if [ ! -s fast-check.mjs ]; then
    echo "Error: Failed to download fast-check or file is empty"
    exit 1
fi

# Download pure-rand
echo "Downloading pure-rand..."
wget -q -O pure-rand.mjs "https://cdn.jsdelivr.net/npm/pure-rand@${PURE_RAND_VERSION}/+esm"
if [ ! -s pure-rand.mjs ]; then
    echo "Error: Failed to download pure-rand or file is empty"
    exit 1
fi

# Modify fast-check.mjs to use local pure-rand instead of CDN
echo "Updating fast-check to use local pure-rand..."
# Replace the CDN import path with local path
sed -i "s|from\"/npm/pure-rand@[^\"]*\"|from\"./pure-rand.mjs\"|g" fast-check.mjs

# Verify the replacement was successful
if grep -q 'from"./pure-rand.mjs"' fast-check.mjs; then
    echo "✓ Successfully updated import path in fast-check.mjs"
else
    echo "Warning: Could not verify import path update in fast-check.mjs"
    echo "Please check the file manually"
fi

echo ""
echo "✓ Libraries updated successfully!"
echo "  - fast-check: ${FAST_CHECK_VERSION}"
echo "  - pure-rand: ${PURE_RAND_VERSION}"
echo ""
echo "You can run tests to verify: npm test"
