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

import { SupersetClient } from '@superset-ui/core';
import { factoryFetchSchemas } from './factoryFetchSchemas';

const SupersetClientGet = jest.spyOn(SupersetClient, 'get');

const createOption = (option: string[]) =>
  option.map(opt => ({
    value: opt,
    label: opt,
    title: opt,
  }));

test('Should call the constructors correctly - request fail', async () => {
  const constructors = {
    setSchemaLoading: jest.fn(),
    setSchemaOptions: jest.fn(),
    onSchemasLoad: jest.fn(),
    handleError: jest.fn(),
  };

  SupersetClientGet.mockRejectedValue(Error('Any Error'));
  const fetchSchemas = factoryFetchSchemas(constructors);

  await fetchSchemas({ databaseId: 321 });

  expect(SupersetClientGet).toBeCalledWith({
    endpoint: '/api/v1/database/321/schemas/?q=(force:!f)',
  });
  expect(constructors.setSchemaLoading).toBeCalledTimes(1);
  expect(constructors.setSchemaLoading).nthCalledWith(1, false);

  expect(constructors.setSchemaOptions).toBeCalledTimes(1);
  expect(constructors.setSchemaOptions).nthCalledWith(1, []);

  expect(constructors.onSchemasLoad).toBeCalledTimes(0);

  expect(constructors.handleError).toBeCalledTimes(1);
  expect(constructors.handleError).nthCalledWith(
    1,
    'Error while fetching schema list',
  );
});

test('Should call the constructors correctly - request success', async () => {
  const constructors = {
    setSchemaLoading: jest.fn(),
    setSchemaOptions: jest.fn(),
    onSchemasLoad: jest.fn(),
    handleError: jest.fn(),
  };

  SupersetClientGet.mockResolvedValue({
    json: { result: ['a', 'b', 'c'] },
  } as any);
  const fetchSchemas = factoryFetchSchemas(constructors);

  await fetchSchemas({ databaseId: 123 });

  expect(SupersetClientGet).toBeCalledWith({
    endpoint: '/api/v1/database/123/schemas/?q=(force:!f)',
  });
  expect(constructors.setSchemaLoading).toBeCalledTimes(1);
  expect(constructors.setSchemaLoading).nthCalledWith(1, false);

  expect(constructors.setSchemaOptions).toBeCalledTimes(1);
  expect(constructors.setSchemaOptions).nthCalledWith(
    1,
    createOption(['a', 'b', 'c']),
  );

  expect(constructors.onSchemasLoad).toBeCalledTimes(1);
  expect(constructors.onSchemasLoad).nthCalledWith(
    1,
    createOption(['a', 'b', 'c']),
  );

  expect(constructors.handleError).toBeCalledTimes(0);
});
