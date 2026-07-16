# Requirements Document

## Introduction

A 6-phase dead-code purge refactor for the arlo-lite-ios React Native (Expo) codebase. The refactor removes approximately 16,300 lines of unreachable code (7,282 source + ~9,000 tests) and 10 unused npm dependencies. The work is performed on a dedicated branch (`chore/dead-code-purge`) with one commit per phase so that any phase can be independently reverted. Each phase must pass a type-check and test gate before proceeding to the next.

## Glossary

- **Purge_System**: The automated dead-code removal workflow executed against the arlo-lite-ios codebase
- **Gate**: The verification command sequence (`npx tsc --noEmit && npx jest`) that validates codebase integrity after each phase
- **Extended_Gate**: The Gate command sequence plus `npx expo prebuild --no-install --platform ios` to verify native plugin configuration
- **Phase**: One discrete step in the purge workflow, each producing exactly one git commit
- **Do_Not_Touch_List**: Files that appear dead but have live importers and must be preserved: `chat/ErrorBanner.tsx`, `input/ThinkingLevelSelector.tsx`, `overlays/SettingsScreen.tsx`, `theme/useTheme`, `chat/CodeBlock.tsx`, `utils/uuid.ts`
- **Auto_Fix**: Automated correction of stale imports and type adjustments attempted when the Gate fails after a phase
- **Live_Entry**: The active application entry path: `expo-router → src/app/index.tsx → ChatScreen → ChatShell`

## Requirements

### Requirement 1: Branch and Commit Strategy

**User Story:** As a developer, I want each purge phase committed independently on a dedicated branch, so that any phase can be reverted without affecting other phases.

#### Acceptance Criteria

1. THE Purge_System SHALL perform all work on a git branch named `chore/dead-code-purge`.
2. WHEN a phase completes and the Gate passes, THE Purge_System SHALL create exactly one git commit for that phase.
3. THE Purge_System SHALL produce exactly six commits, one per phase, with descriptive commit messages indicating the phase content.
4. THE Purge_System SHALL NOT combine multiple phases into a single commit.

### Requirement 2: Gate Verification

**User Story:** As a developer, I want a type-check and test gate to run after every phase, so that I have confidence the codebase remains functional throughout the purge.

#### Acceptance Criteria

1. WHEN a phase is completed, THE Purge_System SHALL execute the Gate (`npx tsc --noEmit && npx jest`).
2. WHEN the Gate passes, THE Purge_System SHALL proceed to commit the phase.
3. IF the Gate fails after a phase, THEN THE Purge_System SHALL attempt Auto_Fix by removing stale imports and adjusting types.
4. WHEN Auto_Fix is applied, THE Purge_System SHALL re-run the Gate to verify the fix resolved the failure.
5. IF the Gate still fails after Auto_Fix, THEN THE Purge_System SHALL halt execution and report the failure.

### Requirement 3: Do-Not-Touch Preservation

**User Story:** As a developer, I want specific files with live twins protected from deletion, so that functional code is never accidentally removed.

#### Acceptance Criteria

1. THE Purge_System SHALL NOT delete or modify any file on the Do_Not_Touch_List.
2. THE Purge_System SHALL NOT delete `src/screens/ChatScreen.tsx`.
3. THE Purge_System SHALL NOT delete `src/screens/__tests__/ChatShell-delete.test.ts`.
4. THE Purge_System SHALL NOT delete `src/components/overlays/__tests__/provider-card.property.test.ts`.
5. THE Purge_System SHALL NOT delete `src/hooks/__tests__/useTheme.test.ts`.
6. THE Purge_System SHALL NOT delete `src/components/input/__tests__/ContextRing.property.test.ts` or `src/components/input/__tests__/ContextRing.test.tsx`.
7. THE Purge_System SHALL NOT delete `src/database/secure-store.ts`, `src/constants/defaults.ts`, or any file under `src/utils/`.

### Requirement 4: Phase 1 — Legacy React-Navigation App Removal

**User Story:** As a developer, I want the legacy react-navigation app structure removed, so that the codebase reflects the actual Expo Router architecture.

#### Acceptance Criteria

1. WHEN Phase 1 executes, THE Purge_System SHALL delete the `src/navigation/` directory and all its contents.
2. WHEN Phase 1 executes, THE Purge_System SHALL delete the `src/components/settings/` directory and all its contents.
3. WHEN Phase 1 executes, THE Purge_System SHALL delete the `src/components/common/` directory and all its contents.
4. WHEN Phase 1 executes, THE Purge_System SHALL delete the following screen files: `AboutScreen.tsx`, `ProviderListScreen.tsx`, `SessionListScreen.tsx`, `SettingsScreen.tsx`, `SystemPromptsScreen.tsx`, `ModelDetailScreen.tsx` from `src/screens/`.
5. WHEN Phase 1 executes, THE Purge_System SHALL delete the following test files: `AboutScreen.test.ts`, `SessionListScreen.test.ts`, `SystemPromptsScreen.test.ts` from `src/screens/__tests__/`.
6. WHEN Phase 1 completes, THE Purge_System SHALL pass the Gate.
7. THE Purge_System SHALL remove approximately 3,326 lines in Phase 1.

### Requirement 5: Phase 2 — Dead Chat-Component Removal

**User Story:** As a developer, I want obsolete chat components that have been superseded by live versions removed, so that only the active implementations remain.

#### Acceptance Criteria

1. WHEN Phase 2 executes, THE Purge_System SHALL delete the following component files from `src/components/chat/`: `MessageInput.tsx`, `MessageBubble.tsx`, `CodePanel.tsx`, `ModelSwitcher.tsx`, `ContextUsageBar.tsx`, `ThinkingIndicator.tsx`, `StreamingIndicator.tsx`, `MessageCost.tsx`, `ThinkingLevelSelector.tsx`.
2. WHEN Phase 2 executes, THE Purge_System SHALL delete all test files for the removed components from `src/components/chat/__tests__/`: `CodePanel.property.test.ts`, `CodePanel.snapshot.test.tsx`, `CodePanel.test.tsx`, the `__snapshots__/CodePanel.snapshot.test.tsx.snap`, `ContextUsageBar.test.ts`, `MessageInput.test.ts`, `ModelSwitcher.test.tsx`, `StreamingIndicator.test.ts`, `ThinkingIndicator.test.ts`, `ThinkingLevelSelector.test.tsx`.
3. THE Purge_System SHALL NOT delete the live versions: `input/ThinkingLevelSelector.tsx`, `chat/CodeBlock.tsx`, `chat/MessageFlow.tsx`, `chat/ErrorBanner.tsx`, `input/ContextRing.tsx`, or their associated test files.
4. WHEN Phase 2 completes, THE Purge_System SHALL pass the Gate.
5. THE Purge_System SHALL remove approximately 2,131 lines in Phase 2.

### Requirement 6: Phase 3 — Dead Services, Hooks, Domain, and Provider Removal

**User Story:** As a developer, I want unused services, hooks, domain modules, and provider implementations removed, so that the codebase only contains code reachable from the live entry path.

#### Acceptance Criteria

1. WHEN Phase 3 executes, THE Purge_System SHALL delete the following service files: `backup-service.ts`, `metadata-service.ts`, `network-monitor.ts` from `src/services/`.
2. WHEN Phase 3 executes, THE Purge_System SHALL delete the following service test files: `backup-service.test.ts`, `metadata-service.test.ts`, `network-monitor.test.ts`, `property-sync-conflict.test.ts`, `property-metadata-lookup.test.ts` from `src/services/__tests__/`.
3. WHEN Phase 3 executes, THE Purge_System SHALL delete the following hook files: `useNetwork.ts`, `useTheme.ts`, `useStreamingMetrics.ts` from `src/hooks/`.
4. WHEN Phase 3 executes, THE Purge_System SHALL delete the following hook test files: `useNetwork.test.ts`, `useStreamingMetrics.test.ts`, `useStreamingMetrics.property.test.ts` from `src/hooks/__tests__/`.
5. WHEN Phase 3 executes, THE Purge_System SHALL delete `error-classifier.ts` and `token-estimator.ts` from `src/domain/`.
6. WHEN Phase 3 executes, THE Purge_System SHALL delete `error-classifier.test.ts`, `token-estimator.test.ts`, `property-token-estimation.test.ts` from `src/domain/__tests__/`.
7. WHEN Phase 3 executes, THE Purge_System SHALL delete the `src/providers/sse/` directory and all its contents.
8. WHEN Phase 3 executes, THE Purge_System SHALL delete `openai-responses.ts` from `src/providers/openai/`, `model-validation.ts` from `src/providers/`, and `model-validation.property.test.ts` from `src/providers/__tests__/`.
9. WHEN Phase 3 executes, THE Purge_System SHALL delete `context-ring-utils.ts` from `src/components/input/` and `context-ring-usage.property.test.ts` from `src/components/input/__tests__/`.
10. WHEN Phase 3 completes, THE Purge_System SHALL pass the Gate.
11. THE Purge_System SHALL remove approximately 2,000 lines in Phase 3.

### Requirement 7: Phase 4 — Dependency Removal

**User Story:** As a developer, I want unused npm dependencies uninstalled and build configuration cleaned up, so that the dependency tree matches actual usage and native builds remain valid.

#### Acceptance Criteria

1. WHEN Phase 4 executes, THE Purge_System SHALL uninstall the following runtime dependencies: `@react-native-community/netinfo`, `@react-navigation/drawer`, `@react-navigation/stack`, `@react-navigation/native`, `react-syntax-highlighter`, `uuid`, `expo-asset`, `expo-font`.
2. WHEN Phase 4 executes, THE Purge_System SHALL uninstall the following dev dependencies: `@types/react-native`, `@types/react-syntax-highlighter`, `@types/uuid`.
3. IF removing `@react-navigation/native` causes TypeScript peer-resolution errors, THEN THE Purge_System SHALL reinstall only `@react-navigation/native` as a direct dependency.
4. WHEN Phase 4 executes, THE Purge_System SHALL edit `package.json` jest `transformIgnorePatterns` to remove `|uuid` from the pattern.
5. WHEN Phase 4 executes, THE Purge_System SHALL remove `"expo-asset"` and `"expo-font"` from the `plugins` array in `app.json`.
6. WHEN Phase 4 completes, THE Purge_System SHALL pass the Extended_Gate (Gate plus `npx expo prebuild --no-install --platform ios`).
7. THE Purge_System SHALL remove 10 dependencies in total (8 runtime + 2 or 3 dev) during Phase 4.

### Requirement 8: Phase 5 — Provider Registry Simplification

**User Story:** As a developer, I want the provider registry simplified from a lazy-cache pattern to eager instances, so that the code reflects the stateless nature of provider adapters.

#### Acceptance Criteria

1. WHEN Phase 5 executes, THE Purge_System SHALL replace the body of `src/providers/registry.ts` with eager provider instantiation using a `Record<ProviderType, IProvider>` mapping.
2. WHEN Phase 5 executes, THE Purge_System SHALL export a single `getProvider(type: ProviderType): IProvider` function that returns the provider instance or throws for unknown types.
3. WHEN Phase 5 executes, THE Purge_System SHALL update `src/providers/__tests__/registry.test.ts` to remove the `clearProviderCache` import, the `beforeEach` cache reset, and the cache-invalidation test case.
4. WHEN Phase 5 executes, THE Purge_System SHALL preserve the per-type identity tests and the unknown-type throw test in the registry test file.
5. WHEN Phase 5 completes, THE Purge_System SHALL pass the Gate.
6. THE Purge_System SHALL remove approximately 49 lines in Phase 5.

### Requirement 9: Phase 6 — Final Verification

**User Story:** As a developer, I want a comprehensive final verification that confirms the entire purge is clean, so that I can merge the branch with confidence.

#### Acceptance Criteria

1. WHEN Phase 6 executes, THE Purge_System SHALL run `npx tsc --noEmit` and confirm zero type errors.
2. WHEN Phase 6 executes, THE Purge_System SHALL run `npx jest` and confirm all tests pass.
3. WHEN Phase 6 executes, THE Purge_System SHALL run `npx expo start --ios` and confirm the app boots, the chat screen renders, and the settings overlay opens.
4. WHEN Phase 6 completes, THE Purge_System SHALL report the total line-count reduction via `git diff --stat main`.
5. THE Purge_System SHALL confirm a net reduction of approximately 16,300 lines across all phases.

### Requirement 10: Baseline Gate Precondition

**User Story:** As a developer, I want the gate to pass before any purge work begins, so that failures during the purge are attributable to the refactor and not pre-existing issues.

#### Acceptance Criteria

1. WHEN the Purge_System starts, THE Purge_System SHALL execute the Gate on the current codebase before any deletions.
2. IF the baseline Gate fails, THEN THE Purge_System SHALL halt and report the pre-existing failure without making any changes.
