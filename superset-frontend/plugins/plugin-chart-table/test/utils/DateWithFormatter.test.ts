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
import { getTimeFormatter } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import DateWithFormatter from '../../src/utils/DateWithFormatter';
import { formatColumnValue } from '../../src/utils/formatValue';
import { DataColumnMeta } from '../../src/types';

const formatter = getTimeFormatter('%H:%M:%S');

test('formats a parseable timestamp with the configured formatter', () => {
  const value = new DateWithFormatter('2017-02-14T11:22:33Z', { formatter });
  expect(String(value)).toBe('11:22:33');
});

test('renders the original value when it is not a parseable timestamp', () => {
  // Duration columns hold values like these. They produce an Invalid Date,
  // which used to be formatted and rendered as "NaN:NaN:NaN".
  ['00:01:54', '0 days 00:01:54'].forEach(input => {
    const value = new DateWithFormatter(input, { formatter });
    expect(Number.isNaN(value.getTime())).toBe(true);
    expect(String(value)).toBe(input);
  });
});

test('retains the original input when the formatter is String', () => {
  const value = new DateWithFormatter('00:01:54');
  expect(String(value)).toBe('00:01:54');
});

test('renders a duration cell through the column formatter without producing NaN', () => {
  // The cell text is produced by formatColumnValue, which hands the wrapped
  // value straight to the formatter rather than going through toString().
  const column: DataColumnMeta = {
    key: 'call_period',
    label: 'call_period',
    dataType: GenericDataType.Temporal,
    formatter,
    isNumeric: false,
  };
  const value = new DateWithFormatter('00:01:54', { formatter });

  expect(formatColumnValue(column, value)).toEqual([false, '00:01:54']);
});
