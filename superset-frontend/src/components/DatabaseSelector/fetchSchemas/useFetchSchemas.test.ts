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
import { SupersetClient } from '@superset-ui/core';
import { useFetchSchemas } from './useFetchSchemas';

const SupersetClientGet = jest.spyOn(SupersetClient, 'get');

test('Should call constructos', async () => {
  const constructors = {
    setSchemaLoading: jest.fn(),
    setSchemaOptions: jest.fn(),
    onSchemasLoad: jest.fn(),
    handleError: jest.fn(),
  };

  const { result } = renderHook(() => useFetchSchemas(constructors));

  SupersetClientGet.mockResolvedValue({
    json: { result: ['a', 'b', 'c'] },
  } as any);
  await act(async () => {
    result.current.current({ databaseId: 123 });
  });

  expect(constructors.setSchemaLoading).toBeCalledTimes(1);
  expect(constructors.setSchemaOptions).toBeCalledTimes(1);
  expect(constructors.onSchemasLoad).toBeCalledTimes(1);
  expect(constructors.handleError).toBeCalledTimes(0);

  SupersetClientGet.mockRejectedValue(Error('Any Error'));
  await act(async () => {
    result.current.current({ databaseId: 123 });
  });

  expect(constructors.setSchemaLoading).toBeCalledTimes(2);
  expect(constructors.setSchemaOptions).toBeCalledTimes(2);
  expect(constructors.onSchemasLoad).toBeCalledTimes(1);
  expect(constructors.handleError).toBeCalledTimes(1);
});
