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
import { useChangeEffect } from './useChangeEffect';

test('call callback the first time with undefined and value', () => {
  const callback = jest.fn();
  renderHook(props => useChangeEffect(props.value, props.callback), {
    initialProps: { value: 'value', callback },
  });
  expect(callback).toBeCalledTimes(1);
  expect(callback).nthCalledWith(1, undefined, 'value');
});

test('do not call callback 2 times if the value do not change', () => {
  const callback = jest.fn();
  const hook = renderHook(
    props => useChangeEffect(props.value, props.callback),
    {
      initialProps: { value: 'value', callback },
    },
  );
  hook.rerender({ value: 'value', callback });
  expect(callback).toBeCalledTimes(1);
});

test('call callback whenever the value changes', () => {
  const callback = jest.fn();
  const hook = renderHook(
    props => useChangeEffect(props.value, props.callback),
    {
      initialProps: { value: 'value', callback },
    },
  );
  hook.rerender({ value: 'value-2', callback });
  expect(callback).toBeCalledTimes(2);
  expect(callback).nthCalledWith(2, 'value', 'value-2');
});
