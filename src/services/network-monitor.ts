import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from '@react-native-community/netinfo';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

export type NetworkStateCallback = (state: NetworkState) => void;

/**
 * Lightweight network connectivity state manager.
 *
 * Subscribes to NetInfo events and maintains the latest connection state.
 * Consumers can subscribe to receive updates when connectivity changes.
 */
class NetworkMonitor {
  private currentState: NetworkState = {
    isConnected: true,
    isInternetReachable: null,
  };

  private listeners: Set<NetworkStateCallback> = new Set();
  private netInfoSubscription: NetInfoSubscription | null = null;

  /**
   * Start listening to network state changes.
   * Safe to call multiple times — only the first call creates a subscription.
   */
  start(): void {
    if (this.netInfoSubscription) return;

    this.netInfoSubscription = NetInfo.addEventListener(
      (state: NetInfoState) => {
        this.currentState = {
          isConnected: state.isConnected ?? false,
          isInternetReachable: state.isInternetReachable,
        };
        this.notifyListeners();
      }
    );
  }

  /**
   * Stop listening to network state changes and clean up.
   */
  stop(): void {
    if (this.netInfoSubscription) {
      this.netInfoSubscription();
      this.netInfoSubscription = null;
    }
  }

  /**
   * Get the current network state snapshot.
   */
  getState(): NetworkState {
    return { ...this.currentState };
  }

  /**
   * Subscribe to network state changes.
   * Returns an unsubscribe function.
   */
  subscribe(callback: NetworkStateCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((cb) => cb(state));
  }
}

/** Singleton network monitor instance */
export const networkMonitor = new NetworkMonitor();
