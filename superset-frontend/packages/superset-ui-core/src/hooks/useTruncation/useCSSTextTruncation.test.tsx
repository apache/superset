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
import useCSSTextTruncation from './useCSSTextTruncation';

afterEach(() => {
  jest.clearAllMocks();
});

test('should be false by default', () => {
  const { result } = renderHook(() =>
    useCSSTextTruncation<HTMLParagraphElement>(),
  );
  const [paragraphRef, isTruncated] = result.current;
  expect(paragraphRef.current).toBe(null);
  expect(isTruncated).toBe(false);
});

test('should not truncate', () => {
  const ref = { current: document.createElement('p') };
  Object.defineProperty(ref.current, 'offsetWidth', { get: () => 100 });
  Object.defineProperty(ref.current, 'scrollWidth', { get: () => 50 });
  jest.spyOn(React, 'useRef').mockReturnValue({ current: ref.current });

  const { result } = renderHook(() =>
    useCSSTextTruncation<HTMLParagraphElement>(),
  );
  const [, isTruncated] = result.current;

  expect(isTruncated).toBe(false);
});

test('should truncate', () => {
  const ref = { current: document.createElement('p') };
  Object.defineProperty(ref.current, 'offsetWidth', { get: () => 50 });
  Object.defineProperty(ref.current, 'scrollWidth', { get: () => 100 });
  jest.spyOn(React, 'useRef').mockReturnValue({ current: ref.current });

  const { result } = renderHook(() =>
    useCSSTextTruncation<HTMLParagraphElement>(),
  );
  const [, isTruncated] = result.current;

  expect(isTruncated).toBe(true);
});
