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

import {
  NumberFormatter,
  createSiAtMostNDigitFormatter,
} from '@superset-ui/core';

describe('createSiAtMostNDigitFormatter({ n })', () => {
  it('creates an instance of NumberFormatter', () => {
    const formatter = createSiAtMostNDigitFormatter({ n: 4 });
    expect(formatter).toBeInstanceOf(NumberFormatter);
  });
  it('when n is specified, it formats number in SI format with at most n significant digits', () => {
    const formatter = createSiAtMostNDigitFormatter({ n: 2 });
    expect(formatter(10)).toBe('10');
    expect(formatter(1)).toBe('1');
    expect(formatter(1)).toBe('1');
    expect(formatter(10)).toBe('10');
    expect(formatter(10001)).toBe('10k');
    expect(formatter(10100)).toBe('10k');
    expect(formatter(111000000)).toBe('110M');
    expect(formatter(0.23)).toBe('230m');
    expect(formatter(0)).toBe('0');
    expect(formatter(-10)).toBe('-10');
    expect(formatter(-1)).toBe('-1');
    expect(formatter(-1)).toBe('-1');
    expect(formatter(-10)).toBe('-10');
    expect(formatter(-10001)).toBe('-10k');
    expect(formatter(-10101)).toBe('-10k');
    expect(formatter(-111000000)).toBe('-110M');
    expect(formatter(-0.23)).toBe('-230m');
  });
  it('when n is not specified, it defaults to n=3', () => {
    const formatter = createSiAtMostNDigitFormatter();
    expect(formatter(10)).toBe('10');
    expect(formatter(1)).toBe('1');
    expect(formatter(1)).toBe('1');
    expect(formatter(10)).toBe('10');
    expect(formatter(10001)).toBe('10.0k');
    expect(formatter(10100)).toBe('10.1k');
    expect(formatter(111000000)).toBe('111M');
    expect(formatter(0.23)).toBe('230m');
    expect(formatter(0)).toBe('0');
    expect(formatter(-10)).toBe('-10');
    expect(formatter(-1)).toBe('-1');
    expect(formatter(-1)).toBe('-1');
    expect(formatter(-10)).toBe('-10');
    expect(formatter(-10001)).toBe('-10.0k');
    expect(formatter(-10101)).toBe('-10.1k');
    expect(formatter(-111000000)).toBe('-111M');
    expect(formatter(-0.23)).toBe('-230m');
  });
});
