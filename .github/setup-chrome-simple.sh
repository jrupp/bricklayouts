#!/bin/bash
# Simpler setup that lets selenium-manager download ChromeDriver automatically
# This is easier but requires internet access during test runs

set -e

echo "Installing Chrome for WSL2..."

# Update package list
sudo apt-get update

# Install dependencies for Chrome
sudo apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2t64 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils

# Add Google Chrome repository
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'

# Install Google Chrome
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# Verify Chrome installation
if command -v google-chrome &> /dev/null; then
    echo "✓ Chrome installed successfully"
    google-chrome --version
else
    echo "✗ Chrome installation failed"
    exit 1
fi

echo ""
echo "✓ Setup complete!"
echo ""
echo "Chrome is installed. Selenium-manager will automatically download"
echo "the matching ChromeDriver when you run tests."
echo ""
echo "You can now run tests with:"
echo "npx jasmine-browser-runner runSpecs --config=spec/support/jasmine-browser.agent.mjs"
