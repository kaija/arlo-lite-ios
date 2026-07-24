# Requirements Document

## Introduction

Add multi-image selection and attachment support to the chat input. Users can pick multiple images from their photo library, which are base64-encoded as `image_url` content parts per the OpenAI and Anthropic multimodal specifications, then submitted alongside text to the LLM. The existing paperclip attachment icon is replaced with an image-specific SVG icon.

## Glossary

- **Image_Picker**: The system component that launches the device photo library or camera for image selection (backed by `expo-image-picker`).
- **Content_Part**: A typed segment of a multimodal message, either `{ type: 'text', text: string }` or `{ type: 'image_url', image_url: { url: string } }`.
- **Attachment_Icon**: The SVG icon rendered in the compose row of the input bar that triggers image selection.
- **Input_Chrome**: The bottom input bar component containing the text input, model chip, and action buttons.
- **Attachment_Picker**: The component responsible for handling image/file selection and encoding.

## Requirements

### Requirement 1: Multiple Image Selection

**User Story:** As a user, I want to select multiple images from my photo library in a single pick operation, so that I can attach several images to one message without repeating the selection flow.

#### Acceptance Criteria

1. WHEN the user taps the image attachment button and selects "Photo Library", THE Image_Picker SHALL allow selection of multiple images in a single session with a maximum selection limit of 10 images.
2. WHEN multiple images are selected, THE Attachment_Picker SHALL encode each selected image as a separate `image_url` Content_Part with a base64 data URL, processing images in selection order.
3. WHEN the user confirms their selection, THE Attachment_Picker SHALL call the onAttachmentsSelected callback with all successfully encoded Content_Parts in selection order within 10 seconds of confirmation.
4. IF photo library permission is denied, THEN THE Attachment_Picker SHALL display an alert informing the user that photo library access is required and SHALL NOT invoke the onAttachmentsSelected callback.
5. IF the user cancels the picker without selecting any images, THEN THE Attachment_Picker SHALL take no action and SHALL NOT invoke the onAttachmentsSelected callback.

### Requirement 2: Image Encoding per Provider Spec

**User Story:** As a user, I want my attached images encoded correctly for the active LLM provider, so that the model receives and processes them without errors.

#### Acceptance Criteria

1. WHEN an image asset is selected, THE Attachment_Picker SHALL encode it as a data URL in the format `data:{mimeType};base64,{data}` wrapped in an `image_url` Content_Part, where mimeType is the MIME type reported by the picker asset or `image/jpeg` if the picker does not report one.
2. WHEN base64 data is not directly available from the picker asset, THE Attachment_Picker SHALL read the image file from its local URI using filesystem base64 encoding and produce the same `image_url` Content_Part format as criterion 1.
3. IF an image fails to encode (filesystem read error or missing URI and no base64 data), THEN THE Attachment_Picker SHALL skip that image, produce no Content_Part for it, and continue encoding any remaining selections without blocking the user.
4. WHEN the active provider is Anthropic, THE provider adapter SHALL convert the `image_url` Content_Part to the provider's native image block format before sending the request.

### Requirement 3: Replace Attachment Icon with Image Icon

**User Story:** As a user, I want the attachment button to show an image icon instead of a paperclip, so that the action clearly communicates image attachment.

#### Acceptance Criteria

1. THE Input_Chrome SHALL render an image SVG icon (mountain/landscape style) in place of the current paperclip icon for the attachment button.
2. THE Attachment_Icon SHALL use the same `IconProps` interface (size and color props), default size, default color, and viewBox dimensions as the existing icon components in `src/components/icons/`.
3. THE Attachment_Icon SHALL preserve the existing accessibility label text of the attachment button unchanged.
4. WHEN the user activates the attachment icon button, THE Input_Chrome SHALL trigger the same attachment action handler that the previous paperclip button invoked.

### Requirement 4: Image Submission to LLM

**User Story:** As a user, I want my selected images sent to the LLM alongside my text message, so that the model can reason about the image content.

#### Acceptance Criteria

1. WHEN the user sends a message with attached images and the active model's supportsImageInput capability is true, THE useChat hook SHALL include all image ContentParts in the message payload sent to the provider.
2. WHEN text and images are both present, THE message content SHALL be structured as an array of ContentParts with a single text part first, followed by one or more image_url parts in the order they were attached.
3. WHEN only images are attached with no text, THE message content SHALL contain only the image ContentParts with no text part prepended.
4. IF the user sends a message with attached images and the active model's supportsImageInput capability is false, THEN THE useChat hook SHALL reject the send attempt and surface a non-retryable ChatError indicating the active model does not support image input.
5. WHEN image ContentParts are included in the payload, THE image_url value SHALL be a base64-encoded data URI (format: `data:image/<subtype>;base64,<data>`) representing the image bytes selected by the user.

### Requirement 5: Camera Image Capture

**User Story:** As a user, I want to take a photo with my camera and attach it to a message, so that I can share real-time images with the LLM.

#### Acceptance Criteria

1. WHEN the user taps the image attachment button and selects "Camera", THE Attachment_Picker SHALL request camera permission and launch the device camera in still-photo-only mode (video disabled).
2. WHEN a photo is captured, THE Attachment_Picker SHALL encode it as a single `image_url` Content_Part with a base64 data URL in the format `data:<mime_type>;base64,<data>`, using the captured image's MIME type (defaulting to `image/jpeg` if unavailable) and a compression quality of 0.8.
3. IF camera permission is denied, THEN THE Attachment_Picker SHALL display an alert indicating that camera access is required and not launch the camera.
4. IF the user dismisses the camera without capturing a photo, THEN THE Attachment_Picker SHALL produce no Content_Parts and return to the chat input without error.
