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
import { formatSelectOptionsForRange, mainMetric } from 'src/modules/utils';

describe('utils', () => {
  describe('formatSelectOptionsForRange', () => {
    it('returns an array of arrays for the range specified (inclusive)', () => {
      expect(formatSelectOptionsForRange(0, 4)).toEqual([
        [0, '0'],
        [1, '1'],
        [2, '2'],
        [3, '3'],
        [4, '4'],
      ]);
      expect(formatSelectOptionsForRange(1, 2)).toEqual([
        [1, '1'],
        [2, '2'],
      ]);
    });
  });

  describe('mainMetric', () => {
    it('is null when no options', () => {
      expect(mainMetric([])).toBeUndefined();
      expect(mainMetric(null)).toBeUndefined();
    });
    it('prefers the "count" metric when first', () => {
      const metrics = [{ metric_name: 'count' }, { metric_name: 'foo' }];
      expect(mainMetric(metrics)).toBe('count');
    });
    it('prefers the "count" metric when not first', () => {
      const metrics = [{ metric_name: 'foo' }, { metric_name: 'count' }];
      expect(mainMetric(metrics)).toBe('count');
    });
    it('selects the first metric when "count" is not an option', () => {
      const metrics = [{ metric_name: 'foo' }, { metric_name: 'not_count' }];
      expect(mainMetric(metrics)).toBe('foo');
    });
  });
});
