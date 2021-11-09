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
import { formatSelectOptions, formatSelectOptionsForRange } from '../../src';

describe('formatSelectOptions', () => {
  it('formats an array of options', () => {
    expect(formatSelectOptions([1, 5, 10, 25, 50, 'unlimited'])).toEqual([
      [1, '1'],
      [5, '5'],
      [10, '10'],
      [25, '25'],
      [50, '50'],
      ['unlimited', 'unlimited'],
    ]);
  });
  it('formats a mix of values and already formated options', () => {
    expect(
      formatSelectOptions<number | string>([
        [0, 'all'],
        1,
        5,
        10,
        25,
        50,
        'unlimited',
      ]),
    ).toEqual([
      [0, 'all'],
      [1, '1'],
      [5, '5'],
      [10, '10'],
      [25, '25'],
      [50, '50'],
      ['unlimited', 'unlimited'],
    ]);
  });
});

describe('formatSelectOptionsForRange', () => {
  it('generates select options from a range', () => {
    expect(formatSelectOptionsForRange(1, 5)).toEqual([
      [1, '1'],
      [2, '2'],
      [3, '3'],
      [4, '4'],
      [5, '5'],
    ]);
  });
});
