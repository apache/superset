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
const useTruncation = (elementRef: any, plusRef: any) =>
  useChildElementTruncation(
    elementRef as RefObject<HTMLElement>,
    plusRef as RefObject<HTMLElement>,
  );

test('should return [0, false] when elementRef.current is not defined', () => {
  const { result } = renderHook(() =>
    useTruncation({ current: undefined }, { current: undefined }),
  );

  expect(result.current).toEqual([0, false]);
});

test('should not recompute when previousEffectInfo is the same as previous', () => {
  const elementRef = { current: document.createElement('div') };
  const plusRef = { current: document.createElement('div') };
  const { result, rerender } = renderHook(() =>
    useTruncation(elementRef, plusRef),
  );
  const previousEffectInfo = result.current;

  rerender();

  expect(result.current).toEqual(previousEffectInfo);
});

test('should return [0, false] when there are no truncated/hidden elements', () => {
  const [elementRef, plusRef] = genElements(100, 100, 10);
  const { result } = renderHook(() => useTruncation(elementRef, plusRef));
  expect(result.current).toEqual([0, false]);
});

test('should return [1, false] when there is only one truncated element', () => {
  const [elementRef, plusRef] = genElements(150, 100, 10);
  const { result } = renderHook(() => useTruncation(elementRef, plusRef));
  expect(result.current).toEqual([1, false]);
});

test('should return [1, true] with one truncated and hidden elements', () => {
  const [elementRef, plusRef] = genElements(150, 100, 10, [
    { offsetWidth: 150 } as HTMLElement,
    { offsetWidth: 150 } as HTMLElement,
  ]);
  const { result } = renderHook(() => useTruncation(elementRef, plusRef));
  expect(result.current).toEqual([1, true]);
});

test('should return [2, true] with 2 truncated and hidden elements', () => {
  const [elementRef, plusRef] = genElements(150, 100, 10, [
    { offsetWidth: 150 } as HTMLElement,
    { offsetWidth: 150 } as HTMLElement,
    { offsetWidth: 150 } as HTMLElement,
  ]);
  const { result } = renderHook(() => useTruncation(elementRef, plusRef));
  expect(result.current).toEqual([2, true]);
});

test('should return [1, true] with plusSize offsetWidth undefined', () => {
  const [elementRef, plusRef] = genElements(150, 100, undefined, [
    { offsetWidth: 150 } as HTMLElement,
    { offsetWidth: 150 } as HTMLElement,
  ]);
  const { result } = renderHook(() => useTruncation(elementRef, plusRef));
  expect(result.current).toEqual([1, true]);
});
