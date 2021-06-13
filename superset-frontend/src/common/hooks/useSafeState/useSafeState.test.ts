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
import { renderHook, act } from '@testing-library/react-hooks';
import { useSafeState } from './useSafeState';

test('render with initialValue', () => {
  const hook = renderHook(() => {
    const [state, setState] = useSafeState('initial');
    return {
      state,
      setState,
    };
  });
  expect(hook.result.current.state).toBe('initial');
});

test('should update with setState', () => {
  const hook = renderHook(() => {
    const [state, setState] = useSafeState(0);
    return {
      state,
      setState,
    };
  });
  act(() => {
    hook.result.current.setState(1);
  });
  expect(hook.result.current.state).toBe(1);
});

test('should not update when unmounted', () => {
  const hook = renderHook(() => {
    const [state, setState] = useSafeState(0);
    return {
      state,
      setState,
    };
  });
  hook.unmount();
  act(() => {
    hook.result.current.setState(1);
  });
  expect(hook.result.current.state).toBe(0);
});
