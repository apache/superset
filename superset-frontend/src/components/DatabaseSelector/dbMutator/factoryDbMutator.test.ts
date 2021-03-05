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

import { factoryDbMutator } from './factoryDbMutator';

test('Should call handleError if the result is an empty array', () => {
  const handleError = jest.fn();
  const mutator = factoryDbMutator({ handleError });
  expect(handleError).toBeCalledTimes(0);
  const response = mutator({ result: [] });
  expect(handleError).toBeCalledTimes(1);
  expect(handleError).toBeCalledWith(
    "It seems you don't have access to any database",
  );
  expect(response).toEqual([]);
});

test('Should not call handleError if the result contain objects', () => {
  const handleError = jest.fn();
  const mutator = factoryDbMutator({ handleError });
  expect(handleError).toBeCalledTimes(0);
  const response = mutator({
    result: [{ backend: 'backend', database_name: 'database_name' }],
  });
  expect(handleError).toBeCalledTimes(0);
  expect(response).toEqual([
    {
      backend: 'backend',
      database_name: 'database_name',
      label: 'backend database_name',
    },
  ]);
});

test('Should call getDbList only if it exists', () => {
  const getDbList = jest.fn();
  const handleError = jest.fn();
  const mutator = factoryDbMutator({ getDbList, handleError });
  expect(getDbList).toBeCalledTimes(0);
  mutator({
    result: [{ backend: 'backend', database_name: 'database_name' }],
  });
  expect(getDbList).toBeCalledTimes(1);
  expect(getDbList).toBeCalledWith([
    { backend: 'backend', database_name: 'database_name' },
  ]);
});
