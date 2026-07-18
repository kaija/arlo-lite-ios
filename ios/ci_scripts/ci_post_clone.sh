#!/bin/sh
set -e

# Navigate to the repository root
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Install Node.js using Homebrew (Xcode Cloud macOS images have Homebrew)
brew install node

# Install project dependencies
npm install

# Install CocoaPods dependencies
cd ios
pod install
