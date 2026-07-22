/**
 * Property-based tests for assetsToContentParts.
 *
 * **Validates: Requirements 1.2, 2.1, 2.2, 2.3, 4.5**
 *
 * Tests the encoding logic that converts ImagePicker assets into
 * image_url ContentParts with base64 data URIs.
 */

import fc from 'fast-check';
import * as FileSystem from 'expo-file-system';
import { assetsToContentParts } from '../AttachmentPicker';
import type { ImagePickerAsset } from 'expo-image-picker';

// ═══════════════════════════════════════════════════════════════════════════════
// Mocks
// ═══════════════════════════════════════════════════════════════════════════════

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

const mockReadAsStringAsync = FileSystem.readAsStringAsync as jest.Mock;

// ═══════════════════════════════════════════════════════════════════════════════
// Generators
// ═══════════════════════════════════════════════════════════════════════════════

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const base64Arb = fc.stringOf(fc.constantFrom(...BASE64_CHARS), { minLength: 4, maxLength: 100 });

const mimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
const mimeTypeArb = fc.constantFrom(...mimeTypes);

/** Asset with base64 data available directly */
const validBase64AssetArb = fc.record({
  base64: base64Arb,
  mimeType: fc.option(mimeTypeArb, { nil: undefined }),
  uri: fc.constant('file:///tmp/img.jpg'),
  // Required fields for ImagePickerAsset type
  width: fc.constant(100),
  height: fc.constant(100),
  type: fc.constant('image' as const),
  fileName: fc.constant('img.jpg'),
  fileSize: fc.constant(1024),
  assetId: fc.constant(null),
  exif: fc.constant(null),
  duration: fc.constant(null),
}) as fc.Arbitrary<ImagePickerAsset>;

/** Asset with no base64, but a valid URI (fallback path) */
const validUriAssetArb = fc.record({
  base64: fc.constant(null),
  mimeType: fc.option(mimeTypeArb, { nil: undefined }),
  uri: fc.constant('file:///tmp/fallback.jpg'),
  width: fc.constant(100),
  height: fc.constant(100),
  type: fc.constant('image' as const),
  fileName: fc.constant('img.jpg'),
  fileSize: fc.constant(1024),
  assetId: fc.constant(null),
  exif: fc.constant(null),
  duration: fc.constant(null),
}) as fc.Arbitrary<ImagePickerAsset>;

/** Invalid asset: no base64 AND no uri */
const invalidAssetArb = fc.record({
  base64: fc.constant(null),
  mimeType: fc.option(mimeTypeArb, { nil: undefined }),
  uri: fc.constant(''),  // empty string — will cause FileSystem read to throw
  width: fc.constant(100),
  height: fc.constant(100),
  type: fc.constant('image' as const),
  fileName: fc.constant(null),
  fileSize: fc.constant(null),
  assetId: fc.constant(null),
  exif: fc.constant(null),
  duration: fc.constant(null),
}) as fc.Arbitrary<ImagePickerAsset>;

// ═══════════════════════════════════════════════════════════════════════════════
// Property 1: Asset encoding produces valid data URIs
// Feature: image-multimodal, Property 1: Asset encoding produces valid data URIs
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: image-multimodal, Property 1: Asset encoding produces valid data URIs', () => {
  beforeEach(() => {
    mockReadAsStringAsync.mockResolvedValue('AAAA'); // valid base64 fallback
  });

  it('all output URLs match data URI regex', async () => {
    const dataUriPattern = /^data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+$/;

    await fc.assert(
      fc.asyncProperty(
        fc.array(validBase64AssetArb, { minLength: 1, maxLength: 5 }),
        async (assets) => {
          const parts = await assetsToContentParts(assets);
          return parts.every(
            (p) => p.type === 'image_url' && dataUriPattern.test(p.image_url.url),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('fallback URI path also produces valid data URIs', async () => {
    const dataUriPattern = /^data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+$/;

    await fc.assert(
      fc.asyncProperty(
        fc.array(validUriAssetArb, { minLength: 1, maxLength: 5 }),
        async (assets) => {
          const parts = await assetsToContentParts(assets);
          return parts.every(
            (p) => p.type === 'image_url' && dataUriPattern.test(p.image_url.url),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 2: Encoding preserves selection order and skips failures
// Feature: image-multimodal, Property 2: Encoding preserves selection order and skips failures
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: image-multimodal, Property 2: Encoding preserves selection order and skips failures', () => {
  beforeEach(() => {
    // Make FileSystem throw for empty URIs (invalid assets)
    mockReadAsStringAsync.mockImplementation((uri: string) => {
      if (!uri || uri === '') return Promise.reject(new Error('File not found'));
      return Promise.resolve('AAAA');
    });
  });

  it('output length equals count of valid assets', async () => {
    // Mix valid (base64) and invalid (no base64, empty uri) assets
    const mixedArrayArb = fc.array(
      fc.oneof(validBase64AssetArb, invalidAssetArb),
      { minLength: 1, maxLength: 8 },
    );

    await fc.assert(
      fc.asyncProperty(mixedArrayArb, async (assets) => {
        const validCount = assets.filter((a) => a.base64 !== null).length;
        const parts = await assetsToContentParts(assets);
        return parts.length === validCount;
      }),
      { numRuns: 100 },
    );
  });

  it('order of valid assets is preserved in output', async () => {
    // Use unique base64 per asset to verify order
    const taggedValidAssetArb = base64Arb.map((b64) => ({
      base64: b64,
      mimeType: 'image/png',
      uri: 'file:///tmp/img.jpg',
      width: 100,
      height: 100,
      type: 'image' as const,
      fileName: 'img.jpg',
      fileSize: 1024,
      assetId: null,
      exif: null,
      duration: null,
    })) as fc.Arbitrary<ImagePickerAsset>;

    const mixedArb = fc.array(
      fc.oneof(taggedValidAssetArb, invalidAssetArb),
      { minLength: 1, maxLength: 8 },
    );

    await fc.assert(
      fc.asyncProperty(mixedArb, async (assets) => {
        const parts = await assetsToContentParts(assets);
        const validAssets = assets.filter((a) => a.base64 !== null);

        // Each output part's data should match the valid asset at same index
        return parts.every((p, i) => {
          if (p.type !== 'image_url') return false;
          const expected = `data:${validAssets[i].mimeType || 'image/jpeg'};base64,${validAssets[i].base64}`;
          return p.image_url.url === expected;
        });
      }),
      { numRuns: 100 },
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 4: MIME type defaults to image/jpeg
// Feature: image-multimodal, Property 4: MIME type defaults to image/jpeg
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: image-multimodal, Property 4: MIME type defaults to image/jpeg', () => {
  it('assets with null/undefined mimeType produce data:image/jpeg URIs', async () => {
    const noMimeAssetArb = fc.record({
      base64: base64Arb,
      mimeType: fc.constantFrom(null, undefined),
      uri: fc.constant('file:///tmp/img.jpg'),
      width: fc.constant(100),
      height: fc.constant(100),
      type: fc.constant('image' as const),
      fileName: fc.constant('img.jpg'),
      fileSize: fc.constant(1024),
      assetId: fc.constant(null),
      exif: fc.constant(null),
      duration: fc.constant(null),
    }) as fc.Arbitrary<ImagePickerAsset>;

    await fc.assert(
      fc.asyncProperty(
        fc.array(noMimeAssetArb, { minLength: 1, maxLength: 5 }),
        async (assets) => {
          const parts = await assetsToContentParts(assets);
          return parts.every(
            (p) => p.type === 'image_url' && p.image_url.url.startsWith('data:image/jpeg;base64,'),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('assets with explicit mimeType use that type instead', async () => {
    const withMimeAssetArb = fc.record({
      base64: base64Arb,
      mimeType: mimeTypeArb,
      uri: fc.constant('file:///tmp/img.jpg'),
      width: fc.constant(100),
      height: fc.constant(100),
      type: fc.constant('image' as const),
      fileName: fc.constant('img.jpg'),
      fileSize: fc.constant(1024),
      assetId: fc.constant(null),
      exif: fc.constant(null),
      duration: fc.constant(null),
    }) as fc.Arbitrary<ImagePickerAsset>;

    await fc.assert(
      fc.asyncProperty(
        fc.array(withMimeAssetArb, { minLength: 1, maxLength: 5 }),
        async (assets) => {
          const parts = await assetsToContentParts(assets);
          return parts.every((p, i) => {
            if (p.type !== 'image_url') return false;
            const expected = `data:${assets[i].mimeType};base64,`;
            return p.image_url.url.startsWith(expected);
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});
