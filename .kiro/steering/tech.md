# Tech Stack

## Core
- **Framework**: React Native 0.76 via Expo SDK ~52 (New Architecture enabled)
- **Language**: TypeScript (strict mode)
- **Navigation**: Expo Router (file-based routing in `src/app/`)
- **State**: Zustand
- **Persistence**: expo-sqlite (chat sessions), expo-secure-store (API keys)
- **Styling**: React Native StyleSheet (no external CSS-in-JS)
- **i18n**: i18next + react-i18next

## Key Dependencies
- `openai` SDK — OpenAI provider + custom endpoints
- `@anthropic-ai/sdk` — Anthropic provider
- `react-native-reanimated` — animations
- `react-native-gesture-handler` — gestures (swipe, press)
- `react-native-markdown-display` — message rendering
- `expo-speech-recognition` — voice dictation
- `turndown` — HTML-to-markdown conversion

## Testing
- Jest + jest-expo preset
- @testing-library/react-native
- fast-check (property-based testing)

## Build & Run Commands

```bash
# Install dependencies
npm install

# Start Metro dev server
npx expo start

# Run on iOS simulator (builds + launches + starts Metro)
npx expo run:ios

# Run tests
npm test

# Lint
npm run lint
```

## iOS Native Build (manual)

```bash
npx expo prebuild --platform ios
cd ios && pod install && cd ..
xcodebuild -workspace ios/ArloLite.xcworkspace \
  -scheme ArloLite -sdk iphonesimulator \
  -destination "platform=iOS Simulator,name=iPhone 17 Pro" \
  build -quiet
```

## Path Alias
`@/` maps to `src/` (configured in tsconfig.json and babel.config.js).

## Known Issues
- **expo-localization + Xcode 26**: `Calendar.Identifier` exhaustive switch error in `node_modules/expo-localization/ios/LocalizationModule.swift` ~line 93. Fix: add `@unknown default: return "gregory"`. Re-apply after `npm install`.
