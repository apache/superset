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

import { getMenuAdjustedY } from './utils';

const originalInnerHeight = window.innerHeight;

beforeEach(() => {
  window.innerHeight = 500;
});

afterEach(() => {
  window.innerHeight = originalInnerHeight;
});

test('correctly positions at upper edge of screen', () => {
  expect(getMenuAdjustedY(75, 1)).toEqual(75); // No adjustment
  expect(getMenuAdjustedY(75, 2)).toEqual(75); // No adjustment
  expect(getMenuAdjustedY(75, 3)).toEqual(75); // No adjustment
});

test('correctly positions at lower edge of screen', () => {
  expect(getMenuAdjustedY(425, 1)).toEqual(425); // No adjustment
  expect(getMenuAdjustedY(425, 2)).toEqual(404); // Adjustment
  expect(getMenuAdjustedY(425, 3)).toEqual(372); // Adjustment

  expect(getMenuAdjustedY(425, 8, 200)).toEqual(268);
  expect(getMenuAdjustedY(425, 8, 200, 48)).toEqual(220);
});
