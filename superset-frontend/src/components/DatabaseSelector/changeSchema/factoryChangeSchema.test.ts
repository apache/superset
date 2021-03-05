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

import { factoryChangeSchema } from './factoryChangeSchema';

test('Should call the constructors correctly', () => {
  const onSelectChange = { current: jest.fn() };
  const constructors = {
    onSelectChange,
    setCurrentSchema: jest.fn(),
    onSchemaChange: jest.fn(),
    getTableList: jest.fn(),
  };

  const changeSchema = factoryChangeSchema(constructors);

  changeSchema({
    currentDbId: 10,
    selectedSchema: { value: 'schema', label: 'schema', title: 'schema' },
    force: false,
  });

  expect(constructors.onSchemaChange).toBeCalledTimes(1);
  expect(constructors.onSchemaChange).nthCalledWith(1, 'schema');

  expect(constructors.setCurrentSchema).toBeCalledTimes(1);
  expect(constructors.setCurrentSchema).nthCalledWith(1, 'schema');

  expect(onSelectChange.current).toBeCalledTimes(1);
  expect(onSelectChange.current).nthCalledWith(1, {
    dbId: 10,
    schema: 'schema',
  });

  expect(constructors.getTableList).toBeCalledTimes(1);
  expect(constructors.getTableList).nthCalledWith(1, 10, 'schema', false);
});

test('Should call the constructors correctly - no onSchemaChange and no getTableList', () => {
  const onSelectChange = { current: jest.fn() };
  const constructors = {
    onSelectChange,
    setCurrentSchema: jest.fn(),
  };

  const changeSchema = factoryChangeSchema(constructors);

  changeSchema({
    currentDbId: 10,
    selectedSchema: { value: 'schema', label: 'schema', title: 'schema' },
    force: false,
  });

  expect(constructors.setCurrentSchema).toBeCalledTimes(1);
  expect(constructors.setCurrentSchema).nthCalledWith(1, 'schema');

  expect(onSelectChange.current).toBeCalledTimes(1);
  expect(onSelectChange.current).nthCalledWith(1, {
    dbId: 10,
    schema: 'schema',
  });
});

/**
 * This test is to guarantee an eventual inconsistency between the declared type and the value received at execution time.
 * As there was a validation that does not match the type, I created this test to ensure that any eventual bugfix is not lost
 */
test('Should call the constructors correctly - no params', () => {
  const onSelectChange = { current: jest.fn() };
  const constructors = {
    onSelectChange,
    setCurrentSchema: jest.fn(),
    onSchemaChange: jest.fn(),
    getTableList: jest.fn(),
  };

  const changeSchema = factoryChangeSchema(constructors);

  changeSchema({
    currentDbId: 10,
    selectedSchema: {} as any,
  });

  expect(constructors.onSchemaChange).toBeCalledTimes(1);
  expect(constructors.onSchemaChange).nthCalledWith(1, null);

  expect(constructors.setCurrentSchema).toBeCalledTimes(1);
  expect(constructors.setCurrentSchema).nthCalledWith(1, null);

  expect(onSelectChange.current).toBeCalledTimes(1);
  expect(onSelectChange.current).nthCalledWith(1, {
    dbId: 10,
    schema: null,
  });

  expect(constructors.getTableList).toBeCalledTimes(1);
  expect(constructors.getTableList).nthCalledWith(1, 10, null, false);
});
