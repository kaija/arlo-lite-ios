# Requirements Document

## Introduction

Provider 設定介面的使用者體驗改進。目前使用者在新增 provider 時，面對的是一個三選一的分段控制（OpenAI / Anthropic / Custom），當使用者想連接 llama.cpp、Ollama、vLLM、OpenRouter、Google Gemini 或 AWS Bedrock 時，必須選擇含義不明的「Custom」選項並手動填入所有設定。

本次改進將：

1. 將 Provider Type 選擇器從分段控制改為下拉式選單（Picker），以容納更多選項
2. 將 llama.cpp、Ollama、vLLM、OpenRouter、Google (Gemini)、AWS Bedrock、Other (OpenAI-compatible) 提升為與 OpenAI / Anthropic 同級的一級選項（Provider Preset）
3. 每個 Preset 攜帶預設設定（Base URL、Reasoning Mode、是否需要 API Key），降低使用者設定負擔
4. 底層保持向下相容：wire type 仍為 `'openai' | 'anthropic' | 'custom'`，新增 `preset` 欄位記錄選擇的服務

## Glossary

- **Provider_Settings_Screen**: 用於新增或編輯 provider 連線設定的滑入式頁面（ProviderDetailScreen）
- **Provider_Dropdown**: 取代舊有分段控制的下拉式選單元件，列出所有可用的 Provider Preset 選項
- **Provider_Preset**: 預先定義的 provider 服務設定組合，包含 display name、underlying type、預設 base URL、預設 reasoning mode、API key 是否必填
- **Preset_ID**: Provider Preset 的唯一字串識別碼（如 `'openai'`、`'ollama'`、`'llama-cpp'`、`'other'`）
- **Provider_Config**: 資料庫中儲存的 provider 設定記錄，包含 type、preset、name、baseUrl 等欄位
- **Reasoning_Mode_Picker**: 讓使用者選擇 thinking effort 傳送機制的分段控制元件（Auto / Effort / Kwargs / None）
- **Contextual_Help_Text**: 顯示在控制元件下方的灰色說明文字，解釋該選項的用途
- **Connection_Test_Button**: 用來驗證 base URL 和 API key 可正常連線的按鈕
- **API_Mode_Selector**: OpenAI provider 專屬的 Responses / Chat Completions 模式選擇器
- **Wire_Type**: 底層 SDK 適配器選擇用的 provider 類型（`'openai' | 'anthropic' | 'custom'`），與 Preset_ID 分離

## Requirements

### Requirement 1: Provider Dropdown 選擇器

**User Story:** 身為使用者，我想從一個完整的下拉式選單中直接選擇我要連接的 LLM 服務（如 Ollama、llama.cpp、OpenRouter），而不需要先選「Custom」再手動設定所有細節。

#### Acceptance Criteria

1. WHEN the user opens the Provider_Settings_Screen in add mode, THE Provider_Settings_Screen SHALL display a Provider_Dropdown listing all available Provider_Preset options
2. THE Provider_Dropdown SHALL present the following Preset_ID options in order: openai, anthropic, openrouter, llama-cpp, ollama, vllm, google, bedrock, other
3. THE Provider_Dropdown SHALL display each option with its human-readable display name: "OpenAI", "Anthropic", "OpenRouter", "llama.cpp", "Ollama", "vLLM", "Google (Gemini)", "AWS Bedrock", "其他 (OpenAI 相容)"
4. WHEN the user selects a Provider_Preset from the Provider_Dropdown, THE Provider_Settings_Screen SHALL display Contextual_Help_Text below the dropdown describing the selected service
5. WHEN the user selects "openai" preset, THE Provider_Settings_Screen SHALL display help text indicating it uses the official OpenAI API
6. WHEN the user selects "anthropic" preset, THE Provider_Settings_Screen SHALL display help text indicating it uses the official Anthropic Messages API
7. WHEN the user selects "openrouter" preset, THE Provider_Settings_Screen SHALL display help text indicating it is a unified gateway to multiple LLM providers
8. WHEN the user selects "llama-cpp" preset, THE Provider_Settings_Screen SHALL display help text indicating it connects to a local llama.cpp server
9. WHEN the user selects "ollama" preset, THE Provider_Settings_Screen SHALL display help text indicating it connects to a local Ollama instance
10. WHEN the user selects "vllm" preset, THE Provider_Settings_Screen SHALL display help text indicating it connects to a local vLLM server
11. WHEN the user selects "google" preset, THE Provider_Settings_Screen SHALL display help text indicating it connects to Google Gemini via the OpenAI-compatible endpoint
12. WHEN the user selects "bedrock" preset, THE Provider_Settings_Screen SHALL display help text indicating it connects to AWS Bedrock (user must provide endpoint)
13. WHEN the user selects "other" preset, THE Provider_Settings_Screen SHALL display help text indicating it is for any OpenAI-compatible endpoint not listed above
14. WHILE the Provider_Settings_Screen is in edit mode for an existing provider, THE Provider_Dropdown SHALL be disabled and display the current preset as read-only

### Requirement 2: Preset 預設值自動填入

**User Story:** 身為使用者，我想在選擇 Provider Preset 後自動帶入合理的預設值（Base URL、Reasoning Mode），以便快速完成設定而不需查閱文件。

#### Acceptance Criteria

1. WHEN the user selects "openai" preset, THE Provider_Settings_Screen SHALL pre-fill base URL with "https://api.openai.com/v1"
2. WHEN the user selects "anthropic" preset, THE Provider_Settings_Screen SHALL pre-fill base URL with "https://api.anthropic.com"
3. WHEN the user selects "openrouter" preset, THE Provider_Settings_Screen SHALL pre-fill base URL with "https://openrouter.ai/api/v1" and set reasoning mode to "openai-reasoning-effort"
4. WHEN the user selects "llama-cpp" preset, THE Provider_Settings_Screen SHALL pre-fill base URL with "http://localhost:8080/v1" and set reasoning mode to "chat-template-kwargs"
5. WHEN the user selects "ollama" preset, THE Provider_Settings_Screen SHALL pre-fill base URL with "http://localhost:11434/v1" and set reasoning mode to "chat-template-kwargs"
6. WHEN the user selects "vllm" preset, THE Provider_Settings_Screen SHALL pre-fill base URL with "http://localhost:8000/v1" and set reasoning mode to "chat-template-kwargs"
7. WHEN the user selects "google" preset, THE Provider_Settings_Screen SHALL pre-fill base URL with "https://generativelanguage.googleapis.com/v1beta/openai" and set reasoning mode to "openai-reasoning-effort"
8. WHEN the user selects "bedrock" preset, THE Provider_Settings_Screen SHALL leave base URL empty and set reasoning mode to "openai-reasoning-effort"
9. WHEN the user selects "other" preset, THE Provider_Settings_Screen SHALL leave base URL empty and set reasoning mode to "auto"
10. WHEN a preset with pre-filled base URL is selected, THE Provider_Settings_Screen SHALL allow the user to override the pre-filled value
11. WHEN a preset defines API key as not required (llama-cpp, ollama, vllm, other), THE Provider_Settings_Screen SHALL mark the API key field as optional and display placeholder text "Optional — leave empty for local servers"
12. WHEN a preset defines API key as required (openai, anthropic, openrouter, google, bedrock), THE Provider_Settings_Screen SHALL mark the API key field as required with validation

### Requirement 3: Provider_Config 資料模型擴充

**User Story:** 身為開發者，我想在 Provider_Config 中記錄使用者選擇的 Preset_ID，以便在 UI 中正確顯示 provider 來源並在未來套用 preset 更新。

#### Acceptance Criteria

1. THE Provider_Config SHALL include a "preset" field of type Preset_ID that stores the identifier of the selected Provider_Preset
2. THE Provider_Config SHALL map Preset_ID to Wire_Type as follows: "openai" maps to wire type "openai", "anthropic" maps to wire type "anthropic", all other Preset_IDs map to wire type "custom"
3. WHEN a provider is saved, THE Provider_Config SHALL persist both the "type" (Wire_Type) and "preset" (Preset_ID) fields
4. WHEN loading existing providers that have no "preset" field (migration), THE Provider_Config SHALL infer preset from type: wire type "openai" infers preset "openai", wire type "anthropic" infers preset "anthropic", wire type "custom" with no preset infers preset "other"
5. THE Provider_Config SHALL use the "type" (Wire_Type) field exclusively for selecting the SDK adapter at runtime
6. THE Provider_Config SHALL use the "preset" (Preset_ID) field exclusively for UI display and default value resolution

### Requirement 4: Custom Provider 設定區塊標題重整

**User Story:** 身為使用者，我想讓 provider 設定畫面的區塊結構清晰明確，以便快速找到要修改的設定。

#### Acceptance Criteria

1. WHILE the selected preset maps to wire type "custom" (openrouter, llama-cpp, ollama, vllm, google, bedrock, other), THE Provider_Settings_Screen SHALL group Base URL, Streaming toggle, and Connection_Test_Button under a "CONNECTION" section header
2. WHILE the selected preset maps to wire type "custom", THE Provider_Settings_Screen SHALL group Reasoning_Mode_Picker and thinkingKwargs input under a "THINKING" section header
3. WHILE the selected preset is "openai", THE Provider_Settings_Screen SHALL group API_Mode_Selector under the existing "CONFIGURATION" section header
4. WHILE the selected preset is "anthropic", THE Provider_Settings_Screen SHALL display only the "CONNECTION" section with Base URL and Streaming toggle (no THINKING section)

### Requirement 5: Reasoning Mode 選項說明

**User Story:** 身為使用者，我想了解每個 Reasoning Mode 選項的具體意義，以便根據我的後端正確設定。

#### Acceptance Criteria

1. WHEN the user selects "Auto" reasoning mode, THE Provider_Settings_Screen SHALL display help text "同時傳送 reasoning_effort 和 chat_template_kwargs，相容大多數後端"
2. WHEN the user selects "Effort" reasoning mode, THE Provider_Settings_Screen SHALL display help text "僅傳送 reasoning_effort 參數（適用於 OpenRouter 等支援此標準的服務）"
3. WHEN the user selects "Kwargs" reasoning mode, THE Provider_Settings_Screen SHALL display help text "僅傳送 chat_template_kwargs（適用於 llama.cpp、vLLM 等使用 Jinja 模板的後端）"
4. WHEN the user selects "None" reasoning mode, THE Provider_Settings_Screen SHALL display help text "不傳送任何思考參數（模型不支援思考時使用）"

### Requirement 6: 連線測試功能

**User Story:** 身為使用者，我想測試 provider 的連線狀態，以便確認 Base URL 和 API Key 設定正確。

#### Acceptance Criteria

1. WHILE the selected preset maps to wire type "custom" and base URL is non-empty, THE Provider_Settings_Screen SHALL display a Connection_Test_Button
2. WHILE the selected preset maps to wire type "custom" and the preset requires an API key, THE Provider_Settings_Screen SHALL require API key to be non-empty before enabling the Connection_Test_Button
3. WHILE the selected preset maps to wire type "custom" and the preset does not require an API key, THE Provider_Settings_Screen SHALL enable the Connection_Test_Button when base URL alone is non-empty
4. WHEN the user taps the Connection_Test_Button, THE Provider_Settings_Screen SHALL attempt to list models from the configured endpoint
5. WHEN the connection test succeeds, THE Provider_Settings_Screen SHALL display a success indicator with the text from translation key "providers.connected"
6. WHEN the connection test fails, THE Provider_Settings_Screen SHALL display a failure indicator with the text from translation key "providers.connectionFailed"
7. WHILE a connection test is in progress, THE Connection_Test_Button SHALL display a loading indicator and be disabled

### Requirement 7: Reasoning Mode 預設值與 thinkingKwargs 模板

**User Story:** 身為使用者，我想要合理的預設值和範例，以便快速完成設定而不需查閱文件。

#### Acceptance Criteria

1. WHEN a new provider is created with a preset that defines a default reasoning mode, THE Provider_Settings_Screen SHALL pre-select that reasoning mode
2. WHEN the user selects "Kwargs" reasoning mode and the thinkingKwargs field is empty, THE Provider_Settings_Screen SHALL display placeholder text showing a Qwen-family example: {"enable_thinking": true}
3. THE Provider_Settings_Screen SHALL validate thinkingKwargs input as valid JSON on blur and display an error message from translation key "providers.thinkingKwargsError" when invalid

### Requirement 8: 翻譯支援

**User Story:** 身為使用者，我想要所有新增的 UI 文字都支援繁體中文翻譯，以便使用我偏好的語言操作。

#### Acceptance Criteria

1. THE Provider_Settings_Screen SHALL use i18next translation keys for all newly added Contextual_Help_Text strings, Provider_Dropdown labels, and section headers
2. WHEN the app language is set to zh-TW, THE Provider_Settings_Screen SHALL display all preset descriptions, reasoning mode descriptions, and section headers in Traditional Chinese
3. WHEN the app language is set to en, THE Provider_Settings_Screen SHALL display all newly added text in English

### Requirement 9: Accessibility 合規

**User Story:** 身為使用 VoiceOver 的使用者，我想要所有新增控制項都有正確的無障礙標籤，以便用螢幕閱讀器操作設定。

#### Acceptance Criteria

1. THE Provider_Dropdown SHALL have an accessibilityLabel matching the translation key "providers.selectProvider" and accessibilityRole set to "combobox"
2. THE Connection_Test_Button SHALL have an accessibilityLabel matching the translation key "providers.testConnection"
3. THE Reasoning_Mode_Picker SHALL have accessibilityRole set to "radiogroup" for the container and "radio" for each option
4. WHEN the connection test result is displayed, THE Provider_Settings_Screen SHALL announce the result text to VoiceOver via accessibilityLiveRegion or equivalent mechanism
