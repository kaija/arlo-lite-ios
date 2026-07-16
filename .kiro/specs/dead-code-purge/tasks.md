# Implementation Plan: Dead-Code Purge

## Overview

A 6-phase sequential purge removing ~16,300 lines of unreachable code and 10 unused npm dependencies from the arlo-lite-ios codebase. Each phase deletes code in dependency order (outermost → innermost), runs a type-check + test gate, and produces one commit on branch `chore/dead-code-purge`. The final phase simplifies the provider registry and verifies the entire purge.

## Tasks

- [ ] 1. Setup and baseline verification
  - [ ] 1.1 Create branch and run baseline gate
    - Create branch `chore/dead-code-purge` from current HEAD
    - Run `npx tsc --noEmit && npx jest` to confirm baseline passes
    - If baseline fails, halt immediately without making changes
    - _Requirements: 1.1, 10.1, 10.2_

- [ ] 2. Phase 1 — Remove legacy react-navigation app
  - [ ] 2.1 Delete legacy navigation, settings, and common directories
    - Delete `src/navigation/` directory and all contents
    - Delete `src/components/settings/` directory and all contents
    - Delete `src/components/common/` directory and all contents
    - Verify Do-Not-Touch files are not affected
    - _Requirements: 4.1, 4.2, 4.3, 3.1, 3.2_

  - [ ] 2.2 Delete dead screen files and their tests
    - Delete screens: `AboutScreen.tsx`, `ProviderListScreen.tsx`, `SessionListScreen.tsx`, `SettingsScreen.tsx`, `SystemPromptsScreen.tsx`, `ModelDetailScreen.tsx` from `src/screens/`
    - Delete tests: `AboutScreen.test.ts`, `SessionListScreen.test.ts`, `SystemPromptsScreen.test.ts` from `src/screens/__tests__/`
    - Preserve `ChatScreen.tsx` and `__tests__/ChatShell-delete.test.ts`
    - _Requirements: 4.4, 4.5, 3.2, 3.3_

  - [ ] 2.3 Run gate and commit Phase 1
    - Run `npx tsc --noEmit && npx jest`
    - If gate fails: auto-fix stale imports (remove import lines referencing deleted modules), re-run gate
    - If gate still fails after auto-fix: halt
    - On pass: commit with message `chore: remove legacy navigation app`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 1.2, 4.6_

- [ ] 3. Phase 2 — Remove dead chat components
  - [ ] 3.1 Delete superseded chat component files
    - Delete from `src/components/chat/`: `MessageInput.tsx`, `MessageBubble.tsx`, `CodePanel.tsx`, `ModelSwitcher.tsx`, `ContextUsageBar.tsx`, `ThinkingIndicator.tsx`, `StreamingIndicator.tsx`, `MessageCost.tsx`, `ThinkingLevelSelector.tsx`
    - Verify live versions are untouched: `input/ThinkingLevelSelector.tsx`, `chat/CodeBlock.tsx`, `chat/MessageFlow.tsx`, `chat/ErrorBanner.tsx`, `input/ContextRing.tsx`
    - _Requirements: 5.1, 5.3, 3.1_

  - [ ] 3.2 Delete dead chat component test files
    - Delete from `src/components/chat/__tests__/`: `CodePanel.property.test.ts`, `CodePanel.snapshot.test.tsx`, `CodePanel.test.tsx`, `__snapshots__/CodePanel.snapshot.test.tsx.snap`, `ContextUsageBar.test.ts`, `MessageInput.test.ts`, `ModelSwitcher.test.tsx`, `StreamingIndicator.test.ts`, `ThinkingIndicator.test.ts`, `ThinkingLevelSelector.test.tsx`
    - Preserve live test files under `input/__tests__/`
    - _Requirements: 5.2, 3.6_

  - [ ] 3.3 Run gate and commit Phase 2
    - Run `npx tsc --noEmit && npx jest`
    - Auto-fix stale imports if gate fails; halt if still broken
    - On pass: commit with message `chore: remove dead chat components`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 1.2, 5.4_

- [ ] 4. Checkpoint — Phases 1–2 complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Phase 3 — Remove dead services, hooks, domain, and providers
  - [ ] 5.1 Delete dead service files and tests
    - Delete from `src/services/`: `backup-service.ts`, `metadata-service.ts`, `network-monitor.ts`
    - Delete from `src/services/__tests__/`: `backup-service.test.ts`, `metadata-service.test.ts`, `network-monitor.test.ts`, `property-sync-conflict.test.ts`, `property-metadata-lookup.test.ts`
    - _Requirements: 6.1, 6.2_

  - [ ] 5.2 Delete dead hooks and tests
    - Delete from `src/hooks/`: `useNetwork.ts`, `useTheme.ts`, `useStreamingMetrics.ts`
    - Delete from `src/hooks/__tests__/`: `useNetwork.test.ts`, `useStreamingMetrics.test.ts`, `useStreamingMetrics.property.test.ts`
    - Preserve `src/hooks/__tests__/useTheme.test.ts` (live — tests settings-store theme resolution)
    - _Requirements: 6.3, 6.4, 3.5_

  - [ ] 5.3 Delete dead domain modules and tests
    - Delete from `src/domain/`: `error-classifier.ts`, `token-estimator.ts`
    - Delete from `src/domain/__tests__/`: `error-classifier.test.ts`, `token-estimator.test.ts`, `property-token-estimation.test.ts`
    - _Requirements: 6.5, 6.6_

  - [ ] 5.4 Delete dead provider code
    - Delete `src/providers/sse/` directory and all contents
    - Delete `src/providers/openai/openai-responses.ts`
    - Delete `src/providers/model-validation.ts`
    - Delete `src/providers/__tests__/model-validation.property.test.ts`
    - _Requirements: 6.7, 6.8_

  - [ ] 5.5 Delete dead input utility and test
    - Delete `src/components/input/context-ring-utils.ts`
    - Delete `src/components/input/__tests__/context-ring-usage.property.test.ts`
    - Preserve `ContextRing.property.test.ts` and `ContextRing.test.tsx`
    - _Requirements: 6.9, 3.6_

  - [ ] 5.6 Run gate and commit Phase 3
    - Run `npx tsc --noEmit && npx jest`
    - Auto-fix stale imports if gate fails; halt if still broken
    - On pass: commit with message `chore: remove dead services, hooks, domain, and providers`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 1.2, 6.10_

- [ ] 6. Phase 4 — Dependency removal and config cleanup
  - [ ] 6.1 Uninstall runtime and dev dependencies
    - Run `npm uninstall @react-native-community/netinfo @react-navigation/drawer @react-navigation/stack @react-navigation/native react-syntax-highlighter uuid expo-asset expo-font`
    - Run `npm uninstall -D @types/react-native @types/react-syntax-highlighter @types/uuid`
    - If `@react-navigation/native` removal causes TSC peer-resolution errors, reinstall only that package
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 6.2 Clean up package.json and app.json configuration
    - Edit `package.json` jest `transformIgnorePatterns`: remove `|uuid` from the pattern
    - Edit `app.json`: remove `"expo-asset"` and `"expo-font"` from the `plugins` array
    - _Requirements: 7.4, 7.5_

  - [ ] 6.3 Run extended gate and commit Phase 4
    - Run `npx tsc --noEmit && npx jest`
    - Run `npx expo prebuild --no-install --platform ios` to confirm plugin removal is clean
    - Auto-fix stale imports if gate fails; halt if still broken
    - On pass: commit with message `chore: uninstall dead dependencies and clean config`
    - _Requirements: 2.1, 7.6, 1.2_

- [ ] 7. Checkpoint — Phases 3–4 complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Phase 5 — Simplify provider registry
  - [ ] 8.1 Rewrite registry.ts to eager instantiation
    - Replace entire body of `src/providers/registry.ts` with eager `Record<ProviderType, IProvider>` pattern
    - Remove `clearProviderCache` export (no cache to clear)
    - Preserve `getProvider(type)` function signature and throw-on-unknown behavior
    - _Requirements: 8.1, 8.2_

  - [ ] 8.2 Update registry test file
    - Remove `clearProviderCache` import from `src/providers/__tests__/registry.test.ts`
    - Remove `beforeEach` cache reset block
    - Remove "clearProviderCache creates new instance" test case
    - Preserve per-type identity tests and unknown-type throw test
    - _Requirements: 8.3, 8.4_

  - [ ]* 8.3 Write property test for provider registry type-completeness
    - **Property 4: Provider registry type-completeness**
    - For any valid `ProviderType`, `getProvider(type)` returns an `IProvider` with matching `.type` field
    - For any non-valid string, `getProvider` throws
    - **Validates: Requirements 8.1, 8.2**

  - [ ] 8.4 Run gate and commit Phase 5
    - Run `npx tsc --noEmit && npx jest`
    - Auto-fix if gate fails; halt if still broken
    - On pass: commit with message `chore: simplify provider registry to eager instances`
    - _Requirements: 2.1, 2.2, 1.2, 8.5_

- [ ] 9. Phase 6 — Final verification
  - [ ] 9.1 Run comprehensive verification suite
    - Run `npx tsc --noEmit` — confirm zero type errors
    - Run `npx jest` — confirm all tests pass
    - Run `npx expo start --ios` — confirm app boots, chat screen renders, settings overlay opens
    - Run `git diff --stat main` — confirm approximately 16,300 lines removed
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 9.2 Write property test for Do-Not-Touch file preservation
    - **Property 1: Do-Not-Touch file preservation**
    - Verify all files on the Do-Not-Touch list exist and are unmodified after all phases
    - Check files under `src/utils/`, `src/database/secure-store.ts`, `src/constants/defaults.ts`, and explicitly named component/test files
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

  - [ ] 9.3 Final commit for Phase 6
    - Commit with message `chore: final verification — dead-code purge complete`
    - _Requirements: 1.2, 1.3_

- [ ] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster execution
- Each phase gate consists of `npx tsc --noEmit && npx jest`; Phase 4 adds `npx expo prebuild --no-install --platform ios`
- Auto-fix strategy: parse TSC TS2307/TS2305 errors, remove stale import lines, handle resulting TS6133 unused-variable errors
- Do-Not-Touch list is strictly enforced: `chat/ErrorBanner.tsx`, `input/ThinkingLevelSelector.tsx`, `overlays/SettingsScreen.tsx`, `theme/useTheme.ts`, `chat/CodeBlock.tsx`, `utils/uuid.ts`, `ChatScreen.tsx`, and all explicitly preserved test files
- The `@react-navigation/native` fallback (Req 7.3) only applies if peer-resolution errors surface after removal
- Property tests validate correctness properties from the design document

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3"] },
    { "id": 3, "tasks": ["3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5"] },
    { "id": 6, "tasks": ["5.6"] },
    { "id": 7, "tasks": ["6.1"] },
    { "id": 8, "tasks": ["6.2"] },
    { "id": 9, "tasks": ["6.3"] },
    { "id": 10, "tasks": ["8.1", "8.2"] },
    { "id": 11, "tasks": ["8.3", "8.4"] },
    { "id": 12, "tasks": ["9.1"] },
    { "id": 13, "tasks": ["9.2", "9.3"] }
  ]
}
```
