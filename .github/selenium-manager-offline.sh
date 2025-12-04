#!/bin/bash
# Wrapper for selenium-manager that forces offline mode
# This prevents selenium-manager from trying to download chromedriver,
# which can hang in the sandbox environment. Instead, it will use the
# system-installed chromedriver.

REAL_SM="$(dirname "$0")/../node_modules/selenium-webdriver/bin/linux/selenium-manager"

# Check if the real selenium-manager exists (only after npm install)
if [ ! -f "$REAL_SM" ]; then
  # Fall back to a path resolution from the repo root
  REAL_SM="node_modules/selenium-webdriver/bin/linux/selenium-manager"
fi

if [ ! -f "$REAL_SM" ]; then
  echo "Error: selenium-manager not found. Run 'npm install' first." >&2
  exit 1
fi

# Add --offline flag to prevent network downloads
exec "$REAL_SM" "$@" --offline
