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

function setupSpies() {
  jest.clearAllMocks();
  jest.restoreAllMocks();

  const handlers: Array<(e: BeforeUnloadEvent) => void> = [];

  const addEventListenerSpy = jest
    .spyOn(window, 'addEventListener')
    .mockImplementation((type, handler) => {
      if (type === 'beforeunload') {
        handlers.push(handler as (e: BeforeUnloadEvent) => void);
      }
    });

  const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

  const getMockHandler = () => handlers[handlers.length - 1];

  return { addEventListenerSpy, removeEventListenerSpy, getMockHandler };
}

function createMockEvent() {
  return {
    preventDefault: jest.fn(),
    returnValue: undefined as string | undefined,
  } as unknown as BeforeUnloadEvent;
}

test('should add event listener when shouldWarn is true', () => {
  const { addEventListenerSpy } = setupSpies();

  renderHook(() => useBeforeUnload(true));

  expect(addEventListenerSpy).toHaveBeenCalledWith(
    'beforeunload',
    expect.any(Function),
  );

  jest.restoreAllMocks();
});

test('should not prevent default when shouldWarn is false', () => {
  const spies = setupSpies();

  renderHook(() => useBeforeUnload(false));

  const event = createMockEvent();
  const handler = spies.getMockHandler();
  handler(event);

  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(event.returnValue).toBeUndefined();

  jest.restoreAllMocks();
});

test('should prevent default and set returnValue when shouldWarn is true', () => {
  const spies = setupSpies();

  renderHook(() => useBeforeUnload(true));

  const event = createMockEvent();
  const handler = spies.getMockHandler();
  handler(event);

  expect(event.preventDefault).toHaveBeenCalled();
  expect(event.returnValue).toBe('');

  jest.restoreAllMocks();
});

test('should use custom message when provided', () => {
  const customMessage = 'You have unsaved changes!';
  const spies = setupSpies();

  renderHook(() => useBeforeUnload(true, customMessage));

  const event = createMockEvent();
  const handler = spies.getMockHandler();
  handler(event);

  expect(event.preventDefault).toHaveBeenCalled();
  expect(event.returnValue).toBe(customMessage);

  jest.restoreAllMocks();
});

test('should remove event listener on unmount', () => {
  const { removeEventListenerSpy } = setupSpies();

  const { unmount } = renderHook(() => useBeforeUnload(true));

  unmount();

  expect(removeEventListenerSpy).toHaveBeenCalledWith(
    'beforeunload',
    expect.any(Function),
  );

  jest.restoreAllMocks();
});

test('should update handler when shouldWarn changes', () => {
  const spies = setupSpies();

  const { rerender } = renderHook(
    ({ shouldWarn }) => useBeforeUnload(shouldWarn),
    {
      initialProps: { shouldWarn: false },
    },
  );

  const event = createMockEvent();

  const initialHandler = spies.getMockHandler();
  initialHandler(event);
  expect(event.preventDefault).not.toHaveBeenCalled();

  (event.preventDefault as jest.Mock).mockClear();
  event.returnValue = undefined;

  const initialAddCalls = spies.addEventListenerSpy.mock.calls.length;

  rerender({ shouldWarn: true });

  expect(spies.removeEventListenerSpy).toHaveBeenCalled();
  expect(spies.addEventListenerSpy.mock.calls.length).toBeGreaterThan(
    initialAddCalls,
  );

  const newHandler = spies.getMockHandler();
  newHandler(event);
  expect(event.preventDefault).toHaveBeenCalled();
  expect(event.returnValue).toBe('');

  jest.restoreAllMocks();
});

test('should handle multiple instances independently', () => {
  const { addEventListenerSpy, removeEventListenerSpy } = setupSpies();

  const { unmount: unmount1 } = renderHook(() => useBeforeUnload(true));
  const { unmount: unmount2 } = renderHook(() => useBeforeUnload(false));

  const beforeunloadCalls = addEventListenerSpy.mock.calls.filter(
    call => call[0] === 'beforeunload',
  );
  expect(beforeunloadCalls.length).toBeGreaterThanOrEqual(2);

  unmount1();
  expect(removeEventListenerSpy).toHaveBeenCalled();

  const removalCount = removeEventListenerSpy.mock.calls.length;
  unmount2();
  expect(removeEventListenerSpy.mock.calls.length).toBeGreaterThan(
    removalCount,
  );

  jest.restoreAllMocks();
});
