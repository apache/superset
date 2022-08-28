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

import * as conditionals from '../../src/helpers/conditionals';

describe('conditionals', () => {
  describe('eq', () => {
    it('should return true if provided params are equal and are of same type', () => {
      expect(conditionals.eq('1', '1')).toEqual(true);
    });

    it('should return false if provided params are equal but not of same type', () => {
      expect(conditionals.eq('1', 1)).toEqual(false);
    });
  });

  describe('neq', () => {
    it('should return true if provided params are not equal', () => {
      expect(conditionals.neq(4, 3)).toEqual(true);
    });

    it('should return false if provided params are equal and of same type', () => {
      expect(conditionals.neq(3, 3)).toEqual(false);
    });

    it('should return true if provided params are equal but of different types', () => {
      expect(conditionals.neq('3', 3)).toEqual(true);
    });
  });

  describe('lt', () => {
    it('should return true if param1 is smaller than param2', () => {
      expect(conditionals.lt(1, 2)).toEqual(true);
    });

    it('should return false if param1 is equal to param2', () => {
      expect(conditionals.lt(1, 1)).toEqual(false);
    });

    it('should return false if param2 is smaller than param1', () => {
      expect(conditionals.lt('31', '11')).toEqual(false); // Lexicographical Order
    });
  });

  describe('lte', () => {
    it('should return true if param1 is smaller than param2', () => {
      expect(conditionals.lte(1, 2)).toEqual(true);
    });

    it('should return true if param1 is equal to param2', () => {
      expect(conditionals.lte(1, 1)).toEqual(true);
    });

    it('should return false if param2 is smaller than param1', () => {
      expect(conditionals.lte(2, 1)).toEqual(false);
    });
  });

  describe('gt', () => {
    it('should return true if param1 is greater than param2', () => {
      expect(conditionals.gt(2, 1)).toEqual(true);
    });

    it('should return false if param1 is equal to param2', () => {
      expect(conditionals.gt(1, 1)).toEqual(false);
    });

    it('should return false if param2 is greater than param1', () => {
      expect(conditionals.gt('11', '31')).toEqual(false); // Lexicographical Order
    });
  });

  describe('gte', () => {
    it('should return true if param1 is greater than param2', () => {
      expect(conditionals.gte(2, 1)).toEqual(true);
    });

    it('should return true if param1 is equal to param2', () => {
      expect(conditionals.gte(1, 1)).toEqual(true);
    });

    it('should return false if param2 is greater than param1', () => {
      expect(conditionals.gte(1, 2)).toEqual(false); // Lexicographical Order
    });
  });

  describe('ifx', () => {
    it('should return value1 if the condition holds true', () => {
      expect(conditionals.ifx(2 > 1, 'value 1', 'value 2')).toEqual('value 1');
    });

    it('should return value2 if the condition results to false', () => {
      expect(conditionals.ifx(2 < 1, 'value 1', 'value 2')).toEqual('value 2');
    });
  });

  describe('not', () => {
    it('should return true if false is passed', () => {
      expect(conditionals.not(false)).toEqual(true);
    });

    it('should return false if true is passed', () => {
      expect(conditionals.not(true)).toEqual(false);
    });
  });

  describe('empty', () => {
    it('should return true for an empty array', () => {
      expect(conditionals.empty([])).toEqual(true);
    });

    it('should return false for a non-empty array', () => {
      expect(conditionals.empty([5, 6, 7])).toEqual(false);
    });

    it('should return true for a non-array', () => {
      expect(conditionals.empty('Foo Bar')).toEqual(true);
    });
  });

  describe('count', () => {
    it('should return the length of an array', () => {
      expect(conditionals.count([5, 6, 9])).toEqual(3);
    });

    it('should return false if param is not an array', () => {
      expect(conditionals.count({ foo: 'bar' })).toEqual(false);
    });
  });

  describe('and', () => {
    it('should return true if all the parameters are true', () => {
      const value1 = true;
      const value2 = true;
      const value3 = true;

      expect(conditionals.and(value1, value2, value3)).toEqual(true);
    });

    it('should return false if any of the parameters is false', () => {
      const value1 = false;
      const value2 = true;
      const value3 = true;

      expect(conditionals.and(value1, value2, value3)).toEqual(false);
    });
  });

  describe('or', () => {
    it('should return false if all the parameters are false', () => {
      const value1 = false;
      const value2 = false;
      const value3 = false;

      expect(conditionals.or(value1, value2, value3)).toEqual(false);
    });

    it('should return true if any of the param value is true', () => {
      const value1 = false;
      const value2 = false;
      const value3 = true;

      expect(conditionals.or(value1, value2, value3)).toEqual(true);
    });
  });

  describe('coalesce', () => {
    it('should return first non-false parameter', () => {
      expect(
        conditionals.coalesce(null, undefined, false, 0, 'Hello', 'world'),
      ).toEqual('Hello');
    });

    it('should work with only two parameters', () => {
      expect(conditionals.coalesce(null, 'Hello')).toEqual('Hello');
    });

    it('should work with a single parameter', () => {
      expect(conditionals.coalesce('Hello')).toEqual('Hello');
    });
  });
});
