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

import { createD3NumberFormatter } from '@superset-ui/core';

describe('createD3NumberFormatter(config)', () => {
  it('requires config.formatString', () => {
    // @ts-ignore -- intentionally pass invalid input
    expect(() => createD3NumberFormatter({})).toThrow();
  });
  describe('config.formatString', () => {
    it('creates a NumberFormatter with the formatString as id', () => {
      const formatter = createD3NumberFormatter({ formatString: '.2f' });
      expect(formatter.id).toEqual('.2f');
    });
    describe('if it is valid d3 formatString', () => {
      it('uses d3.format(config.formatString) as format function', () => {
        const formatter = createD3NumberFormatter({ formatString: '.2f' });
        expect(formatter.format(100)).toEqual('100.00');
      });
    });
    describe('if it is invalid d3 formatString', () => {
      it('The format function displays error message', () => {
        const formatter = createD3NumberFormatter({
          formatString: 'i-am-groot',
        });
        expect(formatter.format(12345.67)).toEqual(
          '12345.67 (Invalid format: i-am-groot)',
        );
      });
      it('also set formatter.isInvalid to true', () => {
        const formatter = createD3NumberFormatter({
          formatString: 'i-am-groot',
        });
        expect(formatter.isInvalid).toEqual(true);
      });
    });
  });
  describe('config.label', () => {
    it('set label if specified', () => {
      const formatter = createD3NumberFormatter({
        formatString: '.2f',
        label: 'float formatter',
      });
      expect(formatter.label).toEqual('float formatter');
    });
  });
  describe('config.description', () => {
    it('set description if specified', () => {
      const formatter = createD3NumberFormatter({
        description: 'lorem ipsum',
        formatString: '.2f',
      });
      expect(formatter.description).toEqual('lorem ipsum');
    });
  });
  describe('config.locale', () => {
    it('supports locale customization such as currency', () => {
      const formatter = createD3NumberFormatter({
        description: 'lorem ipsum',
        formatString: '$.2f',
        locale: {
          decimal: '.',
          thousands: ',',
          grouping: [3],
          currency: ['€', ''],
        },
      });
      expect(formatter(200)).toEqual('€200.00');
    });
  });
});
