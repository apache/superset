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
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook that provides the current time, updating every second.
 *
 * @param enabled - Whether the timer should be running
 * @param syncTrigger - When this value changes, the timer restarts in phase
 *                      with the new value. This ensures the display timer is
 *                      synchronized with refresh cycles.
 * @returns The current timestamp in milliseconds
 */
export const useCurrentTime = (
  enabled = true,
  syncTrigger?: number | null,
): number => {
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearExistingInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // When syncTrigger changes (refresh completes), restart the interval
  // This keeps the display timer aligned with the refresh cycle
  useEffect(() => {
    if (!enabled) {
      clearExistingInterval();
      return undefined;
    }

    if (syncTrigger != null) {
      setCurrentTime(Date.now());
    }

    clearExistingInterval();
    intervalRef.current = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return clearExistingInterval;
  }, [enabled, syncTrigger, clearExistingInterval]);

  return currentTime;
};

export default useCurrentTime;
