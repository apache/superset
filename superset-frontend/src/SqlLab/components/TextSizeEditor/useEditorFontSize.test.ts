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
import { act, renderHook } from '@testing-library/react';
import { LocalStorageKeys } from 'src/utils/localStorageHelpers';
import {
  DEFAULT_EDITOR_FONT_SIZE,
  EDITOR_FONT_SIZE_STEP,
  MAX_EDITOR_FONT_SIZE,
  MIN_EDITOR_FONT_SIZE,
} from 'src/SqlLab/constants';
import useEditorFontSize from './useEditorFontSize';

const storedValue = () =>
  localStorage.getItem(LocalStorageKeys.SqllabEditorFontSize);

beforeEach(() => {
  localStorage.clear();
});

test('defaults to the default font size when nothing is stored', () => {
  const { result } = renderHook(() => useEditorFontSize());
  expect(result.current.fontSize).toBe(DEFAULT_EDITOR_FONT_SIZE);
});

test('reads a previously stored font size', () => {
  localStorage.setItem(LocalStorageKeys.SqllabEditorFontSize, '18');
  const { result } = renderHook(() => useEditorFontSize());
  expect(result.current.fontSize).toBe(18);
});

test('falls back to the default for an invalid stored value', () => {
  localStorage.setItem(LocalStorageKeys.SqllabEditorFontSize, '"huge"');
  const { result } = renderHook(() => useEditorFontSize());
  expect(result.current.fontSize).toBe(DEFAULT_EDITOR_FONT_SIZE);
});

test('clamps an out-of-range stored value', () => {
  localStorage.setItem(LocalStorageKeys.SqllabEditorFontSize, '500');
  const { result } = renderHook(() => useEditorFontSize());
  expect(result.current.fontSize).toBe(MAX_EDITOR_FONT_SIZE);
});

test('increase, decrease and reset update the size and persist it', () => {
  const { result } = renderHook(() => useEditorFontSize());

  act(() => result.current.increase());
  expect(result.current.fontSize).toBe(
    DEFAULT_EDITOR_FONT_SIZE + EDITOR_FONT_SIZE_STEP,
  );
  expect(storedValue()).toBe(
    String(DEFAULT_EDITOR_FONT_SIZE + EDITOR_FONT_SIZE_STEP),
  );

  act(() => result.current.decrease());
  act(() => result.current.decrease());
  expect(result.current.fontSize).toBe(
    DEFAULT_EDITOR_FONT_SIZE - EDITOR_FONT_SIZE_STEP,
  );

  act(() => result.current.reset());
  expect(result.current.fontSize).toBe(DEFAULT_EDITOR_FONT_SIZE);
  expect(storedValue()).toBe(String(DEFAULT_EDITOR_FONT_SIZE));
});

test('never goes below the minimum or above the maximum', () => {
  const { result } = renderHook(() => useEditorFontSize());

  for (let i = 0; i < 20; i += 1) {
    act(() => result.current.decrease());
  }
  expect(result.current.fontSize).toBe(MIN_EDITOR_FONT_SIZE);

  for (let i = 0; i < 30; i += 1) {
    act(() => result.current.increase());
  }
  expect(result.current.fontSize).toBe(MAX_EDITOR_FONT_SIZE);
});

test('keeps every hook instance in sync', () => {
  const first = renderHook(() => useEditorFontSize());
  const second = renderHook(() => useEditorFontSize());

  act(() => first.result.current.increase());

  expect(second.result.current.fontSize).toBe(
    DEFAULT_EDITOR_FONT_SIZE + EDITOR_FONT_SIZE_STEP,
  );
});
