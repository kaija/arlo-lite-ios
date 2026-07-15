import { copyToClipboard, getFromClipboard } from '../clipboard';
import * as ExpoClipboard from 'expo-clipboard';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
  getStringAsync: jest.fn().mockResolvedValue('clipboard content'),
}));

describe('clipboard utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('copyToClipboard', () => {
    it('calls expo-clipboard setStringAsync with the provided text', async () => {
      await copyToClipboard('Hello, World!');
      expect(ExpoClipboard.setStringAsync).toHaveBeenCalledWith('Hello, World!');
    });

    it('handles empty strings', async () => {
      await copyToClipboard('');
      expect(ExpoClipboard.setStringAsync).toHaveBeenCalledWith('');
    });
  });

  describe('getFromClipboard', () => {
    it('returns the clipboard content from expo-clipboard', async () => {
      const result = await getFromClipboard();
      expect(result).toBe('clipboard content');
      expect(ExpoClipboard.getStringAsync).toHaveBeenCalled();
    });
  });
});
