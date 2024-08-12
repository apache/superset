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
import { RefObject } from 'react';
import useChildElementTruncation from './useChildElementTruncation';

let observeMock: jest.Mock;
let disconnectMock: jest.Mock;
let originalResizeObserver: typeof ResizeObserver;

const genElements = (
  scrollWidth: number,
  clientWidth: number,
  offsetWidth: number | undefined,
  childNodes: any = [],
) => {
  const elementRef: RefObject<Partial<HTMLElement>> = {
    current: { scrollWidth, clientWidth, childNodes },
  };
  const plusRef: RefObject<Partial<HTMLElement>> = {
    current: { offsetWidth },
  };
  return [elementRef, plusRef];
};

const testTruncationHookWithInitialValues = (
  [scrollWidth, clientWidth, offsetWidth, childNodes = []]: [
    number,
    number,
    number | undefined,
    any?,
  ],
  expectedElementsTruncated: number,
  shouldHaveHiddenElements: boolean,
) => {
  const [elementRef, plusRef] = genElements(
    scrollWidth,
    clientWidth,
    offsetWidth,
    childNodes,
  );
  const { result, rerender } = renderHook(() => useChildElementTruncation());

  Object.defineProperty(result.current[0], 'current', {
    value: elementRef.current,
  });
  Object.defineProperty(result.current[1], 'current', {
    value: plusRef.current,
  });

  rerender();

  expect(result.current).toEqual([
    elementRef,
    plusRef,
    expectedElementsTruncated,
    shouldHaveHiddenElements,
  ]);
};

beforeAll(() => {
  // Store the original ResizeObserver
  originalResizeObserver = window.ResizeObserver;

  // Mock ResizeObserver
  observeMock = jest.fn();
  disconnectMock = jest.fn();
  window.ResizeObserver = jest.fn(() => ({
    observe: observeMock,
    disconnect: disconnectMock,
  })) as unknown as typeof ResizeObserver;
});

afterAll(() => {
  // Restore original ResizeObserver after all tests are done
  window.ResizeObserver = originalResizeObserver;
});

afterEach(() => {
  observeMock.mockClear();
  disconnectMock.mockClear();
});

test('should return [0, false] when elementRef.current is not defined', () => {
  const { result } = renderHook(() => useChildElementTruncation());
  expect(result.current).toEqual([
    { current: null },
    { current: null },
    0,
    false,
  ]);

  expect(observeMock).not.toHaveBeenCalled();
});

test('should not recompute when previousEffectInfo is the same as previous', () => {
  const { result, rerender } = renderHook(() => useChildElementTruncation());

  Object.defineProperty(result.current[0], 'current', {
    value: document.createElement('div'),
  });
  Object.defineProperty(result.current[1], 'current', {
    value: document.createElement('div'),
  });

  const previousEffectInfo = result.current;

  rerender();

  expect(result.current).toEqual(previousEffectInfo);
});

test('should return [0, false] when there are no truncated/hidden elements', () => {
  testTruncationHookWithInitialValues([100, 100, 10], 0, false);
});

test('should return [1, false] when there is only one truncated element', () => {
  testTruncationHookWithInitialValues([150, 100, 10], 1, false);
});

test('should return [1, true] with one truncated and hidden elements', () => {
  testTruncationHookWithInitialValues(
    [
      150,
      100,
      10,
      [
        { offsetWidth: 150 } as HTMLElement,
        { offsetWidth: 150 } as HTMLElement,
      ],
    ],
    1,
    true,
  );
});

test('should return [2, true] with 2 truncated and hidden elements', () => {
  testTruncationHookWithInitialValues(
    [
      150,
      100,
      10,
      [
        { offsetWidth: 150 } as HTMLElement,
        { offsetWidth: 150 } as HTMLElement,
        { offsetWidth: 150 } as HTMLElement,
      ],
    ],
    2,
    true,
  );
});

test('should return [1, true] with plusSize offsetWidth undefined', () => {
  testTruncationHookWithInitialValues(
    [
      150,
      100,
      undefined,
      [
        { offsetWidth: 150 } as HTMLElement,
        { offsetWidth: 150 } as HTMLElement,
      ],
    ],
    1,
    true,
  );
});

test('should call ResizeObserver.observe on element parent', () => {
  const elementRef = { current: document.createElement('div') };
  Object.defineProperty(elementRef.current, 'parentElement', {
    value: document.createElement('div'),
  });
  const plusRef = { current: document.createElement('div') };
  const { result, rerender } = renderHook(() => useChildElementTruncation());

  Object.defineProperty(result.current[0], 'current', {
    value: elementRef.current,
  });
  Object.defineProperty(result.current[1], 'current', {
    value: plusRef.current,
  });

  rerender();

  expect(observeMock).toHaveBeenCalled();
  expect(observeMock).toHaveBeenCalledWith(elementRef.current.parentElement);
});

test('should not call ResizeObserver.observe if element parent is undefined', () => {
  const elementRef = { current: document.createElement('div') };
  const plusRef = { current: document.createElement('div') };
  const { result, rerender } = renderHook(() => useChildElementTruncation());

  Object.defineProperty(result.current[0], 'current', {
    value: elementRef.current,
  });
  Object.defineProperty(result.current[1], 'current', {
    value: plusRef.current,
  });

  rerender();

  expect(observeMock).not.toHaveBeenCalled();
});
