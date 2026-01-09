/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { SupersetClient } from '@superset-ui/core';

export type PollingStatus = 'idle' | 'polling' | 'completed' | 'error';

export interface UsePollingOptions<T> {
  endpoint: string;
  interval?: number;
  enabled?: boolean;
  isComplete?: (data: T) => boolean;
  isError?: (data: T) => boolean;
  onComplete?: (data: T) => void;
  onError?: (error: Error | T) => void;
}

export interface UsePollingResult<T> {
  data: T | null;
  isPolling: boolean;
  error: Error | null;
  status: PollingStatus;
  startPolling: () => void;
  stopPolling: () => void;
}

const DEFAULT_INTERVAL = 2000;

export function usePolling<T>({
  endpoint,
  interval = DEFAULT_INTERVAL,
  enabled = true,
  isComplete = () => false,
  isError = () => false,
  onComplete,
  onError,
}: UsePollingOptions<T>): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<PollingStatus>('idle');

  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const hasStartedRef = useRef(false);
  const savedCallbacksRef = useRef({
    onComplete,
    onError,
    isComplete,
    isError,
  });

  // Keep callbacks up to date
  useEffect(() => {
    savedCallbacksRef.current = { onComplete, onError, isComplete, isError };
  }, [onComplete, onError, isComplete, isError]);

  const stopPolling = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const response = await SupersetClient.get({ endpoint });
      const responseData = response.json?.result as T;

      if (!mountedRef.current) return;

      setData(responseData);

      // Check for error state in response
      if (savedCallbacksRef.current.isError(responseData)) {
        setStatus('error');
        stopPolling();
        savedCallbacksRef.current.onError?.(responseData);
        return;
      }

      // Check for completion
      if (savedCallbacksRef.current.isComplete(responseData)) {
        setStatus('completed');
        stopPolling();
        savedCallbacksRef.current.onComplete?.(responseData);
      }
    } catch (err) {
      if (!mountedRef.current) return;

      const pollingError = err instanceof Error ? err : new Error(String(err));
      setError(pollingError);
      setStatus('error');
      stopPolling();
      savedCallbacksRef.current.onError?.(pollingError);
    }
  }, [endpoint, stopPolling]);

  const startPolling = useCallback(() => {
    if (intervalIdRef.current) {
      stopPolling();
    }

    setStatus('polling');
    setError(null);

    // Initial poll
    poll();

    // Set up interval
    intervalIdRef.current = setInterval(poll, interval);
  }, [poll, interval, stopPolling]);

  // Auto-start polling when enabled changes to true
  useEffect(() => {
    if (enabled && !hasStartedRef.current) {
      hasStartedRef.current = true;
      // Use setTimeout to avoid calling setState synchronously in the effect
      setTimeout(() => {
        if (mountedRef.current) {
          startPolling();
        }
      }, 0);
    }
  }, [enabled, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  return {
    data,
    isPolling: status === 'polling',
    error,
    status,
    startPolling,
    stopPolling,
  };
}

export default usePolling;
