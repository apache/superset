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

import { factoryOnSelectChange } from './factoryOnSelectChange';

test('Should call the constructors correctly - with onChange', () => {
  const constructors = {
    setCurrentDbId: jest.fn(),
    setCurrentSchema: jest.fn(),
    onChange: jest.fn(),
  };

  const onSelectChange = factoryOnSelectChange(constructors);

  onSelectChange({ dbId: 12, schema: 'current-schema' });

  expect(constructors.setCurrentDbId).toBeCalledTimes(1);
  expect(constructors.setCurrentDbId).nthCalledWith(1, 12);

  expect(constructors.setCurrentSchema).toBeCalledTimes(1);
  expect(constructors.setCurrentSchema).nthCalledWith(1, 'current-schema');

  expect(constructors.onChange).toBeCalledTimes(1);
  expect(constructors.onChange).nthCalledWith(1, {
    dbId: 12,
    schema: 'current-schema',
    tableName: undefined,
  });
});

test('Should call the constructors correctly - no onChange', () => {
  const constructors = {
    setCurrentDbId: jest.fn(),
    setCurrentSchema: jest.fn(),
  };

  const onSelectChange = factoryOnSelectChange(constructors);

  onSelectChange({ dbId: 12, schema: 'current-schema' });

  expect(constructors.setCurrentDbId).toBeCalledTimes(1);
  expect(constructors.setCurrentDbId).nthCalledWith(1, 12);

  expect(constructors.setCurrentSchema).toBeCalledTimes(1);
  expect(constructors.setCurrentSchema).nthCalledWith(1, 'current-schema');
});
