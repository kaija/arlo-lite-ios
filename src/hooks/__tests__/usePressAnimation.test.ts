/**
 * Tests for usePressAnimation hook.
 *
 * Since usePressAnimation relies on react-native-reanimated worklets,
 * we test the hook's JS-thread interface: initial state, press-in behavior,
 * and press-out revert behavior using mocked shared values.
 *
 * The mock useAnimatedStyle stores the style function so we can evaluate it
 * after shared values have been mutated, simulating how reanimated evaluates
 * styles on the UI thread in response to value changes.
 */

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  return {
    __esModule: true,
    default: {
      call: () => {},
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (fn: () => any) => {
      // Return a proxy that evaluates the style function on access
      // This simulates reanimated re-evaluating the style when values change
      return new Proxy(
        {},
        {
          get(_target, prop) {
            const style = fn();
            return (style as any)[prop];
          },
          ownKeys() {
            return Object.keys(fn());
          },
          getOwnPropertyDescriptor(_target, prop) {
            const style = fn();
            if (prop in style) {
              return { configurable: true, enumerable: true, value: (style as any)[prop] };
            }
            return undefined;
          },
        }
      );
    },
    withSpring: (toValue: number) => toValue,
  };
});

import { renderHook, act } from '@testing-library/react-native';
import { usePressAnimation } from '../usePressAnimation';

describe('usePressAnimation', () => {
  it('returns all expected interface members', () => {
    const { result } = renderHook(() => usePressAnimation());

    expect(result.current.animatedStyle).toBeDefined();
    expect(typeof result.current.onPressIn).toBe('function');
    expect(typeof result.current.onPressOut).toBe('function');
  });

  it('initializes with scale 1.0 and opacity 1.0', () => {
    const { result } = renderHook(() => usePressAnimation());

    const style = result.current.animatedStyle;
    const transforms = style.transform as any[];
    const scale = transforms.find((t: any) => 'scale' in t);

    expect(scale?.scale).toBe(1);
    expect(style.opacity).toBe(1);
  });

  it('onPressIn sets scale to 0.97 and opacity to 0.82', () => {
    const { result } = renderHook(() => usePressAnimation());

    act(() => {
      result.current.onPressIn();
    });

    const style = result.current.animatedStyle;
    const transforms = style.transform as any[];
    const scale = transforms.find((t: any) => 'scale' in t);

    expect(scale?.scale).toBe(0.97);
    expect(style.opacity).toBe(0.82);
  });

  it('onPressOut reverts scale to 1.0 and opacity to 1.0', () => {
    const { result } = renderHook(() => usePressAnimation());

    act(() => {
      result.current.onPressIn();
    });
    act(() => {
      result.current.onPressOut();
    });

    const style = result.current.animatedStyle;
    const transforms = style.transform as any[];
    const scale = transforms.find((t: any) => 'scale' in t);

    expect(scale?.scale).toBe(1);
    expect(style.opacity).toBe(1);
  });

  it('can be called multiple times without error', () => {
    const { result } = renderHook(() => usePressAnimation());

    act(() => {
      result.current.onPressIn();
    });
    act(() => {
      result.current.onPressOut();
    });
    act(() => {
      result.current.onPressIn();
    });
    act(() => {
      result.current.onPressOut();
    });

    const style = result.current.animatedStyle;
    const transforms = style.transform as any[];
    const scale = transforms.find((t: any) => 'scale' in t);

    expect(scale?.scale).toBe(1);
    expect(style.opacity).toBe(1);
  });

  it('onPressOut without prior onPressIn stays at identity', () => {
    const { result } = renderHook(() => usePressAnimation());

    act(() => {
      result.current.onPressOut();
    });

    const style = result.current.animatedStyle;
    const transforms = style.transform as any[];
    const scale = transforms.find((t: any) => 'scale' in t);

    expect(scale?.scale).toBe(1);
    expect(style.opacity).toBe(1);
  });
});
