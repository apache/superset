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
import {
  applyFormattingToTabularData,
  optionFromValue,
  prepareCopyToClipboardTabularData,
  NULL_STRING,
} from 'src/utils/common';

describe('utils/common', () => {
  describe('optionFromValue', () => {
    it('converts values as expected', () => {
      expect(optionFromValue(false)).toEqual({
        value: false,
        label: '<false>',
      });
      expect(optionFromValue(true)).toEqual({ value: true, label: '<true>' });
      expect(optionFromValue(null)).toEqual({
        value: NULL_STRING,
        label: NULL_STRING,
      });
      expect(optionFromValue('')).toEqual({
        value: '',
        label: '<empty string>',
      });
      expect(optionFromValue('foo')).toEqual({ value: 'foo', label: 'foo' });
      expect(optionFromValue(5)).toEqual({ value: 5, label: '5' });
    });
  });
  describe('prepareCopyToClipboardTabularData', () => {
    it('converts empty array', () => {
      const array = [];
      expect(prepareCopyToClipboardTabularData(array)).toEqual('');
    });
    it('converts non empty array', () => {
      const array = [
        { column1: 'lorem', column2: 'ipsum' },
        { column1: 'dolor', column2: 'sit', column3: 'amet' },
      ];
      expect(prepareCopyToClipboardTabularData(array)).toEqual(
        'lorem\tipsum\ndolor\tsit\tamet\n',
      );
    });
  });
  describe('applyFormattingToTabularData', () => {
    it('does not mutate empty array', () => {
      const data = [];
      expect(applyFormattingToTabularData(data)).toEqual(data);
    });
    it('does not mutate array without temporal column', () => {
      const data = [
        { column1: 'lorem', column2: 'ipsum' },
        { column1: 'dolor', column2: 'sit', column3: 'amet' },
      ];
      expect(applyFormattingToTabularData(data)).toEqual(data);
    });
    it('changes formatting of temporal column', () => {
      const originalData = [
        { __timestamp: 1594285437771, column1: 'lorem' },
        { __timestamp: 1594285441675, column1: 'ipsum' },
      ];
      const expectedData = [
        { __timestamp: '2020-07-09 09:03:57', column1: 'lorem' },
        { __timestamp: '2020-07-09 09:04:01', column1: 'ipsum' },
      ];
      expect(applyFormattingToTabularData(originalData)).toEqual(expectedData);
    });
  });
});
