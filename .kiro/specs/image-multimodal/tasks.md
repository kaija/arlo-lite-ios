# Implementation Plan: Image Multimodal

## Overview

Enable multi-image selection from the photo library (up to 10), swap the paperclip icon for a mountain/landscape SVG, add the `supportsImageInput` gate in `useChat`, and enforce camera quality/mode constraints. The existing attachment flow stays intact — changes are scoped to picker options, icon swap, and the send-gate.

## Tasks

- [x] 1. Replace paperclip icon with image icon in InputChrome
  - [x] 1.1 Swap PaperclipIcon SVG with mountain/landscape ImageIcon in `src/components/layout/InputChrome.tsx`
    - Replace the `PaperclipIcon` function with an `ImageIcon` function using a mountain-with-sun landscape SVG path
    - Keep the same `{ color: string }` prop interface, 20×20 size, 24×24 viewBox
    - Preserve the existing `accessibilityLabel` on the attachment button unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2. Enable multi-select and encode all assets in AttachmentPicker
  - [x] 2.1 Update `pickImageFromLibrary` in `src/components/chat/AttachmentPicker.tsx` to support multi-select
    - Set `allowsMultipleSelection: true` and `selectionLimit: 10`
    - Loop over all `result.assets` using a new `assetsToContentParts` helper (replaces single-asset call)
    - Skip failed assets silently (try/catch per asset inside the loop)
    - Call `onAttachmentsSelected` only if at least one ContentPart was produced
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3_

  - [x] 2.2 Extract `assetsToContentParts` helper function
    - Rename/refactor existing `assetToContentParts` to `assetsToContentParts(assets: ImagePickerAsset[]): Promise<ContentPart[]>`
    - Process each asset: use `asset.base64` if available, else fallback to `FileSystem.readAsStringAsync` from URI
    - Default MIME type to `image/jpeg` when `asset.mimeType` is null/undefined
    - Return ContentParts in selection order, skipping failures
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.3 Write property tests for `assetsToContentParts`
    - **Property 1: Asset encoding produces valid data URIs**
    - **Property 2: Encoding preserves selection order and skips failures**
    - **Property 4: MIME type defaults to image/jpeg**
    - **Validates: Requirements 1.2, 2.1, 2.2, 2.3, 4.5**

- [x] 3. Add supportsImageInput gate in useChat
  - [x] 3.1 Add image capability check before send in `src/hooks/useChat.ts`
    - Before building multimodal content in `sendMessage`, check `modelConfig.supportsImageInput`
    - If attachments are present and `supportsImageInput` is false, set a non-retryable `ChatError` and return early
    - _Requirements: 4.1, 4.4_

  - [x] 3.2 Write property test for message content structure
    - **Property 3: Message content structure — text before images**
    - **Validates: Requirements 4.2, 4.3**

- [x] 4. Enforce camera capture constraints
  - [x] 4.1 Update `pickImageFromCamera` in `src/components/chat/AttachmentPicker.tsx`
    - Ensure `mediaTypes: ['images']` (video disabled) and `quality: 0.8` are set
    - Encode captured image identically to library path (reuse `assetsToContentParts`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Wire end-to-end and verify permission handling
  - [x] 6.1 Verify permission-denied and cancellation paths
    - Confirm library permission denied shows alert and does not invoke callback (already implemented, verify not regressed)
    - Confirm camera permission denied shows alert and does not launch camera
    - Confirm cancelled picker/camera produces no callback invocation
    - _Requirements: 1.4, 1.5, 5.3, 5.4_

  - [x] 6.2 Write unit tests for multi-select and gate behavior
    - Test `launchImageLibraryAsync` called with `allowsMultipleSelection: true, selectionLimit: 10`
    - Test `useChat` rejects send with `supportsImageInput: false` and surfaces non-retryable error
    - Test cancelled picker produces no callback
    - _Requirements: 1.1, 4.4_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The Anthropic adapter already handles `image_url` → native format conversion (no changes needed)
- The existing `ContentPart` type and message-building logic in `useChat` already supports multimodal content arrays — only the gate is missing
- `assetToContentParts` already exists; task 2.2 refactors it to handle arrays
- Property tests use `fast-check` (already installed in the project)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.2"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.3", "3.2"] },
    { "id": 3, "tasks": ["6.1"] },
    { "id": 4, "tasks": ["6.2"] }
  ]
}
```
