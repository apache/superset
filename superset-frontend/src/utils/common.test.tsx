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
  TRUE_STRING,
  FALSE_STRING,
  TabularDataRow,
  ColumnDefinition,
} from 'src/utils/common';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('utils/common', () => {
  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('optionFromValue', () => {
    test('converts values as expected', () => {
      expect(optionFromValue(false)).toEqual({
        value: false,
        label: FALSE_STRING,
      });
      expect(optionFromValue(true)).toEqual({
        value: true,
        label: TRUE_STRING,
      });
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
  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('prepareCopyToClipboardTabularData', () => {
    test('converts empty array', () => {
      const data: TabularDataRow[] = [];
      const columns: string[] = [];
      expect(prepareCopyToClipboardTabularData(data, columns)).toEqual('');
    });
    test('converts non empty array', () => {
      const data: TabularDataRow[] = [
        { column1: 'lorem', column2: 'ipsum' },
        { column1: 'dolor', column2: 'sit', column3: 'amet' },
      ];
      const columns: string[] = ['column1', 'column2', 'column3'];
      expect(prepareCopyToClipboardTabularData(data, columns)).toEqual(
        'column1\tcolumn2\tcolumn3\nlorem\tipsum\t\ndolor\tsit\tamet\n',
      );
    });
    test('includes 0 values and handle column objects', () => {
      const data: TabularDataRow[] = [
        { column1: 0, column2: 0 },
        { column1: 1, column2: -1, 0: 0 },
      ];
      const columns: ColumnDefinition[] = [
        { name: 'column1' },
        { name: 'column2' },
        { name: '0' },
      ];
      expect(prepareCopyToClipboardTabularData(data, columns)).toEqual(
        'column1\tcolumn2\t0\n0\t0\t\n1\t-1\t0\n',
      );
    });
  });
  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('applyFormattingToTabularData', () => {
    test('does not mutate empty array', () => {
      const data: TabularDataRow[] = [];
      expect(applyFormattingToTabularData(data, [])).toEqual(data);
    });
    test('does not mutate array without temporal column', () => {
      const data: TabularDataRow[] = [
        { column1: 'lorem', column2: 'ipsum' },
        { column1: 'dolor', column2: 'sit', column3: 'amet' },
      ];
      expect(applyFormattingToTabularData(data, [])).toEqual(data);
    });
    test('changes formatting of columns selected for formatting', () => {
      const originalData: TabularDataRow[] = [
        {
          __timestamp: null,
          column1: 'lorem',
          column2: 1590014060000,
          column3: 1507680000000,
        },
        {
          __timestamp: 0,
          column1: 'ipsum',
          column2: 1590075817000,
          column3: 1513641600000,
        },
        {
          __timestamp: 1594285437771,
          column1: 'dolor',
          column2: 1591062977000,
          column3: 1516924800000,
        },
        {
          __timestamp: 1594285441675,
          column1: 'sit',
          column2: 1591397351000,
          column3: 1518566400000,
        },
      ];
      const timeFormattedColumns: string[] = ['__timestamp', 'column3'];
      const expectedData: TabularDataRow[] = [
        {
          __timestamp: null,
          column1: 'lorem',
          column2: 1590014060000,
          column3: '2017-10-11 00:00:00',
        },
        {
          __timestamp: '1970-01-01 00:00:00',
          column1: 'ipsum',
          column2: 1590075817000,
          column3: '2017-12-19 00:00:00',
        },
        {
          __timestamp: '2020-07-09 09:03:57',
          column1: 'dolor',
          column2: 1591062977000,
          column3: '2018-01-26 00:00:00',
        },
        {
          __timestamp: '2020-07-09 09:04:01',
          column1: 'sit',
          column2: 1591397351000,
          column3: '2018-02-14 00:00:00',
        },
      ];
      expect(
        applyFormattingToTabularData(originalData, timeFormattedColumns),
      ).toEqual(expectedData);
    });
  });
});
