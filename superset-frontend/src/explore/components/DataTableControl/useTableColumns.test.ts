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
import { GenericDataType } from '@superset-ui/core';
import { renderHook } from '@testing-library/react-hooks';
import { BOOL_FALSE_DISPLAY, BOOL_TRUE_DISPLAY } from 'src/constants';
import { useTableColumns } from '.';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonObject = { [member: string]: any };

const asciiChars = [];
for (let i = 32; i < 127; i += 1) {
  asciiChars.push(String.fromCharCode(i));
}
const ASCII_KEY = asciiChars.join('');
const UNICODE_KEY = '你好. 吃了吗?';
const NUMTIME_KEY = 'numtime';
const STRTIME_KEY = 'strtime';
const NUMTIME_VALUE = 1640995200000;
const NUMTIME_FORMATTED_VALUE = '2022-01-01 00:00:00';
const STRTIME_VALUE = '2022-01-01';

const colnames = [
  'col01',
  'col02',
  ASCII_KEY,
  UNICODE_KEY,
  NUMTIME_KEY,
  STRTIME_KEY,
];
const coltypes = [
  GenericDataType.BOOLEAN,
  GenericDataType.BOOLEAN,
  GenericDataType.STRING,
  GenericDataType.STRING,
  GenericDataType.TEMPORAL,
  GenericDataType.TEMPORAL,
];

const cellValues = {
  col01: true,
  col02: false,
  [ASCII_KEY]: ASCII_KEY,
  [UNICODE_KEY]: UNICODE_KEY,
  [NUMTIME_KEY]: NUMTIME_VALUE,
  [STRTIME_KEY]: STRTIME_VALUE,
};

const data = [cellValues, cellValues, cellValues, cellValues];

const expectedDisplayValues = {
  col01: BOOL_TRUE_DISPLAY,
  col02: BOOL_FALSE_DISPLAY,
  [ASCII_KEY]: ASCII_KEY,
  [UNICODE_KEY]: UNICODE_KEY,
  [NUMTIME_KEY]: NUMTIME_FORMATTED_VALUE,
  [STRTIME_KEY]: STRTIME_VALUE,
};

test('useTableColumns with no options', () => {
  const hook = renderHook(() => useTableColumns(colnames, coltypes, data));
  expect(hook.result.current).toEqual([
    {
      Cell: expect.any(Function),
      Header: 'col01',
      accessor: expect.any(Function),
      id: 'col01',
    },
    {
      Cell: expect.any(Function),
      Header: 'col02',
      accessor: expect.any(Function),
      id: 'col02',
    },
    {
      Cell: expect.any(Function),
      Header: ASCII_KEY,
      accessor: expect.any(Function),
      id: ASCII_KEY,
    },
    {
      Cell: expect.any(Function),
      Header: UNICODE_KEY,
      accessor: expect.any(Function),
      id: UNICODE_KEY,
    },
    {
      Cell: expect.any(Function),
      Header: expect.objectContaining({
        type: expect.objectContaining({
          name: 'DataTableTemporalHeaderCell',
        }),
        props: expect.objectContaining({
          onTimeColumnChange: expect.any(Function),
        }),
      }),
      accessor: expect.any(Function),
      id: NUMTIME_KEY,
    },
    {
      Cell: expect.any(Function),
      Header: STRTIME_KEY,
      accessor: expect.any(Function),
      id: STRTIME_KEY,
    },
  ]);
  hook.result.current.forEach((col: JsonObject) => {
    expect(col.accessor(data[0])).toBe(data[0][col.id]);
  });

  hook.result.current.forEach((col: JsonObject) => {
    data.forEach(row => {
      expect(col.Cell({ value: row[col.id] })).toBe(
        expectedDisplayValues[col.id],
      );
    });
  });
});

test('useTableColumns with options', () => {
  const hook = renderHook(() =>
    useTableColumns(colnames, coltypes, data, undefined, true, {
      col01: { Header: 'Header' },
    }),
  );
  expect(hook.result.current).toEqual([
    {
      Cell: expect.any(Function),
      Header: 'Header',
      accessor: expect.any(Function),
      id: 'col01',
    },
    {
      Cell: expect.any(Function),
      Header: 'col02',
      accessor: expect.any(Function),
      id: 'col02',
    },
    {
      Cell: expect.any(Function),
      Header: ASCII_KEY,
      accessor: expect.any(Function),
      id: ASCII_KEY,
    },
    {
      Cell: expect.any(Function),
      Header: UNICODE_KEY,
      accessor: expect.any(Function),
      id: UNICODE_KEY,
    },
    {
      Cell: expect.any(Function),
      Header: expect.objectContaining({
        type: expect.objectContaining({
          name: 'DataTableTemporalHeaderCell',
        }),
        props: expect.objectContaining({
          onTimeColumnChange: expect.any(Function),
        }),
      }),
      accessor: expect.any(Function),
      id: NUMTIME_KEY,
    },
    {
      Cell: expect.any(Function),
      Header: STRTIME_KEY,
      accessor: expect.any(Function),
      id: STRTIME_KEY,
    },
  ]);
  hook.result.current.forEach((col: JsonObject) => {
    expect(col.accessor(data[0])).toBe(data[0][col.id]);
  });

  hook.result.current.forEach((col: JsonObject) => {
    data.forEach(row => {
      expect(col.Cell({ value: row[col.id] })).toBe(
        expectedDisplayValues[col.id],
      );
    });
  });
});
