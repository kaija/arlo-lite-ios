/**
 * useStreamingMetrics — Tracks streaming token arrival and computes rate metrics.
 *
 * Provides:
 * - `tokenRate`: Rolling 2-second window average tokens/second, updated every 500ms
 * - `isStalled`: True when 0 tok/s for > 3 seconds
 * - `totalInputTokens` / `totalOutputTokens`: Cumulative counts for the current stream
 * - `recordToken()`: Call when a new token arrives to record its timestamp
 * - `reset()`: Clears all metrics for a new stream
 *
 * Internally uses a setInterval (500ms) to recompute the rolling window rate.
 * Token timestamps are stored in a ref to avoid render churn on each token arrival.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

/** Duration of the rolling window in milliseconds */
const WINDOW_DURATION_MS = 2000;

/** Interval at which the token rate is recalculated (ms) */
const RECALC_INTERVAL_MS = 500;

/** Duration of zero tokens/second before the stream is considered stalled (ms) */
const STALL_THRESHOLD_MS = 3000;

export interface StreamingMetricsResult {
  /** Rolling 2s window average tokens per second, updated every 500ms */
  tokenRate: number;
  /** True when 0 tok/s for > 3s */
  isStalled: boolean;
  /** Cumulative input token count for the current stream */
  totalInputTokens: number;
  /** Cumulative output token count for the current stream */
  totalOutputTokens: number;
  /** Record a new output token arrival (call once per token) */
  recordToken: () => void;
  /** Set the total input token count (typically from the final response metadata) */
  setInputTokens: (count: number) => void;
  /** Reset all metrics for a new stream */
  reset: () => void;
}

/**
 * Hook for tracking streaming token metrics.
 *
 * Usage:
 * ```
 * const metrics = useStreamingMetrics();
 * // Call metrics.recordToken() each time a new token arrives during streaming
 * // Call metrics.reset() when starting a new stream
 * ```
 */
export function useStreamingMetrics(): StreamingMetricsResult {
  const [tokenRate, setTokenRate] = useState(0);
  const [isStalled, setIsStalled] = useState(false);
  const [totalInputTokens, setTotalInputTokens] = useState(0);
  const [totalOutputTokens, setTotalOutputTokens] = useState(0);

  /** Timestamps (ms) of each token arrival in the current stream */
  const timestampsRef = useRef<number[]>([]);

  /** Timestamp of the last non-zero token rate, used for stall detection */
  const lastNonZeroRef = useRef<number>(Date.now());

  /** Whether the metrics system is actively tracking (has received at least one token) */
  const isActiveRef = useRef(false);

  /**
   * Record a new output token arrival.
   * Pushes the current timestamp into the array and increments the output count.
   */
  const recordToken = useCallback(() => {
    const now = Date.now();
    timestampsRef.current.push(now);
    isActiveRef.current = true;
    setTotalOutputTokens((prev) => prev + 1);
  }, []);

  /**
   * Set the total input token count (e.g. from usage metadata in the final response).
   */
  const setInputTokens = useCallback((count: number) => {
    setTotalInputTokens(count);
  }, []);

  /**
   * Reset all metrics for a new stream.
   */
  const reset = useCallback(() => {
    timestampsRef.current = [];
    lastNonZeroRef.current = Date.now();
    isActiveRef.current = false;
    setTokenRate(0);
    setIsStalled(false);
    setTotalInputTokens(0);
    setTotalOutputTokens(0);
  }, []);

  /**
   * Recalculate token rate every 500ms using a rolling 2-second window.
   * Also checks for stall condition (0 tok/s for > 3s).
   */
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isActiveRef.current) {
        return;
      }

      const now = Date.now();
      const windowStart = now - WINDOW_DURATION_MS;

      // Count tokens within the rolling 2s window
      const timestamps = timestampsRef.current;
      const tokensInWindow = timestamps.filter((t) => t >= windowStart).length;

      // Rate = tokens in window / window duration in seconds
      const rate = tokensInWindow / (WINDOW_DURATION_MS / 1000);

      setTokenRate(rate);

      // Stall detection
      if (rate > 0) {
        lastNonZeroRef.current = now;
        setIsStalled(false);
      } else {
        const stallDuration = now - lastNonZeroRef.current;
        setIsStalled(stallDuration > STALL_THRESHOLD_MS);
      }

      // Prune old timestamps beyond the window to prevent unbounded growth
      const pruneThreshold = now - WINDOW_DURATION_MS;
      const firstValidIndex = timestamps.findIndex((t) => t >= pruneThreshold);
      if (firstValidIndex > 0) {
        timestampsRef.current = timestamps.slice(firstValidIndex);
      }
    }, RECALC_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return {
    tokenRate,
    isStalled,
    totalInputTokens,
    totalOutputTokens,
    recordToken,
    setInputTokens,
    reset,
  };
}
