# Arlo Lite

A free, open-source, lightweight iOS client for interacting with LLMs. Bring your own API key and talk directly to the provider — no backend, no subscription.

## Prerequisites

- Node.js (LTS)
- Xcode 26+ with iOS Simulator or a physical device
- CocoaPods (`brew install cocoapods`)
- An Apple Developer account (free or paid) for physical device builds

## Setup

```bash
npm install
npx expo prebuild --platform ios
cd ios && pod install && cd ..
```

## Run on Simulator

```bash
npx expo run:ios
```

This builds the native binary, installs it on the simulator, and starts Metro.

## Run on Physical iPhone (Debug Bridge)

### 1. Configure signing (one-time)

```bash
open ios/ArloLite.xcworkspace
```

In Xcode:
- Select the **ArloLite** target → **Signing & Capabilities**
- Set **Team** to your Apple Developer account
- Set **Bundle Identifier** to something unique (e.g. `com.yourname.arlolite`)
- Let Xcode auto-resolve provisioning

Close Xcode after setup.

### 2. Build and run

Connect your iPhone via USB, trust the computer if prompted, then:

```bash
npx expo run:ios --device
```

This will list connected devices, build, install, and start Metro for hot reload.

### 3. Wireless debugging (optional)

After the first USB install:

1. Open Xcode → **Window** → **Devices and Simulators**
2. Select your iPhone → check **Connect via network**
3. Future runs with `npx expo run:ios --device` will find it over WiFi

Or just keep Metro running and the app connects automatically:

```bash
npx expo start --dev-client --port 8081
```

### Troubleshooting

- **"Untrusted Developer"** on phone: Settings → General → VPN & Device Management → trust your certificate
- **Metro can't connect**: Ensure phone and Mac are on the same WiFi network
- **Build signing error**: Re-open `ios/ArloLite.xcworkspace` and verify team/provisioning

## Known Build Issues

- **expo-localization + Xcode 26**: The `Calendar.Identifier` enum gained new cases in iOS 26 SDK. If you get a "switch must be exhaustive" error in `node_modules/expo-localization/ios/LocalizationModule.swift`, add `@unknown default: return "gregory"` to the switch statement at ~line 93. Re-apply after fresh `npm install` until expo-localization ships a fix.

## Project Structure

```
src/
  app/           — Expo Router file-based routes
  components/    — Reusable UI components
  database/      — expo-sqlite schema, migrations, queries
  domain/        — Domain types and interfaces
  hooks/         — Custom React hooks
  i18n/          — Internationalization
  providers/     — LLM provider implementations (OpenAI, Anthropic, Custom)
  services/      — Business logic (streaming, cost calculation)
  stores/        — Zustand stores
  theme/         — Design tokens, colors, typography
  utils/         — General utilities
ios/             — Native iOS project
docs/            — Requirements, design system, UI/UX docs
```

## License

See [LICENSE](./LICENSE).
