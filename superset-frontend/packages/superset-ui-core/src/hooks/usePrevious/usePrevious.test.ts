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
import { usePrevious } from './usePrevious';

test('get undefined on the first render when initialValue is not defined', () => {
  const hook = renderHook(() => usePrevious('state'));
  expect(hook.result.current).toBeUndefined();
});

test('get initial value on the first render when initialValue is defined', () => {
  const hook = renderHook(() => usePrevious('state', 'initial'));
  expect(hook.result.current).toBe('initial');
});

test('get state value on second render', () => {
  const hook = renderHook(() => usePrevious('state', 'initial'));
  hook.rerender(() => usePrevious('state'));
  expect(hook.result.current).toBe('state');
});

test('get state value on third render', () => {
  const hook = renderHook(() => usePrevious('state'));
  hook.rerender(() => usePrevious('state'));
  hook.rerender(() => usePrevious('state-2'));
  expect(hook.result.current).toBe('state');
});
