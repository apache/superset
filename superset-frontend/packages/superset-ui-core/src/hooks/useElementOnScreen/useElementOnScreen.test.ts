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
import { useElementOnScreen } from './useElementOnScreen';

const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.prototype.observe = jest.fn();
mockIntersectionObserver.prototype.unobserve = jest.fn();

beforeEach(() => {
  window.IntersectionObserver = mockIntersectionObserver;
});

afterEach(() => {
  mockIntersectionObserver.mockClear();
});

test('get null and false on first render', () => {
  const hook = renderHook(() =>
    useElementOnScreen({ rootMargin: '-50px 0px 0px 0px' }),
  );
  expect(hook.result.current).toEqual([{ current: null }, false]);
});

test('should return isSticky as true when intersectionRatio < 1', async () => {
  const hook = renderHook(() =>
    useElementOnScreen({ rootMargin: '-50px 0px 0px 0px' }),
  );
  const callback = mockIntersectionObserver.mock.calls[0][0];
  const callBack = callback([{ isIntersecting: true, intersectionRatio: 0.5 }]);
  const observer = new IntersectionObserver(callBack, {});
  const newDiv = document.createElement('div');
  observer.observe(newDiv);
  expect(hook.result.current[1]).toEqual(true);
});

test('should not return isSticky as true when intersectionRatio >= 1', async () => {
  const hook = renderHook(() =>
    useElementOnScreen({ rootMargin: '-50px 0px 0px 0px' }),
  );
  const newDiv = document.createElement('div');
  const callback = mockIntersectionObserver.mock.calls[0][0];
  const callBack = callback([{ isIntersecting: true, intersectionRatio: 1 }]);
  const observer = new IntersectionObserver(callBack, {});
  observer.observe(newDiv);
  expect(hook.result.current[1]).toEqual(false);
});
