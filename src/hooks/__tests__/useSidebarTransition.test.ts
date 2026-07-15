/**
 * Tests for useSidebarTransition hook.
 *
 * Since useSidebarTransition relies heavily on react-native-reanimated worklets
 * and react-native-gesture-handler (which require a native runtime), we test
 * the hook's JS-thread interface: open/close/toggle behavior, initial state,
 * and the animated style computations at known progress values.
 */

// Mock react-native-reanimated (must be before any imports that use it)
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

// Mock react-native Dimensions
jest.mock('react-native', () => ({
  Dimensions: {
    get: () => ({ width: 390, height: 844 }),
  },
}));

import { renderHook, act } from '@testing-library/react-native';
import { useSidebarTransition } from '../useSidebarTransition';

describe('useSidebarTransition', () => {
  it('returns all expected interface members', () => {
    const { result } = renderHook(() => useSidebarTransition());

    expect(result.current.progress).toBeDefined();
    expect(result.current.isOpen).toBeDefined();
    expect(result.current.chatAnimatedStyle).toBeDefined();
    expect(result.current.sidebarAnimatedStyle).toBeDefined();
    expect(result.current.panGesture).toBeDefined();
    expect(typeof result.current.open).toBe('function');
    expect(typeof result.current.close).toBe('function');
    expect(typeof result.current.toggle).toBe('function');
  });

  it('initializes with progress = 0 and isOpen = false', () => {
    const { result } = renderHook(() => useSidebarTransition());

    expect(result.current.progress.value).toBe(0);
    expect(result.current.isOpen.value).toBe(false);
  });

  it('open() sets progress to 1 and isOpen to true', () => {
    const { result } = renderHook(() => useSidebarTransition());

    act(() => {
      result.current.open();
    });

    expect(result.current.progress.value).toBe(1);
    expect(result.current.isOpen.value).toBe(true);
  });

  it('close() sets progress to 0 and isOpen to false', () => {
    const { result } = renderHook(() => useSidebarTransition());

    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.close();
    });

    expect(result.current.progress.value).toBe(0);
    expect(result.current.isOpen.value).toBe(false);
  });

  it('toggle() opens when closed', () => {
    const { result } = renderHook(() => useSidebarTransition());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.progress.value).toBe(1);
    expect(result.current.isOpen.value).toBe(true);
  });

  it('toggle() closes when open', () => {
    const { result } = renderHook(() => useSidebarTransition());

    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.toggle();
    });

    expect(result.current.progress.value).toBe(0);
    expect(result.current.isOpen.value).toBe(false);
  });

  describe('chatAnimatedStyle at progress = 0 (closed)', () => {
    it('has zero rotation, translation, borderRadius, and shadowOpacity', () => {
      const { result } = renderHook(() => useSidebarTransition());

      const style = result.current.chatAnimatedStyle;
      expect(style.borderRadius).toBe(0);
      expect(style.shadowOpacity).toBe(0);
      // transform at progress = 0 should have rotateY: "0deg" and translateX: 0
      const transforms = style.transform as any[];
      const rotateY = transforms.find((t: any) => 'rotateY' in t);
      const translateX = transforms.find((t: any) => 'translateX' in t);
      expect(rotateY?.rotateY).toBe('0deg');
      expect(translateX?.translateX).toBe(0);
    });
  });

  describe('sidebarAnimatedStyle at progress = 0 (closed)', () => {
    it('has initial offset, scale, and opacity values', () => {
      const { result } = renderHook(() => useSidebarTransition());

      const style = result.current.sidebarAnimatedStyle;
      expect(style.opacity).toBe(0.3);
      const transforms = style.transform as any[];
      const translateX = transforms.find((t: any) => 'translateX' in t);
      const scale = transforms.find((t: any) => 'scale' in t);
      expect(translateX?.translateX).toBe(-42);
      expect(scale?.scale).toBe(0.94);
    });
  });

  describe('panGesture configuration', () => {
    it('configures edge zone hit slop of 24px', () => {
      const { result } = renderHook(() => useSidebarTransition());
      const gesture = result.current.panGesture as any;

      // Verify hitSlop was called with the edge zone config
      expect(gesture.hitSlop).toHaveBeenCalledWith({ left: 0, width: 24 });
    });

    it('sets activeOffsetX to 10 to avoid false starts', () => {
      const { result } = renderHook(() => useSidebarTransition());
      const gesture = result.current.panGesture as any;

      expect(gesture.activeOffsetX).toHaveBeenCalledWith(10);
    });

    it('sets failOffsetY to prevent conflicts with vertical scrolling', () => {
      const { result } = renderHook(() => useSidebarTransition());
      const gesture = result.current.panGesture as any;

      expect(gesture.failOffsetY).toHaveBeenCalledWith([-20, 20]);
    });
  });
});
