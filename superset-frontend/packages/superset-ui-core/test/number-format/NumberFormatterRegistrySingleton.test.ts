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
  NumberFormatterRegistry,
  getNumberFormatterRegistry,
  getNumberFormatter,
  formatNumber,
} from '@superset-ui/core';

describe('NumberFormatterRegistrySingleton', () => {
  describe('getNumberFormatterRegistry()', () => {
    it('returns a NumberFormatterRegisry', () => {
      expect(getNumberFormatterRegistry()).toBeInstanceOf(
        NumberFormatterRegistry,
      );
    });
  });
  describe('getNumberFormatter(format)', () => {
    it('returns a format function', () => {
      const format = getNumberFormatter('.3s');
      expect(format(12345)).toEqual('12.3k');
    });
    it('returns a format function even given invalid format', () => {
      const format = getNumberFormatter('xkcd');
      expect(format(12345)).toEqual('12345 (Invalid format: xkcd)');
    });
    it('falls back to default format if format is not specified', () => {
      const formatter = getNumberFormatter();
      expect(formatter.format(100)).toEqual('100');
    });
  });
  describe('formatNumber(format, value)', () => {
    it('format the given number using the specified format', () => {
      const output = formatNumber('.3s', 12345);
      expect(output).toEqual('12.3k');
    });
    it('falls back to the default formatter if the format is undefined', () => {
      expect(formatNumber(undefined, 1000)).toEqual('1k');
    });
  });
});
