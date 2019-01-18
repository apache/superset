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
import { getTimeOrNumberFormatter, formatLabel, tryNumify } from '../../../../src/visualizations/nvd3/utils';

describe('nvd3/utils', () => {
  describe('getTimeOrNumberFormatter(format)', () => {
    it('is a function', () => {
      expect(typeof getTimeOrNumberFormatter).toBe('function');
    });
    it('returns a date formatter if format is smart_date', () => {
      const time = new Date(Date.UTC(2018, 10, 21, 22, 11));
      expect(getTimeOrNumberFormatter('smart_date')(time)).toBe('10:11');
    });
    it('returns a number formatter otherwise', () => {
      expect(getTimeOrNumberFormatter('.3s')(3000000)).toBe('3.00M');
      expect(getTimeOrNumberFormatter()(3000100)).toBe('3.00M');
    });
  });

  describe('formatLabel()', () => {
    const verboseMap = {
      foo: 'Foo',
      bar: 'Bar',
    };

    it('formats simple labels', () => {
      expect(formatLabel('foo')).toBe('foo');
      expect(formatLabel(['foo'])).toBe('foo');
      expect(formatLabel(['foo', 'bar'])).toBe('foo, bar');
    });
    it('formats simple labels with lookups', () => {
      expect(formatLabel('foo', verboseMap)).toBe('Foo');
      expect(formatLabel('baz', verboseMap)).toBe('baz');
      expect(formatLabel(['foo'], verboseMap)).toBe('Foo');
      expect(formatLabel(['foo', 'bar', 'baz'], verboseMap)).toBe('Foo, Bar, baz');
    });
    it('deals with time shift properly', () => {
      expect(formatLabel(['foo', '1 hour offset'], verboseMap)).toBe('Foo, 1 hour offset');
      expect(formatLabel(['foo', 'bar', 'baz', '2 hours offset'], verboseMap)).toBe('Foo, Bar, baz, 2 hours offset');
    });
  });

  describe('tryNumify()', () => {
    it('tryNumify works as expected', () => {
      expect(tryNumify(5)).toBe(5);
      expect(tryNumify('5')).toBe(5);
      expect(tryNumify('5.1')).toBe(5.1);
      expect(tryNumify('a string')).toBe('a string');
    });
  });
});
