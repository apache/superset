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
import { GenericDataType } from '@apache-superset/core/common';
import {
  supersetTheme,
  ThemeProvider,
  type SupersetTheme,
} from '@apache-superset/core/theme';
import { ObjectFormattingEnum } from '@superset-ui/chart-controls';
import tinycolor from 'tinycolor2';
import { createElement, type ComponentProps, ReactNode } from 'react';
import { useColDefs } from '../../src/utils/useColDefs';
import { InputColumn } from '../../src/types';
import { PIVOT_COL_ID } from '../../src/consts';

type TestCellStyleFunc = (params: unknown) => unknown;

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

function getCellStyleFunction(cellStyle: unknown): TestCellStyleFunc {
  expect(typeof cellStyle).toBe('function');
  return cellStyle as TestCellStyleFunc;
}

function getCellStyleResult(
  cellStyle: TestCellStyleFunc,
  overrides: Record<string, unknown> = {},
) {
  return cellStyle({
    value: 42,
    colDef: { field: 'count' },
    rowIndex: 0,
    node: {},
    ...overrides,
  } as never);
}

function getExpectedTextColor(
  result: { backgroundColor?: string; color?: string },
  surfaceColor: string,
) {
  if (result.color) {
    const parsedColor = tinycolor(result.color);
    return parsedColor.isValid()
      ? parsedColor.setAlpha(1).toRgbString()
      : result.color;
  }

  if (!result.backgroundColor) {
    return undefined;
  }

  const background = tinycolor(result.backgroundColor);
  const surface = tinycolor(surfaceColor);
  if (!background.isValid() || !surface.isValid()) {
    return undefined;
  }

  const { r: bgR, g: bgG, b: bgB, a: bgAlpha } = background.toRgb();
  const { r: surfaceR, g: surfaceG, b: surfaceB } = surface.toRgb();
  const alpha = bgAlpha ?? 1;

  return tinycolor
    .mostReadable(
      tinycolor({
        r: bgR * alpha + surfaceR * (1 - alpha),
        g: bgG * alpha + surfaceG * (1 - alpha),
        b: bgB * alpha + surfaceB * (1 - alpha),
      }),
      [
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 },
      ],
      {
        includeFallbackColors: true,
        level: 'AA',
        size: 'small',
      },
    )
    .toRgbString();
}

function makeThemeWrapper(theme: SupersetTheme) {
  return function ThemeWrapper({ children }: { children?: ReactNode }) {
    return createElement(
      ThemeProvider,
      { theme } as ComponentProps<typeof ThemeProvider>,
      children,
    );
  };
}

const defaultThemeWrapper = makeThemeWrapper(supersetTheme);

const defaultProps = {
  data: [{ test_col: 'value' }],
  serverPagination: false,
  serverPaginationData: {},
  serverPageLength: 0,
  showNumberedColumn: false,
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

const basePropsNumericColumns = {
  ...defaultProps,
  columns: [makeColumn({ key: 'a', label: 'A' })],
  data: [{ a: 1 }, { a: 2 }, { a: 3 }],
};

test('boolean columns use agCheckboxCellRenderer', () => {
  const booleanCol = makeColumn({
    key: 'is_active',
    label: 'Is Active',
    dataType: GenericDataType.Boolean,
  });

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [booleanCol],
        data: [{ is_active: true }, { is_active: false }],
      }),
    { wrapper: defaultThemeWrapper },
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

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [stringCol],
        data: [{ name: 'Alice' }],
      }),
    { wrapper: defaultThemeWrapper },
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

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }],
      }),
    { wrapper: defaultThemeWrapper },
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

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [temporalCol],
        data: [{ created_at: '2024-01-01' }],
      }),
    { wrapper: defaultThemeWrapper },
  );

  const colDef = result.current[0];
  expect(colDef.cellRenderer).toBeInstanceOf(Function);
  expect(colDef.cellDataType).toBe('date');
});

test('cellStyle derives readable text color from dark background formatting', () => {
  const numericCol = makeColumn({
    key: 'count',
    label: 'Count',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
  });

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }],
        columnColorFormatters: [
          {
            column: 'count',
            objectFormatting: ObjectFormattingEnum.BACKGROUND_COLOR,
            getColorFromValue: (value: unknown) =>
              value === 42 ? '#111111' : undefined,
          },
        ],
      }),
    { wrapper: defaultThemeWrapper },
  );

  const colDef = result.current[0];
  const cellStyle = getCellStyleFunction(colDef.cellStyle);
  expect(
    cellStyle({
      value: 42,
      colDef: { field: 'count' },
      rowIndex: 0,
      node: {},
    } as never),
  ).toMatchObject({
    backgroundColor: '#111111',
    color: '',
    '--ag-cell-value-color': 'rgb(255, 255, 255)',
    textAlign: 'right',
  });
});

test('cellStyle keeps explicit text color over adaptive contrast', () => {
  const numericCol = makeColumn({
    key: 'count',
    label: 'Count',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
  });

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }],
        columnColorFormatters: [
          {
            column: 'count',
            objectFormatting: ObjectFormattingEnum.BACKGROUND_COLOR,
            getColorFromValue: (value: unknown) =>
              value === 42 ? '#111111' : undefined,
          },
          {
            column: 'count',
            objectFormatting: ObjectFormattingEnum.TEXT_COLOR,
            getColorFromValue: (value: unknown) =>
              value === 42 ? '#ace1c40d' : undefined,
          },
        ],
      }),
    { wrapper: defaultThemeWrapper },
  );

  const colDef = result.current[0];
  const cellStyle = getCellStyleFunction(colDef.cellStyle);
  expect(
    cellStyle({
      value: 42,
      colDef: { field: 'count' },
      rowIndex: 0,
      node: {},
    } as never),
  ).toMatchObject({
    backgroundColor: '#111111',
    color: '',
    '--ag-cell-value-color': 'rgb(172, 225, 196)',
    textAlign: 'right',
  });
});

test('cellStyle treats legacy toTextColor formatters as text color', () => {
  const numericCol = makeColumn({
    key: 'count',
    label: 'Count',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
  });

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }],
        columnColorFormatters: [
          {
            column: 'count',
            objectFormatting: ObjectFormattingEnum.BACKGROUND_COLOR,
            getColorFromValue: (value: unknown) =>
              value === 42 ? '#111111' : undefined,
          },
          {
            column: 'count',
            toTextColor: true,
            getColorFromValue: (value: unknown) =>
              value === 42 ? '#ace1c40d' : undefined,
          },
        ],
      }),
    { wrapper: defaultThemeWrapper },
  );

  const colDef = result.current[0];
  const cellStyle = getCellStyleFunction(colDef.cellStyle);
  expect(getCellStyleResult(cellStyle)).toMatchObject({
    backgroundColor: '#111111',
    color: '',
    '--ag-cell-value-color': 'rgb(172, 225, 196)',
    textAlign: 'right',
  });
});

test('cellStyle uses caller-provided surface color for adaptive contrast', () => {
  const numericCol = makeColumn({
    key: 'count',
    label: 'Count',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
  });
  const backgroundColor = 'rgba(0, 0, 0, 0.4)';

  const { result: lightResult } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }],
        columnColorFormatters: [
          {
            column: 'count',
            objectFormatting: ObjectFormattingEnum.BACKGROUND_COLOR,
            getColorFromValue: (value: unknown) =>
              value === 42 ? backgroundColor : undefined,
          },
        ],
      }),
    {
      wrapper: makeThemeWrapper({
        ...supersetTheme,
        colorBgBase: '#ffffff',
      }),
    },
  );

  const { result: darkResult } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }],
        columnColorFormatters: [
          {
            column: 'count',
            objectFormatting: ObjectFormattingEnum.BACKGROUND_COLOR,
            getColorFromValue: (value: unknown) =>
              value === 42 ? backgroundColor : undefined,
          },
        ],
      }),
    {
      wrapper: makeThemeWrapper({
        ...supersetTheme,
        colorBgBase: '#000000',
      }),
    },
  );

  const lightCellStyle = getCellStyleFunction(lightResult.current[0].cellStyle);
  const darkCellStyle = getCellStyleFunction(darkResult.current[0].cellStyle);

  expect(getCellStyleResult(lightCellStyle)).toMatchObject({
    backgroundColor,
    color: '',
    '--ag-cell-value-color': getExpectedTextColor(
      { backgroundColor },
      '#ffffff',
    ),
  });
  expect(getCellStyleResult(darkCellStyle)).toMatchObject({
    backgroundColor,
    color: '',
    '--ag-cell-value-color': getExpectedTextColor(
      { backgroundColor },
      '#000000',
    ),
  });
  expect(getCellStyleResult(lightCellStyle)).not.toEqual(
    getCellStyleResult(darkCellStyle),
  );
});

test('cellStyle uses striped odd-row surface for adaptive contrast', () => {
  const numericCol = makeColumn({
    key: 'count',
    label: 'Count',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
  });
  const backgroundColor = 'rgba(0, 0, 0, 0.4)';

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }, { count: 43 }],
        columnColorFormatters: [
          {
            column: 'count',
            objectFormatting: ObjectFormattingEnum.BACKGROUND_COLOR,
            getColorFromValue: (value: unknown) =>
              typeof value === 'number' ? backgroundColor : undefined,
          },
        ],
      }),
    {
      wrapper: makeThemeWrapper({
        ...supersetTheme,
        colorBgBase: '#ffffff',
        colorFillQuaternary: '#000000',
      }),
    },
  );

  const cellStyle = getCellStyleFunction(result.current[0].cellStyle);

  expect(
    getCellStyleResult(cellStyle, {
      rowIndex: 0,
    }),
  ).toMatchObject({
    backgroundColor,
    color: '',
    '--ag-cell-value-color': getExpectedTextColor(
      { backgroundColor },
      '#ffffff',
    ),
  });
  expect(
    getCellStyleResult(cellStyle, {
      rowIndex: 1,
    }),
  ).toMatchObject({
    backgroundColor,
    color: '',
    '--ag-cell-value-color': getExpectedTextColor(
      { backgroundColor },
      '#000000',
    ),
  });
});

test('cellStyle exposes hover-specific adaptive contrast for formatted cells', () => {
  const numericCol = makeColumn({
    key: 'count',
    label: 'Count',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
  });
  const backgroundColor = 'rgba(0, 0, 0, 0.4)';

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }],
        columnColorFormatters: [
          {
            column: 'count',
            objectFormatting: ObjectFormattingEnum.BACKGROUND_COLOR,
            getColorFromValue: (value: unknown) =>
              value === 42 ? backgroundColor : undefined,
          },
        ],
      }),
    {
      wrapper: makeThemeWrapper({
        ...supersetTheme,
        colorBgBase: '#ffffff',
        colorFillSecondary: '#000000',
      }),
    },
  );

  const cellStyle = getCellStyleFunction(result.current[0].cellStyle);
  expect(getCellStyleResult(cellStyle)).toMatchObject({
    backgroundColor,
    color: '',
    '--ag-cell-value-color': getExpectedTextColor(
      { backgroundColor },
      '#ffffff',
    ),
    '--ag-cell-value-hover-color': getExpectedTextColor(
      { backgroundColor },
      '#000000',
    ),
  });
});

test('cellStyle resets inline text color variables when no formatter matches', () => {
  const numericCol = makeColumn({
    key: 'count',
    label: 'Count',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
  });

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }],
        columnColorFormatters: [
          {
            column: 'count',
            objectFormatting: ObjectFormattingEnum.BACKGROUND_COLOR,
            getColorFromValue: () => undefined,
          },
        ],
      }),
    {
      wrapper: makeThemeWrapper({
        ...supersetTheme,
        colorPrimaryText: '#123456',
      }),
    },
  );

  const cellStyle = getCellStyleFunction(result.current[0].cellStyle);
  const cellStyleResult = getCellStyleResult(cellStyle) as {
    backgroundColor: string;
    color?: string;
    textAlign: string;
  };
  expect(cellStyleResult).toMatchObject({
    backgroundColor: '',
    color: '',
    '--ag-cell-value-color': '',
    '--ag-cell-value-hover-color': '',
    textAlign: 'right',
  });
});

test('cellStyle preserves invalid explicit text color', () => {
  const numericCol = makeColumn({
    key: 'count',
    label: 'Count',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
  });

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }],
        columnColorFormatters: [
          {
            column: 'count',
            objectFormatting: ObjectFormattingEnum.TEXT_COLOR,
            getColorFromValue: (value: unknown) =>
              value === 42 ? 'not-a-color' : undefined,
          },
        ],
      }),
    { wrapper: defaultThemeWrapper },
  );

  const cellStyle = getCellStyleFunction(result.current[0].cellStyle);
  expect(getCellStyleResult(cellStyle)).toMatchObject({
    backgroundColor: '',
    color: '',
    '--ag-cell-value-color': 'not-a-color',
    '--ag-cell-value-hover-color': 'not-a-color',
  });
});

test('cellStyle ignores cell-bar formatters for text and background resolution', () => {
  const numericCol = makeColumn({
    key: 'count',
    label: 'Count',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
  });

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }],
        columnColorFormatters: [
          {
            column: 'count',
            objectFormatting: ObjectFormattingEnum.CELL_BAR,
            getColorFromValue: (value: unknown) =>
              value === 42 ? '#11111199' : undefined,
          },
        ],
      }),
    {
      wrapper: makeThemeWrapper({
        ...supersetTheme,
        colorPrimaryText: '#654321',
      }),
    },
  );

  const cellStyle = getCellStyleFunction(result.current[0].cellStyle);
  const cellStyleResult = getCellStyleResult(cellStyle) as {
    backgroundColor: string;
    color?: string;
  };
  expect(cellStyleResult).toMatchObject({
    backgroundColor: '',
    color: '',
    '--ag-cell-value-color': '',
    '--ag-cell-value-hover-color': '',
  });
});

test('cellStyle lets basic color formatters override column formatter background', () => {
  const numericCol = makeColumn({
    key: 'count',
    label: 'Count',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
    metricName: 'sum__count',
  });

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }],
        isUsingTimeComparison: true,
        columnColorFormatters: [
          {
            column: 'count',
            objectFormatting: ObjectFormattingEnum.BACKGROUND_COLOR,
            getColorFromValue: (value: unknown) =>
              value === 42 ? '#111111' : undefined,
          },
        ],
        basicColorFormatters: [
          {
            sum__count: {
              backgroundColor: '#abcdef',
              arrowColor: 'Green',
              mainArrow: 'up',
            },
          },
        ],
      }),
    { wrapper: defaultThemeWrapper },
  );

  const cellStyle = getCellStyleFunction(result.current[0].cellStyle);
  expect(getCellStyleResult(cellStyle)).toMatchObject({
    backgroundColor: '#abcdef',
    color: '',
    '--ag-cell-value-color': getExpectedTextColor(
      { backgroundColor: '#abcdef' },
      '#ffffff',
    ),
  });
});

test('cellStyle ignores basic color formatters for pinned bottom rows', () => {
  const numericCol = makeColumn({
    key: 'count',
    label: 'Count',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
    metricName: 'sum__count',
  });

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }],
        isUsingTimeComparison: true,
        basicColorFormatters: [
          {
            sum__count: {
              backgroundColor: '#abcdef',
              arrowColor: 'Green',
              mainArrow: 'up',
            },
          },
        ],
      }),
    { wrapper: defaultThemeWrapper },
  );

  const cellStyle = getCellStyleFunction(result.current[0].cellStyle);
  expect(
    getCellStyleResult(cellStyle, {
      node: { rowPinned: 'bottom' },
    }),
  ).toMatchObject({
    backgroundColor: '',
  });
});

test('cellStyle defaults non-numeric columns to left alignment', () => {
  const stringCol = makeColumn({
    key: 'name',
    label: 'Name',
    dataType: GenericDataType.String,
  });

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [stringCol],
        data: [{ name: 'Alice' }],
      }),
    { wrapper: defaultThemeWrapper },
  );

  const cellStyle = getCellStyleFunction(result.current[0].cellStyle);
  expect(
    cellStyle({
      value: 'Alice',
      colDef: { field: 'name' },
      rowIndex: 0,
      node: {},
    } as never),
  ).toMatchObject({
    textAlign: 'left',
  });
});

test('cellStyle respects explicit horizontal alignment overrides', () => {
  const numericCol = makeColumn({
    key: 'count',
    label: 'Count',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
    config: {
      horizontalAlign: 'center',
    },
  });

  const { result } = renderHook(
    () =>
      useColDefs({
        ...defaultProps,
        columns: [numericCol],
        data: [{ count: 42 }],
      }),
    { wrapper: defaultThemeWrapper },
  );

  const cellStyle = getCellStyleFunction(result.current[0].cellStyle);
  expect(getCellStyleResult(cellStyle)).toMatchObject({
    textAlign: 'center',
  });
});

test('is not added when showNumberedColumn is false', () => {
  const { result } = renderHook(
    () => useColDefs({ ...basePropsNumericColumns, showNumberedColumn: false }),
    { wrapper: defaultThemeWrapper },
  );
  expect(result.current.some(col => col.field === PIVOT_COL_ID)).toBe(false);
  expect(result.current.length).toBe(1);
});

test('is added as first column when showNumberedColumn is true', () => {
  const { result } = renderHook(
    () => useColDefs({ ...basePropsNumericColumns, showNumberedColumn: true }),
    { wrapper: defaultThemeWrapper },
  );
  expect(result.current[0].field).toBe(PIVOT_COL_ID);
  expect(result.current[0].headerName).toBe('№');
  expect(result.current.length).toBe(2);
});

test('width defaults to 36 when maxVisibleRowNumber is 0 (empty data)', () => {
  const emptyProps = {
    ...basePropsNumericColumns,
    data: [],
    showNumberedColumn: true,
  };
  const { result } = renderHook(() => useColDefs(emptyProps), {
    wrapper: defaultThemeWrapper,
  });
  expect(result.current[0].width).toBe(36);
});

test('width uses server pagination row count when available', () => {
  const serverProps = {
    ...basePropsNumericColumns,
    serverPagination: true,
    serverPaginationData: { currentPage: 0, pageSize: 5 },
    data: [{ a: 1 }, { a: 2 }],
    showNumberedColumn: true,
  };
  const { result } = renderHook(() => useColDefs(serverProps), {
    wrapper: defaultThemeWrapper,
  });

  expect(result.current[0].width).toBe(36);

  const laterPageProps = {
    ...serverProps,
    serverPaginationData: { currentPage: 3, pageSize: 5 },
    data: [{ a: 21 }, { a: 22 }],
  };
  const { result: resultLater } = renderHook(() => useColDefs(laterPageProps), {
    wrapper: defaultThemeWrapper,
  });
  expect(resultLater.current[0].width).toBe(42);
});

test('valueGetter returns row numbers without server pagination', () => {
  const { result } = renderHook(
    () => useColDefs({ ...basePropsNumericColumns, showNumberedColumn: true }),
    { wrapper: defaultThemeWrapper },
  );
  const colDef = result.current[0];
  const { valueGetter } = colDef;
  expect(valueGetter).toBeDefined();
  expect(typeof valueGetter).toBe('function');

  const getter = valueGetter as (params: {
    node?: { rowIndex?: number };
    data?: Record<string, unknown>;
  }) => number;

  const params = (rowIndex: number) => ({
    node: { rowIndex },
    data: basePropsNumericColumns.data[rowIndex],
  });

  expect(getter(params(0))).toBe(1);
  expect(getter(params(1))).toBe(2);
  expect(getter(params(2))).toBe(3);
});

test('valueGetter respects server pagination', () => {
  const serverProps = {
    ...basePropsNumericColumns,
    serverPagination: true,
    serverPaginationData: { currentPage: 2, pageSize: 5 },
    data: [{ a: 11 }, { a: 12 }],
  };
  const { result } = renderHook(
    () => useColDefs({ ...serverProps, showNumberedColumn: true }),
    { wrapper: defaultThemeWrapper },
  );
  const { valueGetter } = result.current[0];
  expect(typeof valueGetter).toBe('function');

  const getter = valueGetter as (params: {
    node?: { rowIndex?: number };
    data?: Record<string, unknown>;
  }) => number;

  expect(getter({ node: { rowIndex: 0 } })).toBe(11);
  expect(getter({ node: { rowIndex: 1 } })).toBe(12);
});

test('has correct static column properties', () => {
  const { result } = renderHook(
    () => useColDefs({ ...basePropsNumericColumns, showNumberedColumn: true }),
    { wrapper: defaultThemeWrapper },
  );
  const colDef = result.current[0];
  expect(colDef.sortable).toBe(false);
  expect(colDef.filter).toBe(false);
  expect(colDef.pinned).toBe('left');
  expect(colDef.lockPosition).toBe(true);
  expect(colDef.suppressNavigable).toBe(true);
  expect(colDef.resizable).toBe(false);
  expect(colDef.suppressMovable).toBe(true);
  expect(colDef.context).toEqual({ isMetric: true });
  expect(colDef.headerStyle).toBeDefined();
  expect(colDef.cellStyle).toBeDefined();
});

test('pageSize priority chain works correctly', () => {
  const props1 = {
    ...basePropsNumericColumns,
    serverPagination: true,
    serverPaginationData: { currentPage: 2, pageSize: 10 },
    serverPageLength: 5,
    data: Array.from({ length: 3 }, () => ({ a: 1 })),
    showNumberedColumn: true,
  };
  const { result: res1 } = renderHook(() => useColDefs(props1), {
    wrapper: defaultThemeWrapper,
  });

  expect(res1.current[0].width).toBe(42);

  const props2 = {
    ...props1,
    serverPaginationData: { currentPage: 2 },
    serverPageLength: 20,
  };
  const { result: res2 } = renderHook(() => useColDefs(props2), {
    wrapper: defaultThemeWrapper,
  });

  expect(res2.current[0].width).toBe(42);
});

test('column width adapts to max row number length in client mode', () => {
  const base = {
    ...basePropsNumericColumns,
    showNumberedColumn: true,
    serverPagination: false,
  };

  const props9 = { ...base, data: Array.from({ length: 9 }, () => ({ a: 1 })) };
  const { result: res9 } = renderHook(() => useColDefs(props9), {
    wrapper: defaultThemeWrapper,
  });
  expect(res9.current[0].width).toBe(36);

  const props10 = {
    ...base,
    data: Array.from({ length: 10 }, () => ({ a: 1 })),
  };
  const { result: res10 } = renderHook(() => useColDefs(props10), {
    wrapper: defaultThemeWrapper,
  });
  expect(res10.current[0].width).toBe(42);

  const props100 = {
    ...base,
    data: Array.from({ length: 100 }, () => ({ a: 1 })),
  };
  const { result: res100 } = renderHook(() => useColDefs(props100), {
    wrapper: defaultThemeWrapper,
  });
  expect(res100.current[0].width).toBe(48);
});

test('row number column uses theme variables for styling', () => {
  const { result } = renderHook(
    () => useColDefs({ ...basePropsNumericColumns, showNumberedColumn: true }),
    { wrapper: defaultThemeWrapper },
  );
  const colDef = result.current[0];
  expect(colDef.cellStyle).toMatchObject({
    backgroundColor: expect.any(String),
    padding: '0',
    textAlign: 'center',
    fontSize: '0.9em',
    color: expect.any(String),
  });
  expect(colDef.headerStyle).toMatchObject({
    backgroundColor: expect.any(String),
    fontSize: '1em',
    color: expect.any(String),
  });
});

test('valueGetter handles missing node or rowIndex gracefully', () => {
  const { result } = renderHook(
    () => useColDefs({ ...basePropsNumericColumns, showNumberedColumn: true }),
    { wrapper: defaultThemeWrapper },
  );
  const getter = result.current[0].valueGetter as (params: {
    node?: { rowIndex?: number };
  }) => number;
  expect(getter({})).toBe(1);
  expect(getter({ node: {} })).toBe(1);

  const serverProps = {
    ...basePropsNumericColumns,
    serverPagination: true,
    serverPaginationData: { currentPage: 2, pageSize: 5 },
    showNumberedColumn: true,
  };
  const { result: serverResult } = renderHook(() => useColDefs(serverProps), {
    wrapper: defaultThemeWrapper,
  });
  const serverGetter = serverResult.current[0].valueGetter as (params: {
    node?: { rowIndex?: number };
  }) => number;
  expect(serverGetter({})).toBe(2 * 5 + 1);
  expect(serverGetter({ node: {} })).toBe(11);
});
