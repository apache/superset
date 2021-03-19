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
import { useDebouncedEffect } from '.';

jest.useFakeTimers();

/**
 * For some reason, if we use "setTimeout" the test does not work, but if we use window.setTimeout this test works normally
 */
test.skip('the effect should only be executed only when time pass', () => {
  const effect = jest.fn();
  renderHook(() => useDebouncedEffect(effect, 1000, ['a', 'b']));

  expect(effect).toBeCalledTimes(0);
  jest.advanceTimersByTime(500);
  expect(effect).toBeCalledTimes(0);
  jest.advanceTimersByTime(600);
  expect(effect).toBeCalledTimes(1);
});
