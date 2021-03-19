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
import { getChartKey } from '.';

// This validation has not been implemented
test.skip('Should return 0 when called without arguments', () => {
  expect(getChartKey()).toBe(0);
});

test('should return 0 when called with empty object', () => {
  expect(getChartKey({})).toBe(0);
});

// The function does not yet have this behavior
test.skip('should return 0 when called with incomplete object', () => {
  expect(getChartKey({ slice: {} })).toBe(0);
});

test('should return 0 when called with complete object', () => {
  expect(getChartKey({ slice: { slice_id: 100 } })).toBe(100);
});
