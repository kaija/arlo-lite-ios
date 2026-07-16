# Refactor spec: dead-code purge — arlo-lite-ios

**Context for executor:** App entry is `expo-router → src/app/index.tsx → ChatScreen → ChatShell`. Everything below is unreachable from that entry (verified by import tracing). Work on a branch. Run the gate after every phase; a phase is done only when the gate passes.

```bash
# Setup
git checkout -b chore/dead-code-purge
# Baseline gate (must pass BEFORE starting; also the gate after each phase):
npx tsc --noEmit && npx jest
```

## Phase 1 — legacy react-navigation app (−3,326 lines)

```bash
git rm -r src/navigation src/components/settings src/components/common
git rm src/screens/AboutScreen.tsx src/screens/ProviderListScreen.tsx \
       src/screens/SessionListScreen.tsx src/screens/SettingsScreen.tsx \
       src/screens/SystemPromptsScreen.tsx src/screens/ModelDetailScreen.tsx
git rm src/screens/__tests__/AboutScreen.test.ts \
       src/screens/__tests__/SessionListScreen.test.ts \
       src/screens/__tests__/SystemPromptsScreen.test.ts
```

- KEEP `src/screens/ChatScreen.tsx` (live entry) and `src/screens/__tests__/ChatShell-delete.test.ts`.
- KEEP `src/components/overlays/__tests__/provider-card.property.test.ts` (self-contained fast-check, no dead imports).

## Phase 2 — dead chat-component generation (−2,131 lines)

```bash
git rm src/components/chat/MessageInput.tsx src/components/chat/MessageBubble.tsx \
       src/components/chat/CodePanel.tsx src/components/chat/ModelSwitcher.tsx \
       src/components/chat/ContextUsageBar.tsx src/components/chat/ThinkingIndicator.tsx \
       src/components/chat/StreamingIndicator.tsx src/components/chat/MessageCost.tsx \
       src/components/chat/ThinkingLevelSelector.tsx
git rm src/components/chat/__tests__/CodePanel.property.test.ts \
       src/components/chat/__tests__/CodePanel.snapshot.test.tsx \
       src/components/chat/__tests__/CodePanel.test.tsx \
       src/components/chat/__tests__/__snapshots__/CodePanel.snapshot.test.tsx.snap \
       src/components/chat/__tests__/ContextUsageBar.test.ts \
       src/components/chat/__tests__/MessageInput.test.ts \
       src/components/chat/__tests__/ModelSwitcher.test.tsx \
       src/components/chat/__tests__/StreamingIndicator.test.ts \
       src/components/chat/__tests__/ThinkingIndicator.test.ts \
       src/components/chat/__tests__/ThinkingLevelSelector.test.tsx
```

- The live versions are: `input/ThinkingLevelSelector.tsx`, `chat/CodeBlock.tsx`, `chat/MessageFlow.tsx`, `chat/ErrorBanner.tsx`, `input/ContextRing.tsx` — do NOT touch those or their tests (`ThinkingLevelSelector.test.tsx` under `input/__tests__/` stays; the one under `chat/__tests__/` goes).

## Phase 3 — dead services / hooks / domain / providers (−~2,000 lines)

```bash
git rm src/services/backup-service.ts src/services/metadata-service.ts src/services/network-monitor.ts
git rm src/services/__tests__/backup-service.test.ts src/services/__tests__/metadata-service.test.ts \
       src/services/__tests__/network-monitor.test.ts src/services/__tests__/property-sync-conflict.test.ts \
       src/services/__tests__/property-metadata-lookup.test.ts
git rm src/hooks/useNetwork.ts src/hooks/useTheme.ts src/hooks/useStreamingMetrics.ts
git rm src/hooks/__tests__/useNetwork.test.ts src/hooks/__tests__/useStreamingMetrics.test.ts \
       src/hooks/__tests__/useStreamingMetrics.property.test.ts
git rm src/domain/error-classifier.ts src/domain/token-estimator.ts
git rm src/domain/__tests__/error-classifier.test.ts src/domain/__tests__/token-estimator.test.ts \
       src/domain/__tests__/property-token-estimation.test.ts
git rm -r src/providers/sse
git rm src/providers/openai/openai-responses.ts src/providers/model-validation.ts \
       src/providers/__tests__/model-validation.property.test.ts
git rm src/components/input/context-ring-utils.ts \
       src/components/input/__tests__/context-ring-usage.property.test.ts
```

- KEEP `src/hooks/__tests__/useTheme.test.ts` — despite the name it imports zero dead code (tests settings-store theme resolution; verified).
- KEEP `src/components/input/__tests__/ContextRing.property.test.ts` and `ContextRing.test.tsx` — they import from `../ContextRing`, not the deleted utils.
- KEEP `src/database/secure-store.ts`, `src/constants/defaults.ts`, `src/utils/*` — all have live importers.

## Phase 4 — dependency removal (−10 deps)

```bash
npm uninstall @react-native-community/netinfo @react-navigation/drawer \
  @react-navigation/stack @react-navigation/native react-syntax-highlighter uuid \
  expo-asset expo-font
npm uninstall -D @types/react-native @types/react-syntax-highlighter @types/uuid
```

- `@react-navigation/native` is safe to drop as a direct dep — expo-router declares it as its own dependency. If `npx tsc` errors on peer resolution afterward, reinstall only that one.
- `package.json` line ~74 — edit jest `transformIgnorePatterns`: remove `|uuid` from the end of the pattern (`react-native-svg|uuid` → `react-native-svg`).
- `app.json` — remove `"expo-asset"` and `"expo-font"` from the `plugins` array (zero `useFonts`/`Asset` usage in src; icon/splash config doesn't need them).
- Gate for this phase adds: `npx expo prebuild --no-install --platform ios` (or `npx expo-doctor`) to confirm plugin removal is clean.

## Phase 5 — shrink provider registry (−49 lines)

Replace the entire body of `src/providers/registry.ts` with:

```ts
import { IProvider, ProviderType } from './types';
import { OpenAIProvider } from './openai/openai-provider';
import { AnthropicProvider } from './anthropic/anthropic-provider';
import { CustomProvider } from './custom/custom-provider';

// ponytail: eager instances — adapters are stateless (no constructors), lazy cache was dead weight
const providers: Record<ProviderType, IProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  custom: new CustomProvider(),
};

export function getProvider(type: ProviderType): IProvider {
  const provider = providers[type];
  if (!provider) throw new Error(`Unknown provider type: "${type}"`);
  return provider;
}
```

Then update `src/providers/__tests__/registry.test.ts`: delete the `clearProviderCache` import, the `beforeEach` cache reset, and the "clearProviderCache creates new instance" test case. Keep the per-type identity tests and the unknown-type throw test — they pass unchanged.

## Phase 6 — final verification

```bash
npx tsc --noEmit && npx jest && npx expo start --ios   # smoke: app boots, chat renders, settings overlay opens
git diff --stat main   # expect roughly −16,000 lines
```

Commit per phase (`chore: remove legacy navigation app`, `chore: remove dead chat components`, …) so any phase can be reverted alone.

**Do-not-touch list** (dead-looking names with live twins): `chat/ErrorBanner.tsx`, `input/ThinkingLevelSelector.tsx`, `overlays/SettingsScreen.tsx`, `theme/`'s `useTheme`, `chat/CodeBlock.tsx`, `utils/uuid.ts` (keep the 8-line hand-roll; the npm `uuid` dep is what dies).

**net: −16,300 lines (7,282 src + ~9,000 tests), −10 deps.**
