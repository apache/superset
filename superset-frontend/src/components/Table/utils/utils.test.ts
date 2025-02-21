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
import { cleanup } from 'spec/helpers/testing-library';
import { withinRange } from './utils';

// Add cleanup after each test
afterEach(async () => {
  cleanup();
  // Wait for any pending effects to complete
  await new Promise(resolve => setTimeout(resolve, 0));
});

// Make tests async
test('withinRange supported positive numbers', async () => {
  // Valid inputs within range
  expect(withinRange(50, 60, 16)).toBeTruthy();

  // Valid inputs outside of range
  expect(withinRange(40, 60, 16)).toBeFalsy();
});

test('withinRange unsupported negative numbers', async () => {
  // Negative numbers not supported
  expect(withinRange(65, 60, -16)).toBeFalsy();
  expect(withinRange(-60, -65, 16)).toBeFalsy();
  expect(withinRange(-60, -65, 16)).toBeFalsy();
  expect(withinRange(-60, 65, 16)).toBeFalsy();
});

test('withinRange invalid inputs', async () => {
  // Invalid inputs should return falsy and not throw an error
  // We need ts-ignore here to be able to pass invalid values and pass linting
  // @ts-ignore
  expect(withinRange(null, 60, undefined)).toBeFalsy();
  // @ts-ignore
  expect(withinRange([], 'hello', {})).toBeFalsy();
  // @ts-ignore
  expect(withinRange([], undefined, {})).toBeFalsy();
  // @ts-ignore
  expect(withinRange([], 'hello', {})).toBeFalsy();
});
