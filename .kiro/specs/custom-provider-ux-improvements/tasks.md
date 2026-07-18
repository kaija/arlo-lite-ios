# Implementation Plan: Custom Provider UX Improvements

## Overview

Replace the 3-option segmented control (OpenAI / Anthropic / Custom) with a full dropdown Picker listing 9 provider presets. Each preset carries sensible defaults (base URL, reasoning mode, API key requirement) so users can configure services like Ollama, llama.cpp, vLLM, OpenRouter, Google Gemini, and AWS Bedrock with minimal manual entry. A new `preset` column in the database records which service was chosen, while the existing `type` field continues to select the SDK adapter at runtime.

## Tasks

- [x] 1. Provider Presets Registry
  - [x] 1.1 Create `src/constants/provider-presets.ts` with types and preset data
    - Define `PresetId` union type with all 9 values: openai, anthropic, openrouter, llama-cpp, ollama, vllm, google, bedrock, other
    - Define `ProviderPreset` interface with fields: id, wireType, labelKey, descriptionKey, defaultBaseUrl, defaultReasoningMode, apiKeyRequired
    - Export `PROVIDER_PRESETS` readonly array with all 9 preset objects per design spec
    - Implement `getPreset(id)` lookup with 'other' fallback for unknown IDs
    - Implement `presetToWireType(presetId)` mapping function
    - Implement `inferPresetFromType(wireType)` for legacy providers without preset
    - _Requirements: 2.1–2.9, 3.1, 3.2, 3.4, 3.5, 3.6_

  - [x] 1.2 Write unit tests for provider presets registry
    - Verify PROVIDER_PRESETS has exactly 9 entries in the specified order
    - Test each preset's wireType matches spec (openai→openai, anthropic→anthropic, rest→custom)
    - Test `getPreset()` returns correct preset for each ID
    - Test `getPreset()` falls back to 'other' for unknown ID
    - Test `presetToWireType()` for all 9 IDs
    - Test `inferPresetFromType()` for all 3 wire types
    - _Requirements: 3.2, 3.4_

- [x] 2. Database migration and repository updates
  - [x] 2.1 Create `src/database/migrations/v5.ts` migration file
    - Implement `migrateV5` async function that runs `ALTER TABLE providers ADD COLUMN preset TEXT DEFAULT NULL`
    - Export the function for registration in database.ts
    - _Requirements: 3.1, 3.3_

  - [x] 2.2 Register migration v5 in `src/database/database.ts`
    - Import `migrateV5` from `./migrations/v5`
    - Bump `CURRENT_VERSION` from 4 to 5
    - Add entry `5: migrateV5` to the migrations record
    - _Requirements: 3.1_

  - [x] 2.3 Update `src/database/repositories/provider-repo.ts` to support preset field
    - Add `preset: string | null` to `ProviderRow` interface
    - Add `preset?: PresetId` to `CreateProviderData` interface
    - Add `preset?: PresetId` to `UpdateProviderData` interface
    - Add `preset: PresetId` to `Provider` interface
    - Update `rowToProvider` to infer preset: `(row.preset as PresetId) ?? inferPresetFromType(row.type)`
    - Update `createProvider` INSERT to include preset column
    - Update `createProvider` return object to include preset field
    - Update `updateProvider` to handle preset in SET clauses
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Checkpoint — Database layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Provider store and i18n updates
  - [x] 4.1 Update `src/stores/provider-store.ts` to pass preset through
    - Update `addProvider` to include preset in `CreateProviderData` passed to the repository
    - Ensure the `Provider` type re-export from store includes the new preset field
    - No changes to `testConnection` — it already works via providerId lookup
    - _Requirements: 3.3, 3.5_

  - [x] 4.2 Add i18n keys to `src/i18n/locales/en.json`
    - Add preset label keys: presetOpenAI, presetAnthropic, presetOpenRouter, presetLlamaCpp, presetOllama, presetVllm, presetGoogle, presetBedrock, presetOther
    - Add preset description keys: presetOpenAIDesc, presetAnthropicDesc, presetOpenRouterDesc, presetLlamaCppDesc, presetOllamaDesc, presetVllmDesc, presetGoogleDesc, presetBedrockDesc, presetOtherDesc
    - Add section headers: sectionConnection, sectionThinking, sectionConfiguration
    - Add reasoning mode help text keys: reasoningModeAutoDesc, reasoningModeEffortDesc, reasoningModeKwargsDesc, reasoningModeNoneDesc
    - Add connection test keys (if not already present): testConnection, connected, connectionFailed
    - Add accessibility keys: selectProvider
    - Add API key optional placeholder: apiKeyOptionalPlaceholder
    - _Requirements: 8.1, 8.3, 1.5–1.13, 5.1–5.4, 9.1, 9.2_

  - [x] 4.3 Add i18n keys to `src/i18n/locales/zh-TW.json`
    - Add Traditional Chinese translations for all keys added in 4.2
    - Preset names stay in English (OpenAI, Anthropic, etc.) but descriptions are translated
    - Section headers: 連線, 思考, 設定
    - Reasoning mode descriptions in zh-TW per requirement 5.1–5.4
    - _Requirements: 8.1, 8.2_

- [x] 5. ProviderDetailScreen UI — Dropdown and preset selection
  - [x] 5.1 Install `@react-native-picker/picker` dependency and add Picker component
    - Run `npx expo install @react-native-picker/picker`
    - Import Picker in ProviderDetailScreen
    - _Requirements: 1.1_

  - [x] 5.2 Replace segmented control with Provider Dropdown in add mode
    - Remove the 3-option PROVIDER_TYPES segmented control in add mode
    - Add a Picker component listing all 9 presets using `PROVIDER_PRESETS` data
    - Display each option using its translated `labelKey`
    - Set accessibilityLabel from `providers.selectProvider` and accessibilityRole="combobox" (Req 9.1)
    - Add state variable `selectedPreset` (default: 'openai')
    - On preset change: resolve defaults from `getPreset()`, update baseUrl, reasoningMode, and form state
    - _Requirements: 1.1, 1.2, 1.3, 2.1–2.9, 9.1_

  - [x] 5.3 Add contextual help text below dropdown
    - Display translated `descriptionKey` text below the Picker when a preset is selected
    - Style as gray tertiary text matching existing `keychainNote` style
    - _Requirements: 1.4–1.13_

  - [x] 5.4 Disable dropdown in edit mode
    - When in edit mode, render Picker as disabled (or show a read-only Text displaying current preset label)
    - Derive preset from provider's stored preset field
    - _Requirements: 1.14_

- [x] 6. ProviderDetailScreen UI — Section restructuring and form logic
  - [x] 6.1 Implement section layout rules based on wireType
    - wireType 'custom': show CONNECTION section (Base URL, Streaming, Connection Test) + THINKING section (Reasoning Mode, thinkingKwargs)
    - wireType 'openai': show CONFIGURATION section (Base URL, Streaming, API Mode selector)
    - wireType 'anthropic': show CONNECTION section (Base URL, Streaming) only — no THINKING section
    - Use translated section header keys (sectionConnection, sectionThinking, sectionConfiguration)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 Add reasoning mode help text
    - Display contextual description below the Reasoning Mode picker based on current selection
    - Auto: "同時傳送 reasoning_effort 和 chat_template_kwargs，相容大多數後端"
    - Effort: "僅傳送 reasoning_effort 參數（適用於 OpenRouter 等支援此標準的服務）"
    - Kwargs: "僅傳送 chat_template_kwargs（適用於 llama.cpp、vLLM 等使用 Jinja 模板的後端）"
    - None: "不傳送任何思考參數（模型不支援思考時使用）"
    - Use i18n keys for localization
    - Set accessibilityRole="radiogroup" on container, "radio" on each option (Req 9.3)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 9.3_

  - [x] 6.3 Implement API key field conditional logic
    - When `getPreset(selectedPreset).apiKeyRequired` is false: mark API key field as optional, show placeholder "Optional — leave empty for local servers"
    - When `apiKeyRequired` is true: mark API key as required with validation
    - Update form validation: don't require apiKey for presets where it's optional
    - _Requirements: 2.11, 2.12_

  - [x] 6.4 Implement connection test button with enable/disable logic
    - Show Connection_Test_Button when wireType === 'custom' && baseUrl is non-empty
    - If preset requires API key: also require non-empty key to enable button
    - If preset does NOT require API key: enable when baseUrl alone is non-empty
    - Show loading state during test (ActivityIndicator + disabled state)
    - Display success/failure indicator using translated keys
    - Announce result to VoiceOver via accessibilityLiveRegion (Req 9.4)
    - Set accessibilityLabel from `providers.testConnection` (Req 9.2)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 9.2, 9.4_

  - [x] 6.5 Wire up save handler to persist preset field
    - On save in add mode: derive wireType from preset via `presetToWireType()`, pass both `type` and `preset` to `addProvider`
    - Ensure provider name defaults to preset label if user leaves name empty
    - _Requirements: 3.3, 3.5_

- [x] 7. Checkpoint — UI implementation complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Property-based tests
  - [x] 8.1 Write property test for preset-to-wireType mapping consistency
    - **Property 1: Preset-to-WireType mapping consistency**
    - Generate arbitrary PresetId values, verify: 'openai'→'openai', 'anthropic'→'anthropic', all others→'custom'
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 3.2**

  - [x] 8.2 Write property test for preset defaults resolution completeness
    - **Property 2: Preset defaults resolution completeness**
    - Generate arbitrary PresetId values, verify `getPreset()` returns object with: non-undefined defaultBaseUrl (string), valid defaultReasoningMode, boolean apiKeyRequired
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 2.1–2.9, 7.1**

  - [x] 8.3 Write property test for legacy preset inference round-trip
    - **Property 3: Legacy preset inference round-trip**
    - Generate arbitrary ProviderType values ('openai' | 'anthropic' | 'custom'), verify `presetToWireType(inferPresetFromType(T)) === T`
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 3.4**

  - [x] 8.4 Write property test for API key requirement consistency
    - **Property 4: API key requirement consistency**
    - Generate arbitrary PresetId + baseUrl (non-empty string) + apiKey (string, possibly empty) combinations
    - Verify: if `apiKeyRequired` is false, button enabled when baseUrl non-empty regardless of apiKey; if `apiKeyRequired` is true, button enabled only when both baseUrl and apiKey are non-empty
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 2.11, 2.12, 6.2, 6.3**

- [x] 9. Integration tests
  - [x] 9.1 Write integration test for migration v5
    - Create test database with v4 schema and existing provider rows
    - Run migrateV5, verify preset column added
    - Verify existing rows have `preset = NULL`
    - Verify new provider can be inserted with preset value
    - _Requirements: 3.1, 3.4_

  - [x] 9.2 Write integration test for create + read round-trip with preset
    - Create a provider with preset 'ollama' via provider-repo
    - Read it back via `getProvider()`
    - Verify `type === 'custom'` and `preset === 'ollama'`
    - Verify `inferPresetFromType` is used when preset is NULL (legacy row)
    - _Requirements: 3.3, 3.4_

- [x] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The ProviderDetailScreen (~900 lines) is modified incrementally: task 5 handles the dropdown swap, task 6 handles section restructuring and detailed form logic
- The `@react-native-picker/picker` package is an Expo-compatible community module; install via `npx expo install`
- The existing `DEFAULT_PROVIDER_URLS` constant in `src/constants/defaults.ts` can be deprecated in favor of preset defaults, but should remain for backward compatibility during the transition

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "4.2", "4.3"] },
    { "id": 1, "tasks": ["1.2", "2.2", "2.3"] },
    { "id": 2, "tasks": ["4.1", "5.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 5, "tasks": ["6.4", "6.5"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3", "8.4"] },
    { "id": 7, "tasks": ["9.1", "9.2"] }
  ]
}
```
