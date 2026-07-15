import NetInfo from '@react-native-community/netinfo';
import { networkMonitor } from '../network-monitor';

jest.mock('@react-native-community/netinfo', () => {
  const listeners: Array<(state: any) => void> = [];
  return {
    addEventListener: jest.fn((callback: (state: any) => void) => {
      listeners.push(callback);
      // Return unsubscribe function
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }),
    // Helper to simulate state change in tests
    __listeners: listeners,
    __emit: (state: any) => {
      listeners.forEach((cb) => cb(state));
    },
  };
});

describe('NetworkMonitor', () => {
  const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo> & {
    __listeners: Array<(state: any) => void>;
    __emit: (state: any) => void;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNetInfo.__listeners.length = 0;
    // Stop and reset the singleton
    networkMonitor.stop();
  });

  it('should start listening to NetInfo events', () => {
    networkMonitor.start();

    expect(mockNetInfo.addEventListener).toHaveBeenCalledTimes(1);
    expect(mockNetInfo.addEventListener).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });

  it('should not create duplicate subscriptions on multiple start calls', () => {
    networkMonitor.start();
    networkMonitor.start();
    networkMonitor.start();

    expect(mockNetInfo.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('should return initial state as connected with unknown reachability', () => {
    const state = networkMonitor.getState();

    expect(state.isConnected).toBe(true);
    expect(state.isInternetReachable).toBeNull();
  });

  it('should update state when NetInfo emits a change', () => {
    networkMonitor.start();

    mockNetInfo.__emit({
      isConnected: false,
      isInternetReachable: false,
    });

    const state = networkMonitor.getState();
    expect(state.isConnected).toBe(false);
    expect(state.isInternetReachable).toBe(false);
  });

  it('should notify subscribers when state changes', () => {
    networkMonitor.start();
    const callback = jest.fn();

    networkMonitor.subscribe(callback);

    mockNetInfo.__emit({
      isConnected: true,
      isInternetReachable: true,
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  it('should allow unsubscribing from updates', () => {
    networkMonitor.start();
    const callback = jest.fn();

    const unsubscribe = networkMonitor.subscribe(callback);
    unsubscribe();

    mockNetInfo.__emit({
      isConnected: false,
      isInternetReachable: false,
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle null isConnected by defaulting to false', () => {
    networkMonitor.start();

    mockNetInfo.__emit({
      isConnected: null,
      isInternetReachable: null,
    });

    const state = networkMonitor.getState();
    expect(state.isConnected).toBe(false);
    expect(state.isInternetReachable).toBeNull();
  });

  it('should stop the subscription and clean up', () => {
    networkMonitor.start();
    networkMonitor.stop();

    // The listener should have been removed
    expect(mockNetInfo.__listeners.length).toBe(0);
  });

  it('should notify multiple subscribers', () => {
    networkMonitor.start();
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    networkMonitor.subscribe(cb1);
    networkMonitor.subscribe(cb2);

    mockNetInfo.__emit({
      isConnected: true,
      isInternetReachable: true,
    });

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('should return a copy of state (not a reference)', () => {
    networkMonitor.start();

    mockNetInfo.__emit({
      isConnected: true,
      isInternetReachable: true,
    });

    const state1 = networkMonitor.getState();
    const state2 = networkMonitor.getState();

    expect(state1).toEqual(state2);
    expect(state1).not.toBe(state2); // Different object references
  });
});
