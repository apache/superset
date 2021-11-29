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
  createSmartNumberFormatter,
} from '@superset-ui/core/src';

describe('createSmartNumberFormatter(options)', () => {
  it('creates an instance of NumberFormatter', () => {
    const formatter = createSmartNumberFormatter();
    expect(formatter).toBeInstanceOf(NumberFormatter);
  });
  describe('using default options', () => {
    const formatter = createSmartNumberFormatter();
    it('formats 0 correctly', () => {
      expect(formatter(0)).toBe('0');
    });
    describe('for positive numbers', () => {
      it('formats billion with B in stead of G', () => {
        expect(formatter(1000000000)).toBe('1B');
        expect(formatter(4560000000)).toBe('4.56B');
      });
      it('formats numbers that are >= 1,000 & <= 1,000,000,000 as SI format with precision 3', () => {
        expect(formatter(1000)).toBe('1k');
        expect(formatter(10001)).toBe('10k');
        expect(formatter(10100)).toBe('10.1k');
        expect(formatter(111000000)).toBe('111M');
      });
      it('formats number that are >= 1 & < 1,000 as integer or float with at most 2 decimal points', () => {
        expect(formatter(1)).toBe('1');
        expect(formatter(1)).toBe('1');
        expect(formatter(10)).toBe('10');
        expect(formatter(10)).toBe('10');
        expect(formatter(10.23432)).toBe('10.23');
        expect(formatter(274.2856)).toBe('274.29');
        expect(formatter(999)).toBe('999');
      });
      it('formats numbers that are < 1 & >= 0.001 as float with at most 4 decimal points', () => {
        expect(formatter(0.1)).toBe('0.1');
        expect(formatter(0.23)).toBe('0.23');
        expect(formatter(0.699)).toBe('0.699');
        expect(formatter(0.0023)).toBe('0.0023');
        expect(formatter(0.002300001)).toBe('0.0023');
      });
      it('formats numbers that are < 0.001 & >= 0.000001 as micron', () => {
        expect(formatter(0.0002300001)).toBe('230µ');
        expect(formatter(0.000023)).toBe('23µ');
        expect(formatter(0.000001)).toBe('1µ');
      });
      it('formats numbers that are less than 0.000001 as SI format with precision 3', () => {
        expect(formatter(0.0000001)).toBe('100n');
      });
    });
    describe('for negative numbers', () => {
      it('formats billion with B in stead of G', () => {
        expect(formatter(-1000000000)).toBe('-1B');
        expect(formatter(-4560000000)).toBe('-4.56B');
      });
      it('formats numbers that are >= 1,000 & <= 1,000,000,000 as SI format with precision 3', () => {
        expect(formatter(-1000)).toBe('-1k');
        expect(formatter(-10001)).toBe('-10k');
        expect(formatter(-10100)).toBe('-10.1k');
        expect(formatter(-111000000)).toBe('-111M');
      });
      it('formats number that are >= 1 & < 1,000 as integer or float with at most 2 decimal points', () => {
        expect(formatter(-1)).toBe('-1');
        expect(formatter(-1)).toBe('-1');
        expect(formatter(-10)).toBe('-10');
        expect(formatter(-10)).toBe('-10');
        expect(formatter(-10.23432)).toBe('-10.23');
        expect(formatter(-274.2856)).toBe('-274.29');
        expect(formatter(-999)).toBe('-999');
      });
      it('formats numbers that are < 1 & >= 0.001 as float with at most 4 decimal points', () => {
        expect(formatter(-0.1)).toBe('-0.1');
        expect(formatter(-0.23)).toBe('-0.23');
        expect(formatter(-0.699)).toBe('-0.699');
        expect(formatter(-0.0023)).toBe('-0.0023');
        expect(formatter(-0.002300001)).toBe('-0.0023');
      });
      it('formats numbers that are < 0.001 & >= 0.000001 as micron', () => {
        expect(formatter(-0.0002300001)).toBe('-230µ');
        expect(formatter(-0.000023)).toBe('-23µ');
        expect(formatter(-0.000001)).toBe('-1µ');
      });
      it('formats numbers that are less than 0.000001 as SI format with precision 3', () => {
        expect(formatter(-0.0000001)).toBe('-100n');
      });
    });
  });

  describe('when options.signed is true, it adds + for positive numbers', () => {
    const formatter = createSmartNumberFormatter({ signed: true });
    it('formats 0 correctly', () => {
      expect(formatter(0)).toBe('0');
    });
    describe('for positive numbers', () => {
      it('formats billion with B in stead of G', () => {
        expect(formatter(1000000000)).toBe('+1B');
        expect(formatter(4560000000)).toBe('+4.56B');
      });
      it('formats numbers that are >= 1,000 & <= 1,000,000,000 as SI format with precision 3', () => {
        expect(formatter(1000)).toBe('+1k');
        expect(formatter(10001)).toBe('+10k');
        expect(formatter(10100)).toBe('+10.1k');
        expect(formatter(111000000)).toBe('+111M');
      });
      it('formats number that are >= 1 & < 1,000 as integer or float with at most 2 decimal points', () => {
        expect(formatter(1)).toBe('+1');
        expect(formatter(1)).toBe('+1');
        expect(formatter(10)).toBe('+10');
        expect(formatter(10)).toBe('+10');
        expect(formatter(10.23432)).toBe('+10.23');
        expect(formatter(274.2856)).toBe('+274.29');
        expect(formatter(999)).toBe('+999');
      });
      it('formats numbers that are < 1 & >= 0.001 as float with at most 4 decimal points', () => {
        expect(formatter(0.1)).toBe('+0.1');
        expect(formatter(0.23)).toBe('+0.23');
        expect(formatter(0.699)).toBe('+0.699');
        expect(formatter(0.0023)).toBe('+0.0023');
        expect(formatter(0.002300001)).toBe('+0.0023');
      });
      it('formats numbers that are < 0.001 & >= 0.000001 as micron', () => {
        expect(formatter(0.0002300001)).toBe('+230µ');
        expect(formatter(0.000023)).toBe('+23µ');
        expect(formatter(0.000001)).toBe('+1µ');
      });
      it('formats numbers that are less than 0.000001 as SI format with precision 3', () => {
        expect(formatter(0.0000001)).toBe('+100n');
      });
    });
  });
});
