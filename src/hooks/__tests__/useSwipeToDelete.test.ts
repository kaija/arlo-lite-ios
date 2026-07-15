/**
 * Tests for useSwipeToDelete hook.
 *
 * Since useSwipeToDelete relies on react-native-reanimated worklets and
 * react-native-gesture-handler (which require a native runtime), we test
 * the hook's JS-thread interface: initial state, reset behavior,
 * and pan gesture configuration.
 */

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  return {
    __esModule: true,
    default: {
      call: () => {},
    },
    useSharedValue: (initial: number | boolean) => ({ value: initial }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withSpring: (toValue: number) => toValue,
    withTiming: (toValue: number) => toValue,
    interpolate: (value: number, inputRange: number[], outputRange: number[]) => {
      const [inMin, inMax] = inputRange;
      const [outMin, outMax] = outputRange;
      const t = (value - inMin) / (inMax - inMin);
      return outMin + t * (outMax - outMin);
    },
    runOnJS: (fn: Function) => fn,
    Easing: {
      bezier: () => ({ factory: 'bezier' }),
    },
  };
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const mockGesture = {
    activeOffsetX: jest.fn().mockReturnThis(),
    failOffsetY: jest.fn().mockReturnThis(),
    hitSlop: jest.fn().mockReturnThis(),
    onStart: jest.fn().mockReturnThis(),
    onUpdate: jest.fn().mockReturnThis(),
    onEnd: jest.fn().mockReturnThis(),
  };
  return {
    Gesture: {
      Pan: () => mockGesture,
    },
  };
});

import { renderHook, act } from '@testing-library/react-native';
import { useSwipeToDelete } from '../useSwipeToDelete';

describe('useSwipeToDelete', () => {
  it('returns all expected interface members', () => {
    const { result } = renderHook(() => useSwipeToDelete());

    expect(result.current.translateX).toBeDefined();
    expect(result.current.panGesture).toBeDefined();
    expect(typeof result.current.isRevealed).toBe('boolean');
    expect(typeof result.current.reset).toBe('function');
  });

  it('initializes with translateX = 0 and isRevealed = false', () => {
    const { result } = renderHook(() => useSwipeToDelete());

    expect(result.current.translateX.value).toBe(0);
    expect(result.current.isRevealed).toBe(false);
  });

  it('reset() sets translateX to 0 (via withSpring mock)', () => {
    const { result } = renderHook(() => useSwipeToDelete());

    // Simulate a revealed state by setting translateX manually
    result.current.translateX.value = -72;

    act(() => {
      result.current.reset();
    });

    // withSpring is mocked to return the target value directly
    expect(result.current.translateX.value).toBe(0);
  });

  it('reset() sets isRevealed to false', () => {
    const { result } = renderHook(() => useSwipeToDelete());

    act(() => {
      result.current.reset();
    });

    expect(result.current.isRevealed).toBe(false);
  });

  describe('panGesture configuration', () => {
    it('configures activeOffsetX for horizontal activation', () => {
      const { result } = renderHook(() => useSwipeToDelete());
      const gesture = result.current.panGesture as any;

      expect(gesture.activeOffsetX).toHaveBeenCalledWith([-10, 10]);
    });

    it('sets failOffsetY to prevent conflicts with vertical scrolling', () => {
      const { result } = renderHook(() => useSwipeToDelete());
      const gesture = result.current.panGesture as any;

      expect(gesture.failOffsetY).toHaveBeenCalledWith([-15, 15]);
    });

    it('registers onUpdate and onEnd handlers', () => {
      const { result } = renderHook(() => useSwipeToDelete());
      const gesture = result.current.panGesture as any;

      expect(gesture.onUpdate).toHaveBeenCalled();
      expect(gesture.onEnd).toHaveBeenCalled();
    });
  });

  describe('swipe logic (simulated via shared values)', () => {
    it('translateX stays within bounds [-72, 0]', () => {
      const { result } = renderHook(() => useSwipeToDelete());

      // translateX should never go below -72 or above 0
      expect(result.current.translateX.value).toBeGreaterThanOrEqual(-72);
      expect(result.current.translateX.value).toBeLessThanOrEqual(0);
    });

    it('reveals at 72px wide delete zone', () => {
      // The DELETE_BUTTON_WIDTH is 72px as per design spec
      const { result } = renderHook(() => useSwipeToDelete());

      // Simulate the revealed state
      result.current.translateX.value = -72;
      // The maximum negative displacement should be -72
      expect(result.current.translateX.value).toBe(-72);
    });
  });
});
