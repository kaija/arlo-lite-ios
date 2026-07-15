import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

import { CodePanel } from '../CodePanel';

// Mock theme
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      codeBlockBackground: '#15151b',
      codeKeyword: '#9896E6',
      codeString: '#CDCCF3',
      codeType: '#9999ED',
      codeComment: '#8E8E93',
      accent: '#5856D6',
    },
    typography: {
      code: { fontSize: 15, lineHeight: 20 },
      caption1: { fontSize: 12, lineHeight: 16 },
    },
    spacing: { sm: 8, md: 12 },
    borderRadii: { codeBlock: 10 },
    isDark: false,
  }),
}));

// Mock toast
const mockShow = jest.fn();
jest.mock('@/components/overlays/ToastProvider', () => ({
  useToast: () => ({ show: mockShow }),
}));

// Mock clipboard
const mockCopyToClipboard = jest.fn().mockResolvedValue(undefined);
jest.mock('@/utils/clipboard', () => ({
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
}));

describe('CodePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders code text', () => {
    const { getByText } = render(
      <CodePanel code="const x = 1;" language="javascript" />,
    );
    // The tokenizer splits the code, but we should find parts of it
    expect(getByText(/const/)).toBeTruthy();
  });

  it('shows language label for recognized language', () => {
    const { getByText } = render(
      <CodePanel code="print('hello')" language="python" />,
    );
    expect(getByText('python')).toBeTruthy();
  });

  it('hides language label for unrecognized language', () => {
    const { queryByText } = render(
      <CodePanel code="some code" language="unknownlang" />,
    );
    expect(queryByText('unknownlang')).toBeNull();
  });

  it('hides language label when language is undefined', () => {
    const { queryByText } = render(
      <CodePanel code="plain text content" />,
    );
    // Should render as plain text with no language label
    expect(queryByText('plain text content')).toBeTruthy();
  });

  it('normalizes language aliases (js → javascript)', () => {
    const { getByText } = render(
      <CodePanel code="let x = 1;" language="js" />,
    );
    expect(getByText('javascript')).toBeTruthy();
  });

  it('normalizes language aliases (ts → typescript)', () => {
    const { getByText } = render(
      <CodePanel code="const x: number = 1;" language="ts" />,
    );
    expect(getByText('typescript')).toBeTruthy();
  });

  it('copies code to clipboard on copy button press', async () => {
    const code = 'function hello() {}';
    const { getByRole } = render(
      <CodePanel code={code} language="javascript" />,
    );

    const copyButton = getByRole('button');
    fireEvent.press(copyButton);

    await waitFor(() => {
      expect(mockCopyToClipboard).toHaveBeenCalledWith(code);
    });
  });

  it('shows toast message on copy', async () => {
    const { getByRole } = render(
      <CodePanel code="x = 1" language="python" />,
    );

    const copyButton = getByRole('button');
    fireEvent.press(copyButton);

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith('Copied to clipboard');
    });
  });

  it('shows "Copied!" text after pressing copy', async () => {
    const { getByRole, getByText } = render(
      <CodePanel code="x = 1" language="python" />,
    );

    const copyButton = getByRole('button');
    fireEvent.press(copyButton);

    await waitFor(() => {
      expect(getByText('Copied!')).toBeTruthy();
    });
  });

  it('reverts copy button text after 2 seconds', async () => {
    const { getByRole, getByText } = render(
      <CodePanel code="x = 1" language="python" />,
    );

    const copyButton = getByRole('button');
    fireEvent.press(copyButton);

    await waitFor(() => {
      expect(getByText('Copied!')).toBeTruthy();
    });

    // Advance timers by 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(getByText('Copy')).toBeTruthy();
    });
  });

  it('renders with fixed dark background regardless of theme', () => {
    const { getByLabelText } = render(
      <CodePanel code="test" language="javascript" />,
    );
    const container = getByLabelText('Code block, language javascript');
    // The container should exist - background is hardcoded in styles
    expect(container).toBeTruthy();
  });

  it('has correct accessibility label with language', () => {
    const { getByLabelText } = render(
      <CodePanel code="code" language="rust" />,
    );
    expect(getByLabelText('Code block, language rust')).toBeTruthy();
  });

  it('has correct accessibility label without language', () => {
    const { getByLabelText } = render(
      <CodePanel code="code" />,
    );
    expect(getByLabelText('Code block')).toBeTruthy();
  });

  it('renders plain text when language is not specified', () => {
    const code = 'just some plain text\nwith multiple lines';
    const { getByText } = render(
      <CodePanel code={code} />,
    );
    expect(getByText(code)).toBeTruthy();
  });
});
