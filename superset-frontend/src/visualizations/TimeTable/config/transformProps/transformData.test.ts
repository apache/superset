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
import transformData, { formatTimestamp } from './transformData';

const jan1 = 1704067200000; // 2024-01-01T00:00:00Z
const jan2 = 1704153600000; // 2024-01-02T00:00:00Z

test('formats timestamps like str(pandas.Timestamp)', () => {
  expect(formatTimestamp(jan1)).toEqual('2024-01-01 00:00:00');
});

test('pivots metrics into records keyed by time when ungrouped', () => {
  const { records, columns, is_group_by } = transformData(
    [
      { __timestamp: jan1, sum__num: 1, count: 2 },
      { __timestamp: jan2, sum__num: 3, count: 4 },
    ],
    [],
    ['sum__num', 'count'],
  );
  expect(is_group_by).toBe(false);
  expect(columns).toEqual(['count', 'sum__num']);
  expect(records).toEqual({
    '2024-01-01 00:00:00': { sum__num: 1, count: 2 },
    '2024-01-02 00:00:00': { sum__num: 3, count: 4 },
  });
});

test('pivots single metric per group value when grouped', () => {
  const { records, columns, is_group_by } = transformData(
    [
      { __timestamp: jan1, gender: 'boy', sum__num: 1 },
      { __timestamp: jan1, gender: 'girl', sum__num: 2 },
      { __timestamp: jan2, gender: 'boy', sum__num: 3 },
      // girl missing on jan2 -> padded with null
    ],
    ['gender'],
    ['sum__num'],
  );
  expect(is_group_by).toBe(true);
  expect(columns).toEqual(['boy', 'girl']);
  expect(records).toEqual({
    '2024-01-01 00:00:00': { boy: 1, girl: 2 },
    '2024-01-02 00:00:00': { boy: 3, girl: null },
  });
});

test('joins multi-column groups with the flat column separator', () => {
  const { columns } = transformData(
    [{ __timestamp: jan1, gender: 'boy', state: 'CA, USA', sum__num: 1 }],
    ['gender', 'state'],
    ['sum__num'],
  );
  expect(columns).toEqual(['boy, CA\\, USA']);
});
