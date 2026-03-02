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
import { renderHook } from '@testing-library/react-hooks';
import { GenericDataType } from '@apache-superset/core/api/core';
import { useColDefs } from '../../src/utils/useColDefs';
import { InputColumn } from '../../src/types';

function makeColumn(overrides: Partial<InputColumn> = {}): InputColumn {
  return {
    key: 'test_col',
    label: 'Test Column',
    dataType: GenericDataType.String,
    isNumeric: false,
    isMetric: false,
    isPercentMetric: false,
    config: {},
    ...overrides,
  };
}

const defaultProps = {
  data: [{ test_col: 'value' }],
  serverPagination: false,
  isRawRecords: true,
  defaultAlignPN: false,
  showCellBars: false,
  colorPositiveNegative: false,
  totals: undefined,
  columnColorFormatters: [],
  allowRearrangeColumns: false,
  basicColorFormatters: [],
  isUsingTimeComparison: false,
  emitCrossFilters: false,
  alignPositiveNegative: false,
  slice_id: 1,
};

test('boolean columns use agCheckboxCellRenderer', () => {
  const booleanCol = makeColumn({
    key: 'is_active',
    label: 'Is Active',
    dataType: GenericDataType.Boolean,
  });

  const { result } = renderHook(() =>
    useColDefs({
      ...defaultProps,
      columns: [booleanCol],
      data: [{ is_active: true }, { is_active: false }],
    }),
  );

  const colDef = result.current[0];
  expect(colDef.cellRenderer).toBe('agCheckboxCellRenderer');
  expect(colDef.cellRendererParams).toEqual({ disabled: true });
  expect(colDef.cellDataType).toBe('boolean');
});

test('string columns use custom TextCellRenderer', () => {
  const stringCol = makeColumn({
    key: 'name',
    label: 'Name',
    dataType: GenericDataType.String,
  });

  const { result } = renderHook(() =>
    useColDefs({
      ...defaultProps,
      columns: [stringCol],
      data: [{ name: 'Alice' }],
    }),
  );

  const colDef = result.current[0];
  expect(colDef.cellRenderer).toBeInstanceOf(Function);
  expect(colDef.cellDataType).toBe('text');
});

test('numeric columns use custom NumericCellRenderer', () => {
  const numericCol = makeColumn({
    key: 'count',
    label: 'Count',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
  });

  const { result } = renderHook(() =>
    useColDefs({
      ...defaultProps,
      columns: [numericCol],
      data: [{ count: 42 }],
    }),
  );

  const colDef = result.current[0];
  expect(colDef.cellRenderer).toBeInstanceOf(Function);
  expect(colDef.cellDataType).toBe('number');
});

test('temporal columns use custom TextCellRenderer', () => {
  const temporalCol = makeColumn({
    key: 'created_at',
    label: 'Created At',
    dataType: GenericDataType.Temporal,
  });

  const { result } = renderHook(() =>
    useColDefs({
      ...defaultProps,
      columns: [temporalCol],
      data: [{ created_at: '2024-01-01' }],
    }),
  );

  const colDef = result.current[0];
  expect(colDef.cellRenderer).toBeInstanceOf(Function);
  expect(colDef.cellDataType).toBe('date');
});
