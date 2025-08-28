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

import { mergeReplaceArrays } from './lodash';

describe('lodash utilities', () => {
  describe('mergeReplaceArrays', () => {
    it('should merge objects and replace arrays', () => {
      const obj1 = { a: [1, 2], b: { c: 3 } };
      const obj2 = { a: [4, 5], b: { d: 6 } };

      const result = mergeReplaceArrays(obj1, obj2);

      expect(result).toEqual({
        a: [4, 5], // array replaced
        b: { c: 3, d: 6 }, // objects merged
      });
    });

    it('should handle precedence with multiple sources', () => {
      const base = { x: { y: 1 }, z: [1] };
      const override1 = { x: { y: 2 }, z: [2, 3] };
      const override2 = { x: { y: 3 }, z: [4] };

      const result = mergeReplaceArrays(base, override1, override2);

      expect(result).toEqual({
        x: { y: 3 }, // last wins
        z: [4], // array replaced by last
      });
    });

    it('should handle empty and null values', () => {
      const base = { a: [1], b: { x: 1 } };
      const override = { a: [], b: { x: null } };

      const result = mergeReplaceArrays(base, override);

      expect(result).toEqual({
        a: [], // empty array replaces
        b: { x: null }, // null overrides
      });
    });
  });
});
