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
import { findPermission } from './findPermission';

test('findPermission for single role', () => {
  expect(findPermission('abc', 'def', { role: [['abc', 'def']] })).toEqual(
    true,
  );

  expect(findPermission('abc', 'def', { role: [['abc', 'de']] })).toEqual(
    false,
  );

  expect(findPermission('abc', 'def', { role: [] })).toEqual(false);
});

test('findPermission for multiple roles', () => {
  expect(
    findPermission('abc', 'def', {
      role1: [
        ['ccc', 'aaa'],
        ['abc', 'def'],
      ],
      role2: [['abc', 'def']],
    }),
  ).toEqual(true);

  expect(
    findPermission('abc', 'def', {
      role1: [['abc', 'def']],
      role2: [['abc', 'dd']],
    }),
  ).toEqual(true);

  expect(
    findPermission('abc', 'def', {
      role1: [['ccc', 'aaa']],
      role2: [['aaa', 'ddd']],
    }),
  ).toEqual(false);

  expect(findPermission('abc', 'def', { role1: [], role2: [] })).toEqual(false);
});

test('handles nonexistent roles', () => {
  expect(findPermission('abc', 'def', null)).toEqual(false);
});
