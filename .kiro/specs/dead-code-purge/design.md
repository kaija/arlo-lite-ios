# Design Document

## Introduction

This document describes the architecture and execution strategy for a 6-phase dead-code purge of the arlo-lite-ios codebase. The refactor removes ~16,300 lines of unreachable code and 10 unused npm dependencies from a React Native (Expo 52) project while preserving all live functionality anchored at the entry path `expo-router → src/app/index.tsx → ChatScreen → ChatShell`.

The design focuses on: phase ordering to minimize intermediate breakage, the gate verification mechanism, the auto-fix strategy for stale imports, the do-not-touch preservation invariant, and the provider registry simplification.

## Architecture Overview

The purge operates as a sequential pipeline of six discrete phases, each producing exactly one git commit on branch `chore/dead-code-purge`. The phases are ordered from outermost dead code (navigation shell, screens) inward to fine-grained removals (services, domain modules) and finally structural refactoring (provider registry). This ordering ensures that each phase's deletions do not cascade into requiring edits in files that will themselves be deleted in a later phase.

```
┌──────────────────────────────────────────────────────────┐
│                 Purge Execution Pipeline                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [Baseline Gate] ──pass──▶ Phase 1 ──▶ [Gate] ──pass──▶ │
│                                                          │
│  Phase 2 ──▶ [Gate] ──pass──▶ Phase 3 ──▶ [Gate] ──▶    │
│                                                          │
│  Phase 4 ──▶ [Extended Gate] ──▶ Phase 5 ──▶ [Gate] ──▶ │
│                                                          │
│  Phase 6 (Final Verification) ──▶ [Done]                 │
│                                                          │
│  On Gate Failure:                                        │
│    ──fail──▶ [Auto_Fix] ──▶ [Re-Gate] ──fail──▶ HALT    │
│                                              ──pass──▶ ✓ │
└──────────────────────────────────────────────────────────┘
```

### Live Entry Path (Preserved Invariant)

```
expo-router entry
  └─▶ src/app/_layout.tsx
  └─▶ src/app/index.tsx
        └─▶ src/screens/ChatScreen.tsx
              └─▶ ChatShell (components/chat/*, input/*, overlays/*)
                    └─▶ src/providers/registry.ts → getProvider()
                    └─▶ src/stores/* (Zustand)
                    └─▶ src/database/* (expo-sqlite)
                    └─▶ src/services/streaming-service.ts
                    └─▶ src/services/cost-calculator.ts
```

## Components

### 1. Phase Executor

Responsible for executing each phase's file operations (deletions, edits) and coordinating with the Gate Verifier.

```typescript
interface PhaseExecutor {
  /** Execute a single phase. Returns true if gate passed (with or without auto-fix). */
  executePhase(phase: PhaseDefinition): Promise<PhaseResult>;
}

interface PhaseDefinition {
  id: 1 | 2 | 3 | 4 | 5 | 6;
  description: string;
  deletions: string[];           // File/directory paths to delete
  edits?: FileEdit[];            // File modifications (Phase 4, 5)
  npmUninstalls?: string[];      // Packages to remove (Phase 4)
  commitMessage: string;
}

interface PhaseResult {
  phase: number;
  gatePassedFirstAttempt: boolean;
  autoFixApplied: boolean;
  gatePassedAfterFix: boolean;
  linesRemoved: number;
}
```

### 2. Gate Verifier

Executes type-checking and tests as a go/no-go checkpoint after each phase.

```typescript
interface GateVerifier {
  /** Run standard gate: tsc --noEmit && jest */
  runGate(): Promise<GateResult>;

  /** Run extended gate: standard gate + expo prebuild --no-install */
  runExtendedGate(): Promise<GateResult>;
}

interface GateResult {
  passed: boolean;
  tscErrors?: string[];
  jestFailures?: string[];
  prebuildErrors?: string[];   // Only for extended gate
}
```

### 3. Auto-Fix Engine

Attempts to resolve stale import references when the gate fails after a deletion phase.

```typescript
interface AutoFixEngine {
  /**
   * Given a set of TSC errors indicating missing modules,
   * remove the stale import lines from the affected files.
   */
  fixStaleImports(errors: TscError[]): Promise<FixResult>;
}

interface TscError {
  file: string;
  line: number;
  code: string;     // e.g., "TS2307" (cannot find module)
  message: string;
}

interface FixResult {
  filesModified: string[];
  importsRemoved: number;
}
```

The auto-fix strategy:
1. Parse TSC error output for `TS2307` (Cannot find module) and `TS2305` (has no exported member) errors.
2. For each affected file, identify the import statement referencing the deleted module.
3. Remove the entire import line (or multi-line import block).
4. If removing an import causes unused-variable errors (`TS6133`), remove those variable declarations.
5. Write the modified file back and re-run the gate.

### 4. Do-Not-Touch Guard

A pre-deletion validation layer that rejects operations targeting protected files.

```typescript
const DO_NOT_TOUCH: ReadonlySet<string> = new Set([
  'src/components/chat/ErrorBanner.tsx',
  'src/components/input/ThinkingLevelSelector.tsx',
  'src/components/overlays/SettingsScreen.tsx',
  'src/theme/useTheme.ts',
  'src/components/chat/CodeBlock.tsx',
  'src/utils/uuid.ts',
  'src/screens/ChatScreen.tsx',
  'src/screens/__tests__/ChatShell-delete.test.ts',
  'src/components/overlays/__tests__/provider-card.property.test.ts',
  'src/hooks/__tests__/useTheme.test.ts',
  'src/components/input/__tests__/ContextRing.property.test.ts',
  'src/components/input/__tests__/ContextRing.test.tsx',
  'src/database/secure-store.ts',
  'src/constants/defaults.ts',
]);

const DO_NOT_TOUCH_DIRS: ReadonlySet<string> = new Set([
  'src/utils/',
]);

function isProtected(filePath: string): boolean {
  if (DO_NOT_TOUCH.has(filePath)) return true;
  for (const dir of DO_NOT_TOUCH_DIRS) {
    if (filePath.startsWith(dir)) return true;
  }
  return false;
}
```

### 5. Provider Registry (Phase 5 Target)

The current `registry.ts` uses a lazy-cache pattern with a `Map<ProviderType, IProvider>` and factory functions. Since provider adapters are stateless (no constructor arguments, no mutable state), the lazy pattern adds complexity without benefit.

**Before (current — 55 lines):**
```typescript
const instances = new Map<ProviderType, IProvider>();
const factories: Record<ProviderType, () => IProvider> = { ... };

export function getProvider(type: ProviderType): IProvider {
  const cached = instances.get(type);
  if (cached) return cached;
  const factory = factories[type];
  if (!factory) throw new Error(...);
  const instance = factory();
  instances.set(type, instance);
  return instance;
}

export function clearProviderCache(): void {
  instances.clear();
}
```

**After (Phase 5 — 15 lines):**
```typescript
import { IProvider, ProviderType } from './types';
import { OpenAIProvider } from './openai/openai-provider';
import { AnthropicProvider } from './anthropic/anthropic-provider';
import { CustomProvider } from './custom/custom-provider';

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

Key changes:
- Eager instantiation replaces lazy-cache pattern
- `clearProviderCache()` export removed (no cache to clear)
- Same external contract: `getProvider(type)` returns `IProvider` or throws
- Test file updated: remove `clearProviderCache` import, `beforeEach` reset, and cache-invalidation test

## Data Models

### Phase Deletion Manifest

Each phase is defined by a declarative manifest of files/directories to remove:

```typescript
type DeletionTarget =
  | { type: 'file'; path: string }
  | { type: 'directory'; path: string };

interface PhaseDeletionManifest {
  phase: number;
  targets: DeletionTarget[];
  preserveCheck: string[];  // Files that must still exist after this phase
}
```

### Dependency Removal (Phase 4)

```typescript
interface DependencyRemoval {
  runtime: string[];
  dev: string[];
  configEdits: ConfigEdit[];
  fallback?: {
    condition: string;        // "TS peer-resolution error"
    action: string;           // "reinstall @react-navigation/native"
  };
}

interface ConfigEdit {
  file: string;               // "package.json" | "app.json"
  path: string[];             // JSON path to edit
  operation: 'remove' | 'replace';
  value?: string;
}
```

## Phase Execution Order and Rationale

| Phase | Scope | Rationale for Order |
|-------|-------|-------------------|
| 1 | Navigation shell + settings + common | Outermost dead layer; no live code imports from these |
| 2 | Dead chat components | Superseded by live versions in `input/` and `chat/` |
| 3 | Services, hooks, domain, providers | Interior modules only reachable from code deleted in 1–2 |
| 4 | npm dependencies | Safe only after all importers are removed in 1–3 |
| 5 | Registry refactor | Structural improvement; safe after SSE provider deleted in 3 |
| 6 | Final verification | Confirms entire purge is clean |

## Error Handling

### Gate Failure Recovery

1. **TSC Errors (TS2307, TS2305):** Auto-fix removes stale imports pointing to deleted modules. This covers the most common failure mode — a file that was not itself deleted but imported something that was.

2. **Jest Failures:** If tests fail because they import deleted test utilities or reference deleted modules in mocks, auto-fix removes those import lines. If the test file itself is not on the deletion list and cannot be auto-fixed, the system halts.

3. **Prebuild Errors (Phase 4 only):** If `expo prebuild --no-install` fails after removing plugins from `app.json`, the error likely indicates a plugin is still referenced in native code generated by a previous prebuild. Resolution: clean the ios/ directory and re-prebuild.

4. **Peer Dependency Errors (Phase 4):** If removing `@react-navigation/native` causes TypeScript peer-resolution failures, the fallback reinstalls only that package as a direct dependency since expo-router depends on it transitively.

### Halt Conditions

The system halts (does not proceed to the next phase) when:
- Baseline gate fails before any work begins
- Auto-fix cannot resolve gate failures after a phase
- A file on the Do-Not-Touch list would be affected by a deletion
- `npm uninstall` exits with a non-zero code

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Do-Not-Touch file preservation

*For any* file on the Do-Not-Touch list (including all files under `src/utils/`, `src/database/secure-store.ts`, `src/constants/defaults.ts`, and the explicitly named component/test files), and *for any* phase execution, the file's existence and content must remain unchanged after the phase completes.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

### Property 2: Gate passage after each phase

*For any* completed phase (1 through 5), after all deletions and edits are applied (including any auto-fix), the TypeScript compiler (`tsc --noEmit`) must produce zero errors and the Jest test suite must pass with zero failures.

**Validates: Requirements 2.1, 2.2, 4.6, 5.4, 6.10, 8.5**

### Property 3: Auto-fix removes stale imports without introducing new errors

*For any* TypeScript file containing an import statement referencing a module that was deleted in the current phase, the auto-fix operation shall produce a file that (a) no longer contains any import of the deleted module, (b) has valid TypeScript syntax, and (c) does not introduce new type errors unrelated to other deleted modules.

**Validates: Requirements 2.3, 2.4**

### Property 4: Provider registry type-completeness

*For any* valid `ProviderType` value (`'openai' | 'anthropic' | 'custom'`), calling `getProvider(type)` returns an `IProvider` instance whose `.type` field equals the requested type. *For any* string that is not a valid `ProviderType`, `getProvider` throws an `Error`.

**Validates: Requirements 8.1, 8.2**

### Property 5: One commit per phase

*For any* successful execution of the purge pipeline, the git history on branch `chore/dead-code-purge` since its fork point from `main` contains exactly N commits (where N equals the number of completed phases), each commit corresponding to exactly one phase's changes.

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 6: Deletion completeness per phase

*For any* file listed in a phase's deletion manifest, after that phase executes, the file must not exist on disk. Conversely, *for any* file NOT listed in any phase's deletion manifest and NOT in a deleted directory, the file must still exist on disk after all phases complete.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9**

### Property 7: Dependency removal completeness

*For any* package listed for uninstallation in Phase 4, after Phase 4 completes, that package must not appear in `package.json` under `dependencies` or `devDependencies`. Additionally, the jest `transformIgnorePatterns` must not reference `uuid` and the `app.json` plugins array must not contain `expo-asset` or `expo-font`.

**Validates: Requirements 7.1, 7.2, 7.4, 7.5, 7.7**

### Property 8: Baseline precondition enforcement

*For any* initial codebase state where the gate fails, the purge system must halt without creating any commits or deleting any files.

**Validates: Requirements 10.1, 10.2**
