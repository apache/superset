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
import { render } from '@testing-library/react';
import { GenericDataType } from '@apache-superset/core/common';
import { ChartProps, DTTM_ALIAS, TimeGranularity } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import Heatmap from '../../src/Heatmap/Heatmap';
import transformProps from '../../src/Heatmap/transformProps';
import { HeatmapChartProps, HeatmapFormData } from '../../src/Heatmap/types';
import Echart from '../../src/components/Echart';
import { EventHandlers } from '../../src/types';
import { heatmapCellKey } from '../../src/Heatmap/crossFilter';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

const baseFormData: HeatmapFormData = {
  datasource: '1__table',
  viz_type: 'heatmap',
  xAxis: 'day_of_week',
  groupby: ['hour'],
  metric: 'count',
  linearColorScheme: 'blue_white_yellow',
  normalized: false,
  normalizeAcross: 'heatmap',
  borderColor: { r: 255, g: 255, b: 255, a: 1 },
  borderWidth: 1,
  showLegend: true,
  showValues: false,
  showPercentage: false,
  legendType: 'continuous',
  bottomMargin: 'auto',
  leftMargin: 'auto',
  xscaleInterval: 1,
  yscaleInterval: 1,
  xAxisLabelRotation: 0,
  valueBounds: [null, null],
};

const queriesData = [
  {
    data: [
      { day_of_week: 'Monday', hour: 9, count: 10 },
      { day_of_week: 'Tuesday', hour: 10, count: 20 },
    ],
    colnames: ['day_of_week', 'hour', 'count'],
    coltypes: [1, 0, 0],
  },
];

function setup(
  overrides: {
    emitCrossFilters?: boolean;
    filterState?: { selectedValues?: string[] | null };
    setDataMask?: jest.Mock | undefined;
    onContextMenu?: jest.Mock | undefined;
    formData?: Partial<HeatmapFormData>;
    queriesData?: any[];
  } = {},
) {
  const setDataMask =
    'setDataMask' in overrides ? overrides.setDataMask : jest.fn();
  const onContextMenu =
    'onContextMenu' in overrides ? overrides.onContextMenu : jest.fn();

  const chartProps = {
    ...new ChartProps({
      formData: { ...baseFormData, ...overrides.formData },
      width: 800,
      height: 600,
      queriesData: overrides.queriesData ?? queriesData,
      theme: supersetTheme,
      hooks: { onContextMenu, setDataMask },
      filterState: overrides.filterState ?? {},
      emitCrossFilters: overrides.emitCrossFilters ?? true,
    }),
    emitCrossFilters: overrides.emitCrossFilters ?? true,
    filterState: overrides.filterState ?? {},
  } as unknown as HeatmapChartProps;

  const transformed = transformProps(chartProps);
  render(
    <Heatmap
      {...transformed}
      setDataMask={setDataMask}
      onContextMenu={onContextMenu}
      emitCrossFilters={overrides.emitCrossFilters ?? true}
      filterState={overrides.filterState ?? {}}
    />,
  );

  const lastCall = mockedEchart.mock.calls[mockedEchart.mock.calls.length - 1];
  const { eventHandlers } = lastCall[0] as { eventHandlers: EventHandlers };
  return { eventHandlers, setDataMask, onContextMenu };
}

beforeEach(() => {
  mockedEchart.mockClear();
});

test('clicking a cell emits setDataMask with expected extraFormData and filterState', () => {
  const { eventHandlers, setDataMask } = setup();

  eventHandlers.click({
    data: {
      xValue: 'Monday',
      yValue: 9,
      value: [0, 0, 10],
    },
  });

  const expectedKey = heatmapCellKey('Monday', 9);
  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: {
      filters: [
        { col: 'day_of_week', op: 'IN', val: ['Monday'] },
        { col: 'hour', op: 'IN', val: [9] },
      ],
    },
    filterState: {
      label: 'Monday (9)',
      value: 'Monday (9)',
      selectedValues: [expectedKey],
    },
  });
});

test('clicking selected cell clears setDataMask', () => {
  const selectedKey = heatmapCellKey('Monday', 9);
  const { eventHandlers, setDataMask } = setup({
    filterState: { selectedValues: [selectedKey] },
  });

  eventHandlers.click({
    data: {
      xValue: 'Monday',
      yValue: 9,
      value: [0, 0, 10],
    },
  });

  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: { filters: [] },
    filterState: {
      label: null,
      value: null,
      selectedValues: null,
    },
  });
});

test('clicking a different cell replaces selection', () => {
  const existingKey = heatmapCellKey('Monday', 9);
  const { eventHandlers, setDataMask } = setup({
    filterState: { selectedValues: [existingKey] },
  });

  eventHandlers.click({
    data: {
      xValue: 'Tuesday',
      yValue: 10,
      value: [1, 1, 20],
    },
  });

  const nextKey = heatmapCellKey('Tuesday', 10);
  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: {
      filters: [
        { col: 'day_of_week', op: 'IN', val: ['Tuesday'] },
        { col: 'hour', op: 'IN', val: [10] },
      ],
    },
    filterState: {
      label: 'Tuesday (10)',
      value: 'Tuesday (10)',
      selectedValues: [nextKey],
    },
  });
});

test('clicking when emitCrossFilters is false does not call setDataMask', () => {
  const { eventHandlers, setDataMask } = setup({ emitCrossFilters: false });

  eventHandlers.click({
    data: {
      xValue: 'Monday',
      yValue: 9,
      value: [0, 0, 10],
    },
  });

  expect(setDataMask).not.toHaveBeenCalled();
});

test('clicking when setDataMask is undefined does not throw', () => {
  const { eventHandlers } = setup({ setDataMask: undefined });

  expect(() => {
    eventHandlers.click({
      data: {
        xValue: 'Monday',
        yValue: 9,
        value: [0, 0, 10],
      },
    });
  }).not.toThrow();
});

test('clicking with non-cell data does not call setDataMask', () => {
  const { eventHandlers, setDataMask } = setup();

  eventHandlers.click({ data: undefined });
  eventHandlers.click({ data: {} });
  eventHandlers.click({ data: [0, 0, 10] });

  expect(setDataMask).not.toHaveBeenCalled();
});

test('right-clicking a cell stops browser context menu and invokes onContextMenu with drillToDetail and crossFilter', () => {
  const { eventHandlers, onContextMenu } = setup();
  const stop = jest.fn();

  eventHandlers.contextmenu({
    data: {
      xValue: 'Monday',
      yValue: 9,
      value: [0, 0, 10],
    },
    event: {
      stop,
      event: { clientX: 120, clientY: 240 } as unknown as PointerEvent,
    },
  });

  expect(stop).toHaveBeenCalledTimes(1);
  expect(onContextMenu).toHaveBeenCalledTimes(1);
  const [x, y, payload] = onContextMenu!.mock.calls[0];
  expect(x).toBe(120);
  expect(y).toBe(240);
  expect(payload.drillToDetail).toEqual([
    { col: 'day_of_week', op: '==', val: 'Monday', formattedVal: 'Monday' },
    { col: 'hour', op: '==', val: 9, formattedVal: '9' },
  ]);
  expect(payload.drillBy).toEqual({
    filters: [{ col: 'hour', op: '==', val: 9, formattedVal: '9' }],
    xAxisFilters: [
      { col: 'day_of_week', op: '==', val: 'Monday', formattedVal: 'Monday' },
    ],
    groupbyFieldName: 'groupby',
  });
  const expectedKey = heatmapCellKey('Monday', 9);
  expect(payload.crossFilter).toEqual({
    dataMask: {
      extraFormData: {
        filters: [
          { col: 'day_of_week', op: 'IN', val: ['Monday'] },
          { col: 'hour', op: 'IN', val: [9] },
        ],
      },
      filterState: {
        label: 'Monday (9)',
        value: 'Monday (9)',
        selectedValues: [expectedKey],
      },
    },
    isCurrentValueSelected: false,
  });
});

test('context menu reflects already-selected cell in crossFilter toggle payload', () => {
  const selectedKey = heatmapCellKey('Monday', 9);
  const { eventHandlers, onContextMenu } = setup({
    filterState: { selectedValues: [selectedKey] },
  });
  const stop = jest.fn();

  eventHandlers.contextmenu({
    data: {
      xValue: 'Monday',
      yValue: 9,
      value: [0, 0, 10],
    },
    event: {
      stop,
      event: { clientX: 50, clientY: 100 } as unknown as PointerEvent,
    },
  });

  expect(stop).toHaveBeenCalledTimes(1);
  expect(onContextMenu).toHaveBeenCalledTimes(1);
  const [, , payload] = onContextMenu!.mock.calls[0];
  expect(payload.drillToDetail).toEqual([
    { col: 'day_of_week', op: '==', val: 'Monday', formattedVal: 'Monday' },
    { col: 'hour', op: '==', val: 9, formattedVal: '9' },
  ]);
  expect(payload.crossFilter).toEqual({
    dataMask: {
      extraFormData: { filters: [] },
      filterState: {
        label: null,
        value: null,
        selectedValues: null,
      },
    },
    isCurrentValueSelected: true,
  });
});

test('context menu omits crossFilter when emitCrossFilters is false', () => {
  const { eventHandlers, onContextMenu } = setup({ emitCrossFilters: false });
  const stop = jest.fn();

  eventHandlers.contextmenu({
    data: {
      xValue: 'Monday',
      yValue: 9,
      value: [0, 0, 10],
    },
    event: {
      stop,
      event: { clientX: 10, clientY: 20 } as unknown as PointerEvent,
    },
  });

  expect(stop).toHaveBeenCalledTimes(1);
  expect(onContextMenu).toHaveBeenCalledTimes(1);
  const [, , payload] = onContextMenu!.mock.calls[0];
  expect(payload.drillToDetail).toEqual([
    { col: 'day_of_week', op: '==', val: 'Monday', formattedVal: 'Monday' },
    { col: 'hour', op: '==', val: 9, formattedVal: '9' },
  ]);
  expect(payload.crossFilter).toBeUndefined();
  expect('crossFilter' in payload).toBe(false);
});

test('context menu omits crossFilter when setDataMask is undefined', () => {
  const { eventHandlers, onContextMenu } = setup({ setDataMask: undefined });
  const stop = jest.fn();

  eventHandlers.contextmenu({
    data: {
      xValue: 'Monday',
      yValue: 9,
      value: [0, 0, 10],
    },
    event: {
      stop,
      event: { clientX: 10, clientY: 20 } as unknown as PointerEvent,
    },
  });

  expect(stop).toHaveBeenCalledTimes(1);
  expect(onContextMenu).toHaveBeenCalledTimes(1);
  const [, , payload] = onContextMenu!.mock.calls[0];
  expect(payload.drillToDetail).toBeDefined();
  expect(payload.crossFilter).toBeUndefined();
  expect('crossFilter' in payload).toBe(false);
});

test('context menu drillToDetail emits IS NULL for null and undefined dimensions', () => {
  const { eventHandlers, onContextMenu } = setup();
  const stop = jest.fn();

  eventHandlers.contextmenu({
    data: {
      xValue: null,
      yValue: undefined,
      value: [0, 0, 10],
    },
    event: {
      stop,
      event: { clientX: 10, clientY: 20 } as unknown as PointerEvent,
    },
  });

  expect(stop).toHaveBeenCalledTimes(1);
  const [, , payload] = onContextMenu!.mock.calls[0];
  expect(payload.drillToDetail).toEqual([
    { col: 'day_of_week', op: 'IS NULL', formattedVal: '<NULL>' },
    { col: 'hour', op: 'IS NULL', formattedVal: '<NULL>' },
  ]);
  expect(payload.drillBy).toEqual({
    filters: [{ col: 'hour', op: 'IS NULL', formattedVal: '<NULL>' }],
    xAxisFilters: [
      { col: 'day_of_week', op: 'IS NULL', formattedVal: '<NULL>' },
    ],
    groupbyFieldName: 'groupby',
  });
});

test('context menu drillToDetail serializes bigint dimension values', () => {
  const { eventHandlers, onContextMenu } = setup();
  const stop = jest.fn();

  eventHandlers.contextmenu({
    data: {
      xValue: 9007199254740995n,
      yValue: 9,
      value: [0, 0, 10],
    },
    event: {
      stop,
      event: { clientX: 10, clientY: 20 } as unknown as PointerEvent,
    },
  });

  expect(stop).toHaveBeenCalledTimes(1);
  const [, , payload] = onContextMenu!.mock.calls[0];
  expect(payload.drillToDetail[0]).toEqual({
    col: 'day_of_week',
    op: '==',
    val: '9007199254740995',
    formattedVal: '9007199254740995',
  });
  expect(payload.drillBy.xAxisFilters[0]).toEqual({
    col: 'day_of_week',
    op: '==',
    val: '9007199254740995',
    formattedVal: '9007199254740995',
  });
  expect(payload.drillBy.filters[0]).toEqual({
    col: 'hour',
    op: '==',
    val: 9,
    formattedVal: '9',
  });
  expect(payload.drillBy.groupbyFieldName).toBe('groupby');
});

test('context menu emits drillBy with 2D scope filters and groupbyFieldName groupby', () => {
  const { eventHandlers, onContextMenu } = setup();
  const stop = jest.fn();

  eventHandlers.contextmenu({
    data: {
      xValue: 'Tuesday',
      yValue: 10,
      value: [1, 1, 20],
    },
    event: {
      stop,
      event: { clientX: 200, clientY: 300 } as unknown as PointerEvent,
    },
  });

  expect(stop).toHaveBeenCalledTimes(1);
  const [, , payload] = onContextMenu!.mock.calls[0];
  expect(payload.drillBy).toEqual({
    filters: [{ col: 'hour', op: '==', val: 10, formattedVal: '10' }],
    xAxisFilters: [
      {
        col: 'day_of_week',
        op: '==',
        val: 'Tuesday',
        formattedVal: 'Tuesday',
      },
    ],
    groupbyFieldName: 'groupby',
  });
});

test('context menu does not invoke onContextMenu if pointer event is missing', () => {
  const { eventHandlers, onContextMenu } = setup();
  const stop = jest.fn();

  eventHandlers.contextmenu({
    data: {
      xValue: 'Monday',
      yValue: 9,
      value: [0, 0, 10],
    },
    event: { stop },
  });

  expect(stop).toHaveBeenCalledTimes(1);
  expect(onContextMenu).not.toHaveBeenCalled();

  eventHandlers.contextmenu({
    data: {
      xValue: 'Monday',
      yValue: 9,
      value: [0, 0, 10],
    },
  });

  expect(onContextMenu).not.toHaveBeenCalled();
});

test('context menu does not invoke onContextMenu for non-cell data', () => {
  const { eventHandlers, onContextMenu } = setup();
  const stop = jest.fn();

  eventHandlers.contextmenu({
    data: undefined,
    event: {
      stop,
      event: { clientX: 10, clientY: 20 } as unknown as PointerEvent,
    },
  });
  eventHandlers.contextmenu({
    data: {},
    event: {
      stop,
      event: { clientX: 10, clientY: 20 } as unknown as PointerEvent,
    },
  });
  eventHandlers.contextmenu({
    data: [0, 0, 10],
    event: {
      stop,
      event: { clientX: 10, clientY: 20 } as unknown as PointerEvent,
    },
  });

  expect(stop).not.toHaveBeenCalled();
  expect(onContextMenu).not.toHaveBeenCalled();
});

test('context menu does nothing when onContextMenu is undefined', () => {
  const { eventHandlers } = setup({ onContextMenu: undefined });
  const stop = jest.fn();

  expect(() => {
    eventHandlers.contextmenu({
      data: {
        xValue: 'Monday',
        yValue: 9,
        value: [0, 0, 10],
      },
      event: {
        stop,
        event: { clientX: 10, clientY: 20 } as unknown as PointerEvent,
      },
    });
  }).not.toThrow();

  expect(stop).not.toHaveBeenCalled();
});

test('clicking a temporal cell with time_grain_sqla emits setDataMask with TEMPORAL_RANGE and extraFormData.time_range', () => {
  const temporalQueriesData = [
    {
      data: [{ order_date: '2024-01-01T00:00:00', hour: 9, count: 10 }],
      colnames: ['order_date', 'hour', 'count'],
      coltypes: [
        GenericDataType.Temporal,
        GenericDataType.Numeric,
        GenericDataType.Numeric,
      ],
    },
  ];
  const { eventHandlers, setDataMask } = setup({
    formData: {
      xAxis: 'order_date',
      time_grain_sqla: TimeGranularity.MONTH,
    },
    queriesData: temporalQueriesData,
  });

  eventHandlers.click({
    data: {
      xValue: '2024-01-01T00:00:00',
      yValue: 9,
      value: [0, 0, 10],
    },
  });

  const expectedKey = heatmapCellKey('2024-01-01T00:00:00', 9);
  const expectedRange = '2024-01-01T00:00:00 : 2024-02-01T00:00:00';
  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: {
      filters: [
        { col: 'order_date', op: 'TEMPORAL_RANGE', val: expectedRange },
        { col: 'hour', op: 'IN', val: [9] },
      ],
      time_range: expectedRange,
    },
    filterState: {
      label: expect.any(String),
      value: expect.any(String),
      selectedValues: [expectedKey],
    },
  });
});

test('context menu on temporal cell invokes onContextMenu with accurate temporal bucket representations', () => {
  const temporalQueriesData = [
    {
      data: [{ order_date: '2024-01-01T00:00:00', hour: 9, count: 10 }],
      colnames: ['order_date', 'hour', 'count'],
      coltypes: [
        GenericDataType.Temporal,
        GenericDataType.Numeric,
        GenericDataType.Numeric,
      ],
    },
  ];
  const { eventHandlers, onContextMenu } = setup({
    formData: {
      xAxis: 'order_date',
      time_grain_sqla: TimeGranularity.MONTH,
    },
    queriesData: temporalQueriesData,
  });
  const stop = jest.fn();

  eventHandlers.contextmenu({
    data: {
      xValue: '2024-01-01T00:00:00',
      yValue: 9,
      value: [0, 0, 10],
    },
    event: {
      stop,
      event: { clientX: 100, clientY: 200 } as unknown as PointerEvent,
    },
  });

  expect(stop).toHaveBeenCalledTimes(1);
  expect(onContextMenu).toHaveBeenCalledTimes(1);
  const [, , payload] = onContextMenu!.mock.calls[0];
  const epoch = new Date('2024-01-01T00:00:00Z').getTime();
  const expectedRange = '2024-01-01T00:00:00 : 2024-02-01T00:00:00';

  expect(payload.drillToDetail[0]).toEqual({
    col: 'order_date',
    op: '==',
    val: epoch,
    grain: TimeGranularity.MONTH,
    formattedVal: expect.any(String),
  });
  expect(payload.drillBy.xAxisFilters[0]).toEqual({
    col: 'order_date',
    op: '==',
    val: epoch,
    grain: TimeGranularity.MONTH,
    formattedVal: expect.any(String),
  });
  expect(payload.crossFilter.dataMask.extraFormData).toEqual({
    filters: [
      { col: 'order_date', op: 'TEMPORAL_RANGE', val: expectedRange },
      { col: 'hour', op: 'IN', val: [9] },
    ],
    time_range: expectedRange,
  });
});

test('context menu with DTTM_ALIAS and granularitySqla resolves to real column in all 3 interaction payloads', () => {
  const temporalQueriesData = [
    {
      data: [{ [DTTM_ALIAS]: '2024-01-01T00:00:00', hour: 9, count: 10 }],
      colnames: [DTTM_ALIAS, 'hour', 'count'],
      coltypes: [
        GenericDataType.Temporal,
        GenericDataType.Numeric,
        GenericDataType.Numeric,
      ],
    },
  ];
  const { eventHandlers, onContextMenu } = setup({
    formData: {
      xAxis: DTTM_ALIAS,
      granularitySqla: 'order_date',
      time_grain_sqla: TimeGranularity.MONTH,
    },
    queriesData: temporalQueriesData,
  });
  const stop = jest.fn();

  eventHandlers.contextmenu({
    data: {
      xValue: '2024-01-01T00:00:00',
      yValue: 9,
      value: [0, 0, 10],
    },
    event: {
      stop,
      event: { clientX: 100, clientY: 200 } as unknown as PointerEvent,
    },
  });

  expect(onContextMenu).toHaveBeenCalledTimes(1);
  const [, , payload] = onContextMenu!.mock.calls[0];

  expect(payload.drillToDetail[0].col).toBe('order_date');
  expect(payload.drillBy.xAxisFilters[0].col).toBe('order_date');
  expect(payload.crossFilter.dataMask.extraFormData.filters[0].col).toBe(
    'order_date',
  );
});
