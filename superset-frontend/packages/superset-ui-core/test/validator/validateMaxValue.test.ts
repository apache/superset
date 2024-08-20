/*
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

import { validateMaxValue } from '@superset-ui/core';
import './setup';

test('validateInteger returns the warning message if invalid', () => {
  expect(validateMaxValue(10.1, 10)).toBeTruthy();
  expect(validateMaxValue(1, 0)).toBeTruthy();
  expect(validateMaxValue('2', 1)).toBeTruthy();
});

test('validateInteger returns false if the input is valid', () => {
  expect(validateMaxValue(0, 1)).toBeFalsy();
  expect(validateMaxValue(10, 10)).toBeFalsy();
  expect(validateMaxValue(undefined, 1)).toBeFalsy();
  expect(validateMaxValue(NaN, NaN)).toBeFalsy();
  expect(validateMaxValue(null, 1)).toBeFalsy();
  expect(validateMaxValue('1', 1)).toBeFalsy();
  expect(validateMaxValue('a', 1)).toBeFalsy();
});
