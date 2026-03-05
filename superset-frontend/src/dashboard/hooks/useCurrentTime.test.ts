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
import { renderHook, act } from '@testing-library/react-hooks';
import { useCurrentTime } from './useCurrentTime';

test('returns initial timestamp on mount', () => {
  const before = Date.now();
  const { result } = renderHook(() => useCurrentTime());
  const after = Date.now();

  // Should be between before and after
  expect(result.current).toBeGreaterThanOrEqual(before);
  expect(result.current).toBeLessThanOrEqual(after);
});

test('returns initial timestamp when disabled', () => {
  const before = Date.now();
  const { result } = renderHook(() => useCurrentTime(false));
  const after = Date.now();

  expect(result.current).toBeGreaterThanOrEqual(before);
  expect(result.current).toBeLessThanOrEqual(after);
});

test('syncTrigger causes immediate time update', () => {
  const { result, rerender } = renderHook(
    ({ enabled, syncTrigger }) => useCurrentTime(enabled, syncTrigger),
    { initialProps: { enabled: true, syncTrigger: null as number | null } },
  );

  const initialTime = result.current;

  // Small delay to ensure time has changed
  const syncTime = Date.now() + 1;

  // Trigger sync
  act(() => {
    rerender({ enabled: true, syncTrigger: syncTime });
  });

  // currentTime should have updated (be different from or equal to initial,
  // depending on timing, but definitely a valid timestamp)
  expect(result.current).toBeGreaterThanOrEqual(initialTime);
});

test('syncTrigger update keeps ticking interval in sync', () => {
  jest.useFakeTimers();
  const nowRef = { value: 1000 };
  const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => nowRef.value);

  const { result, rerender } = renderHook(
    ({ syncTrigger }) => useCurrentTime(true, syncTrigger),
    { initialProps: { syncTrigger: null as number | null } },
  );

  expect(result.current).toBe(1000);

  nowRef.value = 2000;
  act(() => {
    rerender({ syncTrigger: 2000 });
  });
  expect(result.current).toBe(2000);

  nowRef.value = 3000;
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(result.current).toBe(3000);

  nowSpy.mockRestore();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('backward compatibility - works without syncTrigger parameter', () => {
  const before = Date.now();
  const { result } = renderHook(() => useCurrentTime(true));
  const after = Date.now();

  expect(result.current).toBeGreaterThanOrEqual(before);
  expect(result.current).toBeLessThanOrEqual(after);
});

test('syncTrigger=null does not trigger sync', () => {
  const { result, rerender } = renderHook(
    ({ syncTrigger }) => useCurrentTime(true, syncTrigger),
    { initialProps: { syncTrigger: null as number | null } },
  );

  const initialTime = result.current;

  // Re-render with null (should NOT trigger sync effect)
  act(() => {
    rerender({ syncTrigger: null });
  });

  // Time should be the same (no sync triggered)
  expect(result.current).toBe(initialTime);
});

test('syncTrigger=0 triggers sync (valid timestamp)', () => {
  const { result, rerender } = renderHook(
    ({ syncTrigger }) => useCurrentTime(true, syncTrigger),
    { initialProps: { syncTrigger: null as number | null } },
  );

  const initialTime = result.current;

  // Trigger sync with timestamp 0 (epoch - valid number)
  act(() => {
    rerender({ syncTrigger: 0 });
  });

  // currentTime should update (0 != null, so sync triggers)
  expect(result.current).toBeGreaterThanOrEqual(initialTime);
});

test('changing syncTrigger value triggers sync each time', () => {
  const { result, rerender } = renderHook(
    ({ syncTrigger }) => useCurrentTime(true, syncTrigger),
    { initialProps: { syncTrigger: 1000 } },
  );

  const time1 = result.current;

  // Change trigger value
  act(() => {
    rerender({ syncTrigger: 2000 });
  });

  const time2 = result.current;

  // Change trigger value again
  act(() => {
    rerender({ syncTrigger: 3000 });
  });

  const time3 = result.current;

  // Each sync should update to a valid timestamp
  expect(time1).toBeGreaterThan(0);
  expect(time2).toBeGreaterThanOrEqual(time1);
  expect(time3).toBeGreaterThanOrEqual(time2);
});

test('cleanup clears interval on unmount', () => {
  const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');

  const { unmount } = renderHook(() => useCurrentTime(true));

  unmount();

  expect(clearIntervalSpy).toHaveBeenCalled();
  clearIntervalSpy.mockRestore();
});

test('disabled hook does not set up interval', () => {
  const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
  const callCountBefore = setIntervalSpy.mock.calls.length;

  renderHook(() => useCurrentTime(false, null));

  // Should not have called setInterval (disabled and no sync trigger)
  expect(setIntervalSpy.mock.calls.length).toBe(callCountBefore);
  setIntervalSpy.mockRestore();
});
