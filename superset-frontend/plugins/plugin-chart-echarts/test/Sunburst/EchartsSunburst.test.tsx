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
import {
  ChartProps,
  QueryFormColumn,
  TimeGranularity,
  createSmartDateFormatter,
  getTimeFormatterRegistry,
  SMART_DATE_ID,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import EchartsSunburst from '../../src/Sunburst/EchartsSunburst';
import transformProps from '../../src/Sunburst/transformProps';
import {
  EchartsSunburstChartProps,
  EchartsSunburstFormData,
  NodeItemOption,
} from '../../src/Sunburst/types';
import { EchartsProps } from '../../src/types';

// Match the app bootstrap's formatter registration.
beforeAll(() => {
  getTimeFormatterRegistry().registerValue(
    SMART_DATE_ID,
    createSmartDateFormatter(),
  );
});

const mockEchart = jest.fn();
jest.mock('../../src/components/Echart', () => (props: EchartsProps) => {
  mockEchart(props);
  return null;
});

function setup({
  grain,
  override,
  raw = Date.UTC(2024, 9, 1),
  selectedValues = [] as string[],
  dateFormat = 'smart_date',
  temporalFirst = false,
  granularitySqla = 'order_date',
  temporalColumnsLookup,
  timeColumnOverride,
  adhocTemporal = false,
}: {
  grain?: TimeGranularity;
  override?: TimeGranularity;
  raw?: number | string | Date | null;
  selectedValues?: string[];
  dateFormat?: string;
  temporalFirst?: boolean;
  granularitySqla?: string;
  temporalColumnsLookup?: Record<string, boolean>;
  timeColumnOverride?: string;
  adhocTemporal?: boolean;
} = {}) {
  const setDataMask = jest.fn();
  const onContextMenu = jest.fn();
  const temporalColumn: QueryFormColumn = adhocTemporal
    ? {
        expressionType: 'SQL',
        sqlExpression: "DATE_TRUNC('month', order_date)",
        label: 'order_date',
      }
    : 'order_date';
  const columns = temporalFirst
    ? [temporalColumn, 'category']
    : ['category', temporalColumn];
  const props = transformProps(
    new ChartProps<EchartsSunburstFormData>({
      formData: {
        datasource: '1__table',
        viz_type: 'sunburst_v2',
        groupby: [],
        columns,
        metric: 'count',
        time_range: '2024-01-01 : 2025-01-01',
        dateFormat,
        timeGrainSqla: grain,
        granularitySqla,
        temporalColumnsLookup,
        extraFormData: {
          ...(override && { time_grain_sqla: override }),
          ...(timeColumnOverride && { granularity_sqla: timeColumnOverride }),
        },
      },
      width: 800,
      height: 600,
      theme: supersetTheme,
      queriesData: [
        {
          colnames: ['category', 'order_date', 'count'],
          coltypes: [
            GenericDataType.String,
            GenericDataType.Temporal,
            GenericDataType.Numeric,
          ],
          data: [{ category: 'A', order_date: raw, count: 10 }],
        },
      ],
      hooks: { setDataMask, onContextMenu },
      filterState: { selectedValues },
      emitCrossFilters: true,
    }) as EchartsSunburstChartProps,
  );
  render(<EchartsSunburst {...props} />);
  const { eventHandlers } = mockEchart.mock.lastCall[0] as EchartsProps;
  const nodes = (
    props.echartOptions as { series: { data: NodeItemOption[] }[] }
  ).series[0].data;
  const path = [nodes[0], nodes[0].children?.[0] as NodeItemOption];
  const event = (depth = 2) => ({
    data: path[depth - 1],
    treePathInfo: [
      { name: '', dataIndex: 0, value: 10 },
      ...path
        .slice(0, depth)
        .map((node, i) => ({ name: node.name, dataIndex: i + 1, value: 10 })),
    ],
    event: { stop: jest.fn(), event: { clientX: 0, clientY: 0 } },
  });
  return {
    setDataMask,
    onContextMenu,
    eventHandlers: eventHandlers!,
    event,
    path,
  };
}

test('cross-filters a raw temporal segment with the timestamp rather than its label', () => {
  const { eventHandlers, event, setDataMask } = setup({
    raw: Date.UTC(2024, 9, 14, 12, 30),
  });
  eventHandlers.click(event());
  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [
          { col: 'order_date', op: '==', val: Date.UTC(2024, 9, 14, 12, 30) },
        ],
      },
    }),
  );
});

test.each([
  [TimeGranularity.MONTH, '2024-10-01T00:00:00 : 2024-11-01T00:00:00'],
  [TimeGranularity.YEAR, '2024-01-01T00:00:00 : 2025-01-01T00:00:00'],
])(
  'cross-filters the entire %s bucket with upper-exclusive bounds',
  (grain, range) => {
    const raw =
      grain === TimeGranularity.YEAR
        ? Date.UTC(2024, 0, 1)
        : Date.UTC(2024, 9, 1);
    const { eventHandlers, event, setDataMask } = setup({ grain, raw });
    eventHandlers.click(event());
    expect(setDataMask).toHaveBeenCalledWith(
      expect.objectContaining({
        extraFormData: {
          filters: [{ col: 'order_date', op: 'TEMPORAL_RANGE', val: range }],
          time_range: range,
        },
      }),
    );
  },
);

test('uses the dashboard grain override for temporal cross-filters', () => {
  const { eventHandlers, event, setDataMask } = setup({
    grain: TimeGranularity.MONTH,
    override: TimeGranularity.YEAR,
    raw: '2024-01-01T00:00:00',
  });
  eventHandlers.click(event());
  expect(setDataMask.mock.lastCall[0].extraFormData.time_range).toBe(
    '2024-01-01T00:00:00 : 2025-01-01T00:00:00',
  );
});

test('keeps categorical cross-filters and click-to-clear behavior', () => {
  const first = setup({ grain: TimeGranularity.MONTH });
  first.eventHandlers.click(first.event(1));
  const mask = first.setDataMask.mock.lastCall[0];
  expect(mask).toEqual({
    extraFormData: { filters: [{ col: 'category', op: '==', val: 'A' }] },
    filterState: { value: 'A', selectedValues: ['A'] },
  });
  const second = setup({ selectedValues: mask.filterState.selectedValues });
  second.eventHandlers.click(second.event(1));
  expect(second.setDataMask.mock.lastCall[0].extraFormData).toEqual({
    filters: [],
  });
});

test('drill-by sends an ungrained temporal value as a naive ISO datetime', () => {
  const { eventHandlers, event, onContextMenu, path } = setup();
  eventHandlers.contextmenu(event());
  expect(onContextMenu.mock.lastCall[2].drillBy.filters).toEqual([
    {
      col: 'order_date',
      op: '==',
      val: '2024-10-01T00:00:00',
      formattedVal: path[1].name,
    },
  ]);
});

test('drill by selects a grained bucket by its label and grain', () => {
  // Like Drill to detail: no query time range replaces a grained equality.
  const { eventHandlers, event, onContextMenu, path } = setup({
    grain: TimeGranularity.MONTH,
  });
  eventHandlers.contextmenu(event());
  const context = onContextMenu.mock.lastCall[2];
  expect(context.drillBy.filters).toEqual([
    {
      col: 'order_date',
      op: '==',
      val: Date.UTC(2024, 9, 1),
      grain: TimeGranularity.MONTH,
      formattedVal: path[1].name,
    },
  ]);
  expect(context.crossFilter.dataMask.extraFormData.filters[0].op).toBe(
    'TEMPORAL_RANGE',
  );
});

test('drill to detail matches a grained bucket by its label and grain', () => {
  // Samples queries replace TEMPORAL_RANGE values with the chart's time_range,
  // so a range here would return every row of the dashboard time range.
  const { eventHandlers, event, onContextMenu, path } = setup({
    grain: TimeGranularity.MONTH,
  });
  eventHandlers.contextmenu(event());
  expect(onContextMenu.mock.lastCall[2].drillToDetail[1]).toEqual({
    col: 'order_date',
    op: '==',
    val: Date.UTC(2024, 9, 1),
    grain: TimeGranularity.MONTH,
    formattedVal: path[1].name,
  });
});

test('temporal segments with identical custom labels do not toggle each other off', () => {
  const first = setup({ raw: Date.UTC(2023, 9, 1), dateFormat: '%B' });
  first.eventHandlers.click(first.event());
  const second = setup({
    raw: Date.UTC(2024, 9, 1),
    dateFormat: '%B',
    selectedValues:
      first.setDataMask.mock.lastCall[0].filterState.selectedValues,
  });
  second.eventHandlers.click(second.event());
  expect(
    second.setDataMask.mock.lastCall[0].extraFormData.filters,
  ).toHaveLength(1);
});

test('cross-filters a temporal level before a categorical level', () => {
  const { eventHandlers, event, setDataMask } = setup({
    grain: TimeGranularity.MONTH,
    temporalFirst: true,
  });
  eventHandlers.click(event(1));
  expect(setDataMask.mock.lastCall[0].extraFormData.filters[0]).toMatchObject({
    col: 'order_date',
    op: 'TEMPORAL_RANGE',
  });
});

test('uses the temporal hierarchy lookup without a legacy granularity subject', () => {
  const { eventHandlers, event, setDataMask } = setup({
    grain: TimeGranularity.MONTH,
    granularitySqla: '',
    temporalColumnsLookup: { order_date: true },
  });
  eventHandlers.click(event());
  expect(setDataMask.mock.lastCall[0].extraFormData.filters[0].op).toBe(
    'TEMPORAL_RANGE',
  );
});

test("does not apply another temporal column's grain to a raw level", () => {
  const { eventHandlers, event, setDataMask } = setup({
    grain: TimeGranularity.MONTH,
    granularitySqla: 'other_date',
  });
  eventHandlers.click(event());
  expect(setDataMask.mock.lastCall[0].extraFormData).toEqual({
    filters: [{ col: 'order_date', op: '==', val: Date.UTC(2024, 9, 1) }],
  });
});

test('clears the temporal range override when clicking the selected bucket', () => {
  const first = setup({ grain: TimeGranularity.MONTH });
  first.eventHandlers.click(first.event());
  const second = setup({
    grain: TimeGranularity.MONTH,
    selectedValues:
      first.setDataMask.mock.lastCall[0].filterState.selectedValues,
  });
  second.eventHandlers.click(second.event());
  expect(second.setDataMask.mock.lastCall[0]).toEqual({
    extraFormData: { filters: [] },
    filterState: { value: null, selectedValues: [] },
  });
});

test('keeps a null temporal value rather than filtering the null display label', () => {
  const { eventHandlers, event, setDataMask } = setup({
    raw: null,
    grain: TimeGranularity.MONTH,
  });
  eventHandlers.click(event());
  expect(setDataMask.mock.lastCall[0].extraFormData).toEqual({
    filters: [{ col: 'order_date', op: '==', val: null }],
  });
});

test('keeps categorical child filters unchanged beneath a temporal ancestor', () => {
  const { eventHandlers, event, setDataMask } = setup({
    grain: TimeGranularity.MONTH,
    temporalFirst: true,
  });
  eventHandlers.click(event());
  expect(setDataMask.mock.lastCall[0].extraFormData).toEqual({
    filters: [{ col: 'category', op: '==', val: 'A' }],
  });
});

test('grains the level chosen by a dashboard Time Column filter', () => {
  const { eventHandlers, event, setDataMask, path } = setup({
    granularitySqla: '',
    override: TimeGranularity.MONTH,
    timeColumnOverride: 'order_date',
  });
  expect(path[1].name).toBe('Oct 2024');
  eventHandlers.click(event());
  expect(setDataMask.mock.lastCall[0].extraFormData).toEqual({
    filters: [
      {
        col: 'order_date',
        op: 'TEMPORAL_RANGE',
        val: '2024-10-01T00:00:00 : 2024-11-01T00:00:00',
      },
    ],
    time_range: '2024-10-01T00:00:00 : 2024-11-01T00:00:00',
  });
});

test('uses only the effective dashboard time column, not the saved one', () => {
  const { eventHandlers, event, setDataMask, path } = setup({
    grain: TimeGranularity.MONTH,
    timeColumnOverride: 'other_date',
  });
  expect(path[1].name).toBe('October');
  eventHandlers.click(event());
  expect(setDataMask.mock.lastCall[0].extraFormData).toEqual({
    filters: [{ col: 'order_date', op: '==', val: Date.UTC(2024, 9, 1) }],
  });
});

test.each(['PT6H', 'PT5S', 'PT30S', 'PT0.5H', 'P0.25Y', 'custom_grain'])(
  'preserves the engine grain %s for cross-filter and drill equality',
  grain => {
    const { eventHandlers, event, setDataMask, onContextMenu, path } = setup({
      grain: grain as TimeGranularity,
      raw: Date.UTC(2024, 9, 7, 6),
    });
    expect(path[1].name).toBe('06 AM');
    eventHandlers.click(event());
    expect(setDataMask.mock.lastCall[0].extraFormData).toEqual({
      filters: [
        { col: 'order_date', op: '==', val: Date.UTC(2024, 9, 7, 6), grain },
      ],
    });
    eventHandlers.contextmenu(event());
    expect(onContextMenu.mock.lastCall[2].drillToDetail[1]).toEqual({
      col: 'order_date',
      op: '==',
      val: Date.UTC(2024, 9, 7, 6),
      grain,
      formattedVal: path[1].name,
    });
    expect(onContextMenu.mock.lastCall[2].drillBy.filters).toEqual([
      {
        col: 'order_date',
        op: '==',
        val: Date.UTC(2024, 9, 7, 6),
        grain,
        formattedVal: path[1].name,
      },
    ]);
  },
);

test('Date selection keys use epoch milliseconds', () => {
  const raw = new Date(Date.UTC(2024, 9, 1));
  const { eventHandlers, event, setDataMask } = setup({ raw });
  eventHandlers.click(event());
  expect(setDataMask.mock.lastCall[0].filterState.selectedValues).toEqual([
    `A,${raw.getTime()}`,
  ]);
});

test('legacy label-based temporal selections remain highlighted and click to clear', () => {
  const { eventHandlers, event, setDataMask, path } = setup({
    selectedValues: ['A,October'],
  });
  expect(path[1].itemStyle?.opacity).not.toBe(0.3);
  eventHandlers.click(event());
  expect(setDataMask.mock.lastCall[0].extraFormData).toEqual({ filters: [] });
});

test('ungrained drill to detail keeps the epoch value for native engine coercion', () => {
  const raw = Date.UTC(2003, 10, 14);
  const { eventHandlers, event, onContextMenu, path } = setup({ raw });
  eventHandlers.contextmenu(event());
  expect(onContextMenu.mock.lastCall[2].drillToDetail[1]).toEqual({
    col: 'order_date',
    op: '==',
    val: raw,
    formattedVal: path[1].name,
  });
});

test('adhoc temporal levels compare a naive ISO datetime, not an epoch integer', () => {
  // An adhoc SQL expression has no native type for the backend to convert an
  // epoch into, so `(expr) = 1727740800000` would fail on typed engines.
  const { eventHandlers, event, onContextMenu, setDataMask, path } = setup({
    adhocTemporal: true,
    grain: TimeGranularity.MONTH,
  });
  const col = {
    expressionType: 'SQL',
    sqlExpression: "DATE_TRUNC('month', order_date)",
    label: 'order_date',
  };
  eventHandlers.click(event());
  expect(setDataMask.mock.lastCall[0].extraFormData).toEqual({
    filters: [{ col, op: '==', val: '2024-10-01T00:00:00' }],
  });
  eventHandlers.contextmenu(event());
  const context = onContextMenu.mock.lastCall[2];
  for (const filter of [context.drillToDetail[1], context.drillBy.filters[0]]) {
    expect(filter).toEqual({
      col,
      op: '==',
      val: '2024-10-01T00:00:00',
      formattedVal: path[1].name,
    });
  }
});
