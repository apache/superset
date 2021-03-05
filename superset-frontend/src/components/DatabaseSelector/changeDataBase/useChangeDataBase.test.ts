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
import { useChangeDataBase } from './useChangeDataBase';

test('Should call useRef functions with updated value', () => {
  const fetchFirst = jest.fn();
  const fetchSecond = jest.fn();
  const fetchSchemas = { current: fetchFirst };

  const selectChangeFirst = jest.fn();
  const selectChangeSecond = jest.fn();
  const onSelectChange = { current: selectChangeFirst };

  const constructors = {
    setSchemaOptions: jest.fn(),
    onSchemaChange: jest.fn(),
    onDbChange: jest.fn(),
    fetchSchemas,
    onSelectChange,
  };

  const { result } = renderHook(() => useChangeDataBase(constructors));

  act(() => {
    result.current.current({ id: 12 }, true);
  });

  constructors.fetchSchemas.current = fetchSecond;
  constructors.onSelectChange.current = selectChangeSecond;

  expect(constructors.setSchemaOptions).toBeCalledTimes(1);
  expect(constructors.onSchemaChange).toBeCalledTimes(1);
  expect(constructors.onDbChange).toBeCalledTimes(1);
  expect(fetchFirst).toBeCalledTimes(1);
  expect(fetchSecond).toBeCalledTimes(0);
  expect(selectChangeFirst).toBeCalledTimes(1);
  expect(selectChangeSecond).toBeCalledTimes(0);

  act(() => {
    result.current.current({ id: 12 }, true);
  });

  expect(constructors.setSchemaOptions).toBeCalledTimes(2);
  expect(constructors.onSchemaChange).toBeCalledTimes(2);
  expect(constructors.onDbChange).toBeCalledTimes(2);
  expect(fetchFirst).toBeCalledTimes(1);
  expect(fetchSecond).toBeCalledTimes(1);
  expect(selectChangeFirst).toBeCalledTimes(1);
  expect(selectChangeSecond).toBeCalledTimes(1);
});
