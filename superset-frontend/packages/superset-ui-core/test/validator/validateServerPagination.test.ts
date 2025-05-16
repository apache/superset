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

import { validateServerPagination } from '@superset-ui/core';
import './setup';

test('validateServerPagination returns warning message when server pagination is disabled and value exceeds max', () => {
  expect(validateServerPagination(100001, false, 100000)).toBeTruthy();
  expect(validateServerPagination('150000', false, 100000)).toBeTruthy();
  expect(validateServerPagination(200000, false, 100000)).toBeTruthy();
});

test('validateServerPagination returns false when server pagination is enabled', () => {
  expect(validateServerPagination(100001, true, 100000)).toBeFalsy();
  expect(validateServerPagination(150000, true, 100000)).toBeFalsy();
  expect(validateServerPagination('200000', true, 100000)).toBeFalsy();
});

test('validateServerPagination returns false when value is below max', () => {
  expect(validateServerPagination(50000, false, 100000)).toBeFalsy();
  expect(validateServerPagination('75000', false, 100000)).toBeFalsy();
  expect(validateServerPagination(99999, false, 100000)).toBeFalsy();
});

test('validateServerPagination handles edge cases', () => {
  expect(validateServerPagination(undefined, false, 100000)).toBeFalsy();
  expect(validateServerPagination(null, false, 100000)).toBeFalsy();
  expect(validateServerPagination(NaN, false, 100000)).toBeFalsy();
  expect(validateServerPagination('invalid', false, 100000)).toBeFalsy();
});
