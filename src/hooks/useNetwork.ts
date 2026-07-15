import { useState, useEffect } from 'react';
import { networkMonitor, NetworkState } from '@/services/network-monitor';

export interface UseNetworkResult {
  /** Whether the device has an active network connection */
  isConnected: boolean;
  /** Whether internet is reachable (null if unknown/undetermined) */
  isInternetReachable: boolean | null;
}

/**
 * Custom hook that provides current network connectivity state.
 *
 * Subscribes to the singleton NetworkMonitor on mount and unsubscribes on unmount.
 * Returns reactive state that updates when connectivity changes.
 */
export function useNetwork(): UseNetworkResult {
  const [state, setState] = useState<NetworkState>(networkMonitor.getState());

  useEffect(() => {
    // Start the network monitor if not already running
    networkMonitor.start();

    // Subscribe to state changes
    const unsubscribe = networkMonitor.subscribe((newState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    isConnected: state.isConnected,
    isInternetReachable: state.isInternetReachable,
  };
}
