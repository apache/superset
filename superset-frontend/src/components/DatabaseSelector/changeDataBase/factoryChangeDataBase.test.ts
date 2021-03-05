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

import { factoryChangeDataBase } from './factoryChangeDataBase';

test('Should call the constructors correctly', () => {
  const fetchSchemas = { current: jest.fn() };
  const onSelectChange = { current: jest.fn() };
  const constructors = {
    setSchemaOptions: jest.fn(),
    onSchemaChange: jest.fn(),
    onDbChange: jest.fn(),
    fetchSchemas,
    onSelectChange,
  };

  const changeDataBase = factoryChangeDataBase(constructors);

  changeDataBase({ id: 12 }, true);

  expect(constructors.setSchemaOptions).toBeCalledTimes(1);
  expect(constructors.setSchemaOptions).nthCalledWith(1, []);

  expect(constructors.onSchemaChange).toBeCalledTimes(1);
  expect(constructors.onSchemaChange).nthCalledWith(1, null);

  expect(constructors.onDbChange).toBeCalledTimes(1);
  expect(constructors.onDbChange).nthCalledWith(1, { id: 12 });

  expect(onSelectChange.current).toBeCalledTimes(1);
  expect(onSelectChange.current).nthCalledWith(1, {
    dbId: 12,
    schema: undefined,
  });

  expect(fetchSchemas.current).toBeCalledTimes(1);
  expect(fetchSchemas.current).nthCalledWith(1, {
    databaseId: 12,
    forceRefresh: true,
  });
});

test('Should call the constructors correctly - no onSchemaChange and no onDbChange', () => {
  const fetchSchemas = { current: jest.fn() };
  const onSelectChange = { current: jest.fn() };
  const constructors = {
    setSchemaOptions: jest.fn(),
    fetchSchemas,
    onSelectChange,
  };

  const changeDataBase = factoryChangeDataBase(constructors);

  changeDataBase({ id: 12 }, true);

  expect(constructors.setSchemaOptions).toBeCalledTimes(1);
  expect(constructors.setSchemaOptions).nthCalledWith(1, []);

  expect(onSelectChange.current).toBeCalledTimes(1);
  expect(onSelectChange.current).nthCalledWith(1, {
    dbId: 12,
    schema: undefined,
  });

  expect(fetchSchemas.current).toBeCalledTimes(1);
  expect(fetchSchemas.current).nthCalledWith(1, {
    databaseId: 12,
    forceRefresh: true,
  });
});

test('Should call the constructors correctly - no params', () => {
  const fetchSchemas = { current: jest.fn() };
  const onSelectChange = { current: jest.fn() };
  const constructors = {
    setSchemaOptions: jest.fn(),
    onSchemaChange: jest.fn(),
    onDbChange: jest.fn(),
    fetchSchemas,
    onSelectChange,
  };

  const changeDataBase = factoryChangeDataBase(constructors);

  changeDataBase();

  expect(constructors.setSchemaOptions).toBeCalledTimes(1);
  expect(constructors.setSchemaOptions).nthCalledWith(1, []);

  expect(constructors.onSchemaChange).toBeCalledTimes(1);
  expect(constructors.onSchemaChange).nthCalledWith(1, null);

  expect(constructors.onDbChange).toBeCalledTimes(1);
  expect(constructors.onDbChange).nthCalledWith(1, undefined);

  expect(onSelectChange.current).toBeCalledTimes(1);
  expect(onSelectChange.current).nthCalledWith(1, {
    dbId: null,
    schema: undefined,
  });

  expect(fetchSchemas.current).toBeCalledTimes(1);
  expect(fetchSchemas.current).nthCalledWith(1, {
    databaseId: null,
    forceRefresh: false,
  });
});
