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
import {
  isRangesInputComplete,
  tokenizeToNumericArray,
} from '../../src/Bullet/utils';

test('tokenizeToNumericArray drops blank tokens, including an embedded one', () => {
  expect(tokenizeToNumericArray('20,40,60')).toEqual([20, 40, 60]);
  expect(tokenizeToNumericArray('20,,60')).toEqual([20, 60]);
  expect(tokenizeToNumericArray('')).toBeNull();
  expect(tokenizeToNumericArray(undefined)).toBeNull();
});

test('isRangesInputComplete is true for an empty or fully numeric list', () => {
  expect(isRangesInputComplete(undefined)).toBe(true);
  expect(isRangesInputComplete('')).toBe(true);
  expect(isRangesInputComplete('20')).toBe(true);
  expect(isRangesInputComplete('20,40,60')).toBe(true);
});

test('isRangesInputComplete tolerates a single trailing blank token while typing', () => {
  expect(isRangesInputComplete('20,40,')).toBe(true);
});

test('isRangesInputComplete is false for a blank token between two numbers', () => {
  expect(isRangesInputComplete('20,,60')).toBe(false);
});

test('isRangesInputComplete is false for a non-numeric token anywhere', () => {
  expect(isRangesInputComplete('20,abc,60')).toBe(false);
  expect(isRangesInputComplete('abc')).toBe(false);
});
