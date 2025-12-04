#!/bin/bash
# Wrapper for selenium-manager that forces offline mode
# This prevents selenium-manager from trying to download chromedriver,
# which can hang in the sandbox environment. Instead, it will use the
# system-installed chromedriver.

# Detect platform for selenium-manager binary
case "$(uname -s)" in
  Linux*)   PLATFORM="linux" ;;
  Darwin*)  PLATFORM="macos" ;;
  CYGWIN*|MINGW*|MSYS*) PLATFORM="windows" ;;
  *)        PLATFORM="linux" ;;  # Default to Linux for GitHub sandbox
esac

# Find the repository root by looking for package.json
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Try to find selenium-manager in node_modules
REAL_SM="$REPO_ROOT/node_modules/selenium-webdriver/bin/${PLATFORM}/selenium-manager"

if [ ! -f "$REAL_SM" ]; then
  echo "Error: selenium-manager not found at $REAL_SM" >&2
  echo "Make sure you have run 'npm install' in $REPO_ROOT" >&2
  exit 1
fi

# Add --offline flag to prevent network downloads
exec "$REAL_SM" "$@" --offline
