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
import { renderHook, act } from '@testing-library/react';
import { usePristineItemValues } from './usePristineItemValues';

test('an item holding what it opened with is unchanged', () => {
  const { result } = renderHook(() => usePristineItemValues());

  act(() => result.current.remember('f1', { name: 'Country' }));

  expect(result.current.isUnchanged('f1', { name: 'Country' })).toBe(true);
  expect(result.current.isUnchanged('f1', { name: 'Region' })).toBe(false);
});

test('the latest reading wins, so async values fold into the baseline', () => {
  // A filter's dataset and column arrive from a fetch, so the first reading
  // after the panel mounts carries an empty target and only settles a moment
  // later. Keeping that first reading made every filter look edited. The
  // caller stops calling once the item is marked modified, which is what
  // freezes the baseline at the last reading before the first edit.
  const { result } = renderHook(() => usePristineItemValues());

  act(() => {
    result.current.remember('f1', { targets: [{}] });
    result.current.remember('f1', { targets: [{ datasetId: 13 }] });
  });

  expect(result.current.isUnchanged('f1', { targets: [{ datasetId: 13 }] })).toBe(
    true,
  );
  expect(result.current.isUnchanged('f1', { targets: [{}] })).toBe(false);
});

test('an item nobody recorded counts as changed', () => {
  // A filter added in this session, or one whose form had not mounted. Both
  // have to be saved, so the answer has to be "changed".
  const { result } = renderHook(() => usePristineItemValues());

  expect(result.current.isUnchanged('new-filter', undefined)).toBe(false);
});

test('reset forgets everything, for a reopened modal', () => {
  const { result } = renderHook(() => usePristineItemValues());

  act(() => {
    result.current.remember('f1', { name: 'Country' });
    result.current.reset();
  });

  expect(result.current.isUnchanged('f1', { name: 'Country' })).toBe(false);
});
