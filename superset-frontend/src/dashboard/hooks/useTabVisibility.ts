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
import { useEffect, useRef, useCallback, useState } from 'react';

export interface UseTabVisibilityOptions {
  /** Callback when tab becomes visible */
  onVisible?: () => void;
  /** Callback when tab becomes hidden */
  onHidden?: () => void;
  /** Whether the hook is enabled */
  enabled?: boolean;
}

export interface UseTabVisibilityResult {
  /** Whether the tab is visible */
  isVisible: boolean;
}

/**
 * Hook to track browser tab visibility state.
 * Uses the Page Visibility API to detect when the user switches tabs.
 *
 * @example
 * ```tsx
 * const { isVisible } = useTabVisibility({
 *   onVisible: () => console.log('Tab is visible'),
 *   onHidden: () => console.log('Tab is hidden'),
 * });
 * ```
 */
export function useTabVisibility({
  onVisible,
  onHidden,
  enabled = true,
}: UseTabVisibilityOptions = {}): UseTabVisibilityResult {
  const [isVisible, setIsVisible] = useState(
    () => document.visibilityState === 'visible',
  );

  // Track previous visibility state to detect transitions
  const previousVisibilityRef = useRef(document.visibilityState);

  const handleVisibilityChange = useCallback(() => {
    const currentVisibility = document.visibilityState;
    const previousVisibility = previousVisibilityRef.current;

    // Update state
    const nowVisible = currentVisibility === 'visible';
    setIsVisible(nowVisible);

    // Detect transition from hidden to visible
    if (previousVisibility === 'hidden' && currentVisibility === 'visible') {
      onVisible?.();
    }
    // Detect transition from visible to hidden
    else if (
      previousVisibility === 'visible' &&
      currentVisibility === 'hidden'
    ) {
      onHidden?.();
    }

    // Update previous state
    previousVisibilityRef.current = currentVisibility;
  }, [onVisible, onHidden]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, handleVisibilityChange]);

  return {
    isVisible,
  };
}

export default useTabVisibility;
