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
import { useTabVisibility } from './useTabVisibility';

// Helper to mock document.visibilityState
const mockVisibilityState = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
};

// Helper to fire visibilitychange event
const fireVisibilityChange = () => {
  document.dispatchEvent(new Event('visibilitychange'));
};

test('returns initial visibility state as visible', () => {
  mockVisibilityState('visible');
  const { result } = renderHook(() => useTabVisibility());
  expect(result.current.isVisible).toBe(true);
});

test('returns initial visibility state as hidden', () => {
  mockVisibilityState('hidden');
  const { result } = renderHook(() => useTabVisibility());
  expect(result.current.isVisible).toBe(false);
});

test('calls onHidden when tab becomes hidden', () => {
  mockVisibilityState('visible');
  const onHidden = jest.fn();
  const onVisible = jest.fn();

  renderHook(() => useTabVisibility({ onHidden, onVisible }));

  // Simulate tab becoming hidden
  act(() => {
    mockVisibilityState('hidden');
    fireVisibilityChange();
  });

  expect(onHidden).toHaveBeenCalledTimes(1);
  expect(onVisible).not.toHaveBeenCalled();
});

test('calls onVisible when tab becomes visible', () => {
  mockVisibilityState('hidden');
  const onHidden = jest.fn();
  const onVisible = jest.fn();

  renderHook(() => useTabVisibility({ onHidden, onVisible }));

  // Simulate tab becoming visible
  act(() => {
    mockVisibilityState('visible');
    fireVisibilityChange();
  });

  expect(onVisible).toHaveBeenCalledTimes(1);
  expect(onHidden).not.toHaveBeenCalled();
});

test('updates isVisible state when visibility changes', () => {
  mockVisibilityState('visible');
  const { result } = renderHook(() => useTabVisibility());

  expect(result.current.isVisible).toBe(true);

  act(() => {
    mockVisibilityState('hidden');
    fireVisibilityChange();
  });

  expect(result.current.isVisible).toBe(false);

  act(() => {
    mockVisibilityState('visible');
    fireVisibilityChange();
  });

  expect(result.current.isVisible).toBe(true);
});

test('does not add listener when disabled', () => {
  mockVisibilityState('visible');
  const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

  renderHook(() => useTabVisibility({ enabled: false }));

  expect(addEventListenerSpy).not.toHaveBeenCalledWith(
    'visibilitychange',
    expect.any(Function),
  );

  addEventListenerSpy.mockRestore();
});

test('removes listener on unmount', () => {
  mockVisibilityState('visible');
  const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

  const { unmount } = renderHook(() => useTabVisibility());
  unmount();

  expect(removeEventListenerSpy).toHaveBeenCalledWith(
    'visibilitychange',
    expect.any(Function),
  );

  removeEventListenerSpy.mockRestore();
});

test('does not call callbacks on same visibility state', () => {
  mockVisibilityState('visible');
  const onHidden = jest.fn();
  const onVisible = jest.fn();

  renderHook(() => useTabVisibility({ onHidden, onVisible }));

  // Fire event without actually changing visibility
  act(() => {
    fireVisibilityChange();
  });

  // Should not call either callback since state didn't change
  expect(onHidden).not.toHaveBeenCalled();
  expect(onVisible).not.toHaveBeenCalled();
});

test('handles multiple visibility changes', () => {
  mockVisibilityState('visible');
  const onHidden = jest.fn();
  const onVisible = jest.fn();

  renderHook(() => useTabVisibility({ onHidden, onVisible }));

  // Hidden
  act(() => {
    mockVisibilityState('hidden');
    fireVisibilityChange();
  });

  // Visible
  act(() => {
    mockVisibilityState('visible');
    fireVisibilityChange();
  });

  // Hidden again
  act(() => {
    mockVisibilityState('hidden');
    fireVisibilityChange();
  });

  expect(onHidden).toHaveBeenCalledTimes(2);
  expect(onVisible).toHaveBeenCalledTimes(1);
});
