#!/bin/sh
set -e

# Ensure we're running native arm64, not under Rosetta emulation
if [ "$(uname -m)" = "x86_64" ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null)" = "1" ]; then
  echo "Re-launching under native arm64 (was running under Rosetta)"
  exec env /usr/bin/arch -arm64 /bin/sh "$0" "$@"
fi

# Navigate to the repository root
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Install Node.js and cmake using Homebrew (Xcode Cloud macOS images have Homebrew)
brew install node cmake

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

# Point Xcode's script phases at the CI node binary.
# Xcode build phases run with a minimal PATH that excludes Homebrew, so
# "$(command -v node)" in .xcode.env resolves to nothing during archive.
echo "export NODE_BINARY=$(command -v node)" > ios/.xcode.env.local
# Xcode Cloud sets CI=TRUE (uppercase), which Expo's getenv rejects
# ("GetEnv.NoBoolean: TRUE is not a boolean"). Normalize it.
echo "export CI=1" >> ios/.xcode.env.local

# Install CocoaPods dependencies
cd ios
pod install
