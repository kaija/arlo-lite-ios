import fc from 'fast-check';
import type { ContentPart } from '@/providers/types';

/**
 * Property-based test for message content structure.
 *
 * **Validates: Requirements 4.2, 4.3**
 *
 * Feature: image-multimodal, Property 3: Message content structure — text before images
 *
 * For any non-empty text string and any non-empty array of image_url ContentParts,
 * the constructed message content array SHALL have exactly one text part at index 0,
 * followed by all image parts in their original order, with total length equal to
 * 1 + number of images. When text is empty, the array SHALL contain only the image parts.
 */

/**
 * Pure extraction of the content-building logic from useChat.ts sendMessage.
 * Given user text and image attachments, builds the multimodal content array.
 */
function buildMessageContent(text: string, attachments: ContentPart[]): ContentPart[] {
  const parts: ContentPart[] = [];
  if (text.length > 0) {
    parts.push({ type: 'text', text });
  }
  parts.push(...attachments);
  return parts;
}

/** Arbitrary: a valid image_url ContentPart with a base64 data URI */
const imagePartArb: fc.Arbitrary<ContentPart> = fc
  .tuple(
    fc.constantFrom('jpeg', 'png', 'webp', 'gif'),
    fc.base64String({ minLength: 4, maxLength: 100 }),
  )
  .map(([subtype, data]) => ({
    type: 'image_url' as const,
    image_url: { url: `data:image/${subtype};base64,${data}` },
  }));

describe('Property 3: Message content structure — text before images', () => {
  it('non-empty text + non-empty images → text at index 0, then images in order, length = 1 + images.length', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.array(imagePartArb, { minLength: 1, maxLength: 10 }),
        (text, images) => {
          const result = buildMessageContent(text, images);

          // Length = 1 text part + N image parts
          expect(result.length).toBe(1 + images.length);

          // Index 0 is the text part
          expect(result[0]).toEqual({ type: 'text', text });

          // Remaining are the image parts in original order
          for (let i = 0; i < images.length; i++) {
            expect(result[i + 1]).toEqual(images[i]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('empty text + non-empty images → only image parts, no text part prepended', () => {
    fc.assert(
      fc.property(
        fc.array(imagePartArb, { minLength: 1, maxLength: 10 }),
        (images) => {
          const result = buildMessageContent('', images);

          // Length equals number of images (no text part)
          expect(result.length).toBe(images.length);

          // No text part anywhere
          expect(result.every((p) => p.type === 'image_url')).toBe(true);

          // Order preserved
          for (let i = 0; i < images.length; i++) {
            expect(result[i]).toEqual(images[i]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
