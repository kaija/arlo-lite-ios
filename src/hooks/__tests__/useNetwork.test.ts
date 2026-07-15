/**
 * Tests for useNetwork hook.
 *
 * Since @testing-library/react-native is not available, we test the hook's
 * underlying logic by verifying the NetworkMonitor integration it depends on.
 * The hook simply subscribes to the networkMonitor singleton and returns its state.
 */
import { networkMonitor } from '@/services/network-monitor';

jest.mock('@react-native-community/netinfo', () => {
  const listeners: Array<(state: any) => void> = [];
  return {
    addEventListener: jest.fn((callback: (state: any) => void) => {
      listeners.push(callback);
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }),
    __listeners: listeners,
    __emit: (state: any) => {
      listeners.forEach((cb) => cb(state));
    },
  };
});

describe('useNetwork (integration with NetworkMonitor)', () => {
  const mockNetInfo = jest.requireMock('@react-native-community/netinfo') as {
    __listeners: Array<(state: any) => void>;
    __emit: (state: any) => void;
    addEventListener: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNetInfo.__listeners.length = 0;
    networkMonitor.stop();
  });

  it('should provide connected state after monitor starts', () => {
    networkMonitor.start();

    mockNetInfo.__emit({
      isConnected: true,
      isInternetReachable: true,
    });

    const state = networkMonitor.getState();
    expect(state.isConnected).toBe(true);
    expect(state.isInternetReachable).toBe(true);
  });

  it('should provide disconnected state when network drops', () => {
    networkMonitor.start();

    mockNetInfo.__emit({
      isConnected: false,
      isInternetReachable: false,
    });

    const state = networkMonitor.getState();
    expect(state.isConnected).toBe(false);
    expect(state.isInternetReachable).toBe(false);
  });

  it('should notify hook-like subscribers on state change', () => {
    networkMonitor.start();

    // Simulate what the hook does: subscribe and track state
    let hookState = networkMonitor.getState();
    const unsubscribe = networkMonitor.subscribe((newState) => {
      hookState = newState;
    });

    mockNetInfo.__emit({
      isConnected: false,
      isInternetReachable: false,
    });

    expect(hookState.isConnected).toBe(false);
    expect(hookState.isInternetReachable).toBe(false);

    // Simulate unmount cleanup
    unsubscribe();

    mockNetInfo.__emit({
      isConnected: true,
      isInternetReachable: true,
    });

    // State should not update after unsubscribe
    expect(hookState.isConnected).toBe(false);
  });

  it('should handle rapid connectivity changes', () => {
    networkMonitor.start();

    const states: Array<{ isConnected: boolean; isInternetReachable: boolean | null }> = [];
    networkMonitor.subscribe((state) => {
      states.push(state);
    });

    mockNetInfo.__emit({ isConnected: true, isInternetReachable: true });
    mockNetInfo.__emit({ isConnected: false, isInternetReachable: false });
    mockNetInfo.__emit({ isConnected: true, isInternetReachable: true });

    expect(states).toHaveLength(3);
    expect(states[0].isConnected).toBe(true);
    expect(states[1].isConnected).toBe(false);
    expect(states[2].isConnected).toBe(true);
  });
});
