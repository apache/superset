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
import { useChangeSchema } from './useChangeSchema';

test('Should call useRef functions with updated value', () => {
  const selectChangeFirst = jest.fn();
  const selectChangeSecond = jest.fn();
  const onSelectChange = { current: selectChangeFirst };

  const constructors = {
    setCurrentSchema: jest.fn(),
    onSchemaChange: jest.fn(),
    getTableList: jest.fn(),
    onSelectChange,
  };

  const { result } = renderHook(() => useChangeSchema(constructors));

  act(() => {
    result.current.current({
      currentDbId: 10,
      selectedSchema: { value: 'schema', label: 'schema', title: 'schema' },
      force: false,
    });
  });

  constructors.onSelectChange.current = selectChangeSecond;

  expect(constructors.setCurrentSchema).toBeCalledTimes(1);
  expect(constructors.onSchemaChange).toBeCalledTimes(1);
  expect(constructors.getTableList).toBeCalledTimes(1);
  expect(selectChangeFirst).toBeCalledTimes(1);
  expect(selectChangeSecond).toBeCalledTimes(0);

  act(() => {
    result.current.current({
      currentDbId: 10,
      selectedSchema: { value: 'schema', label: 'schema', title: 'schema' },
      force: false,
    });
  });

  expect(constructors.setCurrentSchema).toBeCalledTimes(2);
  expect(constructors.onSchemaChange).toBeCalledTimes(2);
  expect(constructors.getTableList).toBeCalledTimes(2);
  expect(selectChangeFirst).toBeCalledTimes(1);
  expect(selectChangeSecond).toBeCalledTimes(1);
});
