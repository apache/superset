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
import { renderHook } from '@testing-library/react-hooks';
import { useBeforeUnload } from './index';

describe('useBeforeUnload', () => {
  let addEventListenerSpy: jest.SpyInstance;
  let removeEventListenerSpy: jest.SpyInstance;
  let mockHandler: (e: BeforeUnloadEvent) => void;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    jest.restoreAllMocks();

    addEventListenerSpy = jest
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, handler) => {
        if (type === 'beforeunload') {
          mockHandler = handler as (e: BeforeUnloadEvent) => void;
        }
      });
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should add event listener when shouldWarn is true', () => {
    renderHook(() => useBeforeUnload(true));

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );
  });

  test('should not prevent default when shouldWarn is false', () => {
    renderHook(() => useBeforeUnload(false));

    const event = {
      preventDefault: jest.fn(),
      returnValue: undefined as string | undefined,
    } as unknown as BeforeUnloadEvent;

    mockHandler(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.returnValue).toBeUndefined();
  });

  test('should prevent default and set returnValue when shouldWarn is true', () => {
    renderHook(() => useBeforeUnload(true));

    const event = {
      preventDefault: jest.fn(),
      returnValue: undefined as string | undefined,
    } as unknown as BeforeUnloadEvent;

    mockHandler(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe('');
  });

  test('should use custom message when provided', () => {
    const customMessage = 'You have unsaved changes!';
    renderHook(() => useBeforeUnload(true, customMessage));

    const event = {
      preventDefault: jest.fn(),
      returnValue: undefined as string | undefined,
    } as unknown as BeforeUnloadEvent;

    mockHandler(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe(customMessage);
  });

  test('should remove event listener on unmount', () => {
    const { unmount } = renderHook(() => useBeforeUnload(true));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );
  });

  test('should update handler when shouldWarn changes', () => {
    const { rerender } = renderHook(
      ({ shouldWarn }) => useBeforeUnload(shouldWarn),
      {
        initialProps: { shouldWarn: false },
      },
    );

    // Initially, shouldWarn is false
    const event = {
      preventDefault: jest.fn(),
      returnValue: undefined as string | undefined,
    } as unknown as BeforeUnloadEvent;

    mockHandler(event);
    expect(event.preventDefault).not.toHaveBeenCalled();

    // Clear previous calls
    (event.preventDefault as jest.Mock).mockClear();
    event.returnValue = undefined;

    // Clear spy counts before rerender to test properly
    const initialAddCalls = addEventListenerSpy.mock.calls.length;

    // Update to shouldWarn = true
    rerender({ shouldWarn: true });

    // Should remove old listener and add new one
    expect(removeEventListenerSpy).toHaveBeenCalled();
    // Should have added at least one more listener after rerender
    expect(addEventListenerSpy.mock.calls.length).toBeGreaterThan(
      initialAddCalls,
    );

    // Test with new value
    mockHandler(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe('');
  });

  test('should handle multiple instances independently', () => {
    const { unmount: unmount1 } = renderHook(() => useBeforeUnload(true));
    const { unmount: unmount2 } = renderHook(() => useBeforeUnload(false));

    // Check that each hook instance registered a listener
    const beforeunloadCalls = addEventListenerSpy.mock.calls.filter(
      call => call[0] === 'beforeunload',
    );
    expect(beforeunloadCalls.length).toBeGreaterThanOrEqual(2);

    unmount1();
    // Should have at least one removal call
    expect(removeEventListenerSpy).toHaveBeenCalled();

    const removalCount = removeEventListenerSpy.mock.calls.length;
    unmount2();
    // Should have more removal calls after second unmount
    expect(removeEventListenerSpy.mock.calls.length).toBeGreaterThan(
      removalCount,
    );
  });
});
