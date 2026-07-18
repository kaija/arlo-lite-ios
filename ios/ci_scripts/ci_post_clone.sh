#!/bin/sh
set -e

# Navigate to the repository root
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Install Node.js using Homebrew (Xcode Cloud macOS images have Homebrew)
brew install node

# Install project dependencies
npm install

# Patch expo-localization for Xcode 26+ (Calendar.Identifier exhaustive switch)
# iOS 26 SDK added new cases to Calendar.Identifier enum, requiring @unknown default.
LOCALIZATION_FILE="node_modules/expo-localization/ios/LocalizationModule.swift"
if [ -f "$LOCALIZATION_FILE" ]; then
  if ! grep -q '@unknown default' "$LOCALIZATION_FILE"; then
    # Insert '@unknown default: return "gregory"' before the switch's closing brace
    # Find the last 'return' in the calendar switch and add @unknown default after it
    python3 -c "
import re
with open('$LOCALIZATION_FILE', 'r') as f:
    content = f.read()

# Match the pattern: last case in the switch (iso8601 or any last case) followed by closing brace
# Add @unknown default before the closing brace of the switch in getUnicodeCalendarIdentifier
pattern = r'(case \.iso8601:\s*\n\s*return \"iso8601\")\s*\n(\s*\})'
replacement = r'\1\n    @unknown default:\n      return \"gregory\"\n\2'
patched = re.sub(pattern, replacement, content)

if patched != content:
    with open('$LOCALIZATION_FILE', 'w') as f:
        f.write(patched)
    print('Patched expo-localization for Xcode 26 compatibility')
else:
    print('Pattern not found, file may already be patched or have different structure')
"
  else
    echo "expo-localization already has @unknown default, no patch needed"
  fi
fi

# Install CocoaPods dependencies
cd ios
pod install

# Patch fmt for Xcode 26.4+ / Apple Clang 21 (consteval strictness)
# fmt 9.1.0 (bundled via RCT-Folly) defines FMT_CONSTEVAL as consteval, which
# Apple Clang 21 enforces more strictly, causing compile errors.
# Disable consteval usage so format strings are validated at runtime instead.
FMT_CORE="Pods/fmt/include/fmt/core.h"
if [ -f "$FMT_CORE" ]; then
  if grep -q '#    define FMT_CONSTEVAL consteval' "$FMT_CORE"; then
    sed -i '' 's/#    define FMT_CONSTEVAL consteval/#    define FMT_CONSTEVAL/' "$FMT_CORE"
    echo "Patched fmt/core.h: disabled FMT_CONSTEVAL for Xcode 26.4+ compatibility"
  else
    echo "fmt/core.h already patched or has different structure"
  fi
fi
