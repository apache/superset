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

import * as math from '../../src/helpers/math';

describe('math', () => {
  describe('sum', () => {
    it('should return the sum of two passed values', () => {
      expect(math.sum(5, 6)).toEqual(11);
    });
  });

  describe('difference', () => {
    it('should return the difference of two passed values', () => {
      expect(math.difference(5, 6)).toEqual(-1);
    });
  });

  describe('multiplication', () => {
    it('should return the multiplication of two passed values', () => {
      expect(math.multiplication(5, 6)).toEqual(30);
    });
  });

  describe('division', () => {
    it('should return the division of two passed values', () => {
      expect(math.division(4, 2)).toEqual(2);
    });
  });

  describe('remainder', () => {
    it('should return the remainder of two passed values', () => {
      expect(math.remainder(5, 3)).toEqual(2);
    });
  });

  describe('ceil', () => {
    it('should return the ceil value of a float number', () => {
      expect(math.ceil(5.666)).toEqual(6);
    });
  });

  describe('floor', () => {
    it('should return the floor value of a float number', () => {
      expect(math.floor(5.666)).toEqual(5);
    });
  });

  describe('abs', () => {
    it('should return the absolute value of a float number', () => {
      expect(math.abs(-5.666)).toEqual(5.666);
      expect(math.abs(+5.666)).toEqual(5.666);
    });
  });
});
