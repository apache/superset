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
import React from 'react';
import { useElementOnScreen } from './useElementOnScreen';

const observeMock = jest.fn();
const unobserveMock = jest.fn();
const IntersectionObserverMock = jest.fn();
IntersectionObserverMock.prototype.observe = observeMock;
IntersectionObserverMock.prototype.unobserve = unobserveMock;

beforeEach(() => {
  window.IntersectionObserver = IntersectionObserverMock;
});

afterEach(() => {
  IntersectionObserverMock.mockClear();
  jest.clearAllMocks();
});

test('should return null and false on first render', () => {
  const hook = renderHook(() =>
    useElementOnScreen({ rootMargin: '-50px 0px 0px 0px' }),
  );
  expect(hook.result.current).toEqual([{ current: null }, false]);
});

test('should return isSticky as true when intersectionRatio < 1', async () => {
  const hook = renderHook(() =>
    useElementOnScreen({ rootMargin: '-50px 0px 0px 0px' }),
  );
  const callback = IntersectionObserverMock.mock.calls[0][0];
  const callBack = callback([{ isIntersecting: true, intersectionRatio: 0.5 }]);
  const observer = new IntersectionObserverMock(callBack, {});
  const newDiv = document.createElement('div');
  observer.observe(newDiv);
  expect(hook.result.current[1]).toEqual(true);
});

test('should return isSticky as false when intersectionRatio >= 1', async () => {
  const hook = renderHook(() =>
    useElementOnScreen({ rootMargin: '-50px 0px 0px 0px' }),
  );
  const callback = IntersectionObserverMock.mock.calls[0][0];
  const callBack = callback([{ isIntersecting: true, intersectionRatio: 1 }]);
  const observer = new IntersectionObserverMock(callBack, {});
  const newDiv = document.createElement('div');
  observer.observe(newDiv);
  expect(hook.result.current[1]).toEqual(false);
});

test('should observe and unobserve element with IntersectionObserver', async () => {
  jest.spyOn(React, 'useRef').mockReturnValue({ current: 'test' });
  const options = { threshold: 0.5 };
  const { result, unmount } = renderHook(() => useElementOnScreen(options));
  const [elementRef] = result.current;

  expect(IntersectionObserverMock).toHaveBeenCalledWith(
    expect.any(Function),
    options,
  );

  expect(elementRef).not.toBe(null);
  expect(observeMock).toHaveBeenCalledWith(elementRef.current);

  unmount();

  expect(unobserveMock).toHaveBeenCalledWith(elementRef.current);
});

test('should not observe an element if it is null', () => {
  jest.spyOn(React, 'useRef').mockReturnValue({ current: null });
  const options = {};
  const { result } = renderHook(() => useElementOnScreen(options));
  const [ref, isSticky] = result.current;
  expect(ref.current).toBe(null);
  expect(isSticky).toBe(false);

  expect(observeMock).not.toHaveBeenCalled();
});

test('should not unobserve the element if it is null', () => {
  jest.spyOn(React, 'useRef').mockReturnValue({ current: null });
  const options = {};
  const { result, unmount } = renderHook(() => useElementOnScreen(options));
  const [ref, isSticky] = result.current;

  expect(ref.current).toBe(null);
  expect(isSticky).toBe(false);

  unmount();

  expect(unobserveMock).not.toHaveBeenCalled();
});
