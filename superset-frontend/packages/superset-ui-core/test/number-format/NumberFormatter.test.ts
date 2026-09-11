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

import { NumberFormatter } from '@superset-ui/core';

describe('NumberFormatter', () => {
  describe('new NumberFormatter(config)', () => {
    test('requires config.id', () => {
      expect(
        () =>
          // @ts-expect-error
          new NumberFormatter({
            formatFunc: () => '',
          }),
      ).toThrow();
    });
    test('requires config.formatFunc', () => {
      expect(
        () =>
          // @ts-expect-error
          new NumberFormatter({
            id: 'my_format',
          }),
      ).toThrow();
    });
  });
  describe('formatter is also a format function itself', () => {
    const formatter = new NumberFormatter({
      id: 'fixed_3',
      formatFunc: value => value.toFixed(3),
    });
    test('returns formatted value', () => {
      expect(formatter(12345.67)).toEqual('12345.670');
    });
    test('formatter(value) is the same with formatter.format(value)', () => {
      const value = 12345.67;
      expect(formatter(value)).toEqual(formatter.format(value));
    });
  });
  describe('.format(value)', () => {
    const formatter = new NumberFormatter({
      id: 'fixed_3',
      formatFunc: value => value.toFixed(3),
    });
    test('handles null', () => {
      expect(formatter.format(null)).toEqual('null');
    });
    test('handles undefined', () => {
      expect(formatter.format(undefined)).toEqual('undefined');
    });
    test('handles NaN', () => {
      expect(formatter.format(NaN)).toEqual('NaN');
    });
    test('handles positive and negative infinity', () => {
      expect(formatter.format(Number.POSITIVE_INFINITY)).toEqual('∞');
      expect(formatter.format(Number.NEGATIVE_INFINITY)).toEqual('-∞');
    });
    test('otherwise returns formatted value', () => {
      expect(formatter.format(12345.67)).toEqual('12345.670');
    });
  });
  describe('.preview(value)', () => {
    const formatter = new NumberFormatter({
      id: 'fixed_2',
      formatFunc: value => value.toFixed(2),
    });
    test('returns string comparing value before and after formatting', () => {
      expect(formatter.preview(100)).toEqual('100 => 100.00');
    });
    test('uses the default preview value if not specified', () => {
      expect(formatter.preview()).toEqual('12345.432 => 12345.43');
    });
  });
});
