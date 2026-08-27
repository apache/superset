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
import { studentTwoSidedPValue } from '../src/statistics';

test('matches standard two-sided t-table critical values', () => {
  // t critical values from a standard table map to these two-sided p-values.
  expect(studentTwoSidedPValue(-2.228, 10)).toBeCloseTo(0.05, 2);
  expect(studentTwoSidedPValue(2.228, 10)).toBeCloseTo(0.05, 2); // sign agnostic
  expect(studentTwoSidedPValue(-1.812, 10)).toBeCloseTo(0.1, 2);
  expect(studentTwoSidedPValue(-2.086, 20)).toBeCloseTo(0.05, 2);
  expect(studentTwoSidedPValue(-2.576, 1000)).toBeCloseTo(0.01, 2);
});

test('t = 0 gives p = 1, invalid inputs give NaN', () => {
  expect(studentTwoSidedPValue(0, 10)).toBeCloseTo(1, 6);
  expect(Number.isNaN(studentTwoSidedPValue(2, 0))).toBe(true);
  expect(Number.isNaN(studentTwoSidedPValue(Infinity, 10))).toBe(true);
});
