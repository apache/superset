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
import { ChartProps, TimeGranularity } from '@superset-ui/core';
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
}: {
  grain?: TimeGranularity;
  override?: TimeGranularity;
  raw?: number | string | null;
  selectedValues?: string[];
  dateFormat?: string;
  temporalFirst?: boolean;
  granularitySqla?: string;
  temporalColumnsLookup?: Record<string, boolean>;
  timeColumnOverride?: string;
} = {}) {
  const setDataMask = jest.fn();
  const onContextMenu = jest.fn();
  const columns = temporalFirst
    ? ['order_date', 'category']
    : ['category', 'order_date'];
  const props = transformProps(
    new ChartProps<EchartsSunburstFormData>({
      formData: {
        datasource: '1__table',
        viz_type: 'sunburst_v2',
        groupby: [],
        columns,
        metric: 'count',
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
        filters: [{ col: 'order_date', op: '==', val: '2024-10-14T12:30:00' }],
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

test('drill-by uses the raw temporal value and the displayed label', () => {
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

test('drilling into a grained temporal level uses the same bucket as cross-filtering', () => {
  const { eventHandlers, event, onContextMenu } = setup({
    grain: TimeGranularity.MONTH,
  });
  eventHandlers.contextmenu(event());
  const context = onContextMenu.mock.lastCall[2];
  expect(context.drillBy.filters[0]).toMatchObject({
    col: 'order_date',
    op: 'TEMPORAL_RANGE',
    val: '2024-10-01T00:00:00 : 2024-11-01T00:00:00',
  });
  expect(context.drillToDetail[1]).toEqual(context.drillBy.filters[0]);
  expect(context.crossFilter.dataMask.extraFormData.filters[0].val).toBe(
    context.drillBy.filters[0].val,
  );
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
    filters: [{ col: 'order_date', op: '==', val: '2024-10-01T00:00:00' }],
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
