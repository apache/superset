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
import { act, render } from '@testing-library/react';
import { ChartDataResponseResult } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import EchartsTimeseries from '../../src/Timeseries/EchartsTimeseries';
import transformProps from '../../src/Timeseries/transformProps';
import { DEFAULT_FORM_DATA } from '../../src/Timeseries/constants';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
  OrientationType,
} from '../../src/Timeseries/types';
import EchartsMixedTimeseries from '../../src/MixedTimeseries/EchartsMixedTimeseries';
import transformMixedProps from '../../src/MixedTimeseries/transformProps';
import {
  DEFAULT_FORM_DATA as MIXED_DEFAULT_FORM_DATA,
  EchartsMixedTimeseriesFormData,
  EchartsMixedTimeseriesProps,
} from '../../src/MixedTimeseries/types';
import { EchartsProps } from '../../src/types';
import { createEchartsTimeseriesTestChartProps } from '../helpers';

const mockEchart = jest.fn<void, [EchartsProps]>();
jest.mock('../../src/components/Echart', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: forwardRef((props: EchartsProps, _ref) => {
      mockEchart(props);
      return null;
    }),
  };
});

afterEach(() => {
  jest.useRealTimers();
  mockEchart.mockClear();
});

test.each([
  ['table', 'segment', 'Market segment', OrientationType.Vertical, false],
  [
    'semantic_view',
    'C.MARKET_SEGMENT',
    'MARKET_SEGMENT',
    OrientationType.Vertical,
    false,
  ],
  ['table', 'segment', 'Market segment', OrientationType.Horizontal, false],
  [
    'semantic_view',
    'C.MARKET_SEGMENT',
    'MARKET_SEGMENT',
    OrientationType.Horizontal,
    false,
  ],
  ['table', 'segment', 'segment', OrientationType.Vertical, false],
  ['table', 'segment', 'Market segment', OrientationType.Vertical, true],
  [
    'semantic_view',
    'C.MARKET_SEGMENT',
    'MARKET_SEGMENT',
    OrientationType.Vertical,
    true,
  ],
] as const)(
  '%s axis %s displayed as %s (%s, mixed=%s) emits column identity',
  async (datasourceType, column, label, orientation, mixed) => {
    jest.useFakeTimers();
    const value = 'AUTOMOBILE';
    const query: ChartDataResponseResult & {
      label_map: Record<string, string[]>;
    } = {
      data: [{ [column]: value, count: 3 }],
      colnames: [column, 'count'],
      coltypes: [GenericDataType.String, GenericDataType.Numeric],
      label_map: { count: ['count'] },
      annotation_data: null,
      cache_key: null,
      cache_timeout: null,
      cached_dttm: null,
      queried_dttm: null,
      error: null,
      is_cached: false,
      query: '',
      rowcount: 1,
      sql_rowcount: 1,
      stacktrace: null,
      status: 'success',
      from_dttm: null,
      to_dttm: null,
    };
    const datasource = {
      verboseMap: { [column]: label },
      columnFormats: {},
      currencyFormats: {},
    };
    const formData = {
      datasource: `1__${datasourceType}`,
      x_axis: column,
      xAxis: column,
      metrics: ['count'],
      groupby: [],
      orientation,
    };
    const setDataMask = jest.fn();
    const onContextMenu = jest.fn();
    const commonProps = { setDataMask, onContextMenu, emitCrossFilters: true };
    if (mixed) {
      const transformed = transformMixedProps(
        createEchartsTimeseriesTestChartProps<
          EchartsMixedTimeseriesFormData,
          EchartsMixedTimeseriesProps
        >({
          defaultFormData:
            MIXED_DEFAULT_FORM_DATA as EchartsMixedTimeseriesFormData,
          defaultVizType: 'mixed_timeseries',
          formData: { ...formData, metricsB: ['count'], groupbyB: [] },
          queriesData: [query, query],
          datasource,
        }),
      );
      expect(transformed.xAxis.label).toBe(label);
      render(
        <ThemeProvider theme={supersetTheme}>
          <EchartsMixedTimeseries {...transformed} {...commonProps} />
        </ThemeProvider>,
      );
    } else {
      const transformed = transformProps(
        createEchartsTimeseriesTestChartProps<
          EchartsTimeseriesFormData,
          EchartsTimeseriesChartProps
        >({
          defaultFormData: DEFAULT_FORM_DATA,
          defaultVizType: 'echarts_timeseries_bar',
          formData,
          queriesData: [query],
          datasource,
        }),
      );
      expect(transformed.xAxis.label).toBe(label);
      render(
        <ThemeProvider theme={supersetTheme}>
          <EchartsTimeseries {...transformed} {...commonProps} />
        </ThemeProvider>,
      );
    }
    const { eventHandlers = {} } = mockEchart.mock.calls.at(-1)![0];
    const event = {
      componentType: 'series',
      seriesName: 'count',
      seriesIndex: 0,
      dataIndex: 0,
      name: value,
      data:
        orientation === OrientationType.Horizontal ? [3, value] : [value, 3],
      event: { stop: jest.fn(), event: { clientX: 10, clientY: 20 } },
    };
    if (!mixed) {
      act(() => {
        eventHandlers.click(event);
        jest.runOnlyPendingTimers();
      });
    }
    await act(async () => {
      await eventHandlers.contextmenu(event);
    });
    expect({
      mask: setDataMask.mock.calls[0]?.[0],
      context: onContextMenu.mock.calls[0]?.[2],
    }).toEqual({
      mask: mixed
        ? undefined
        : expect.objectContaining({
            extraFormData: {
              filters: [{ col: column, op: 'IN', val: [value] }],
            },
            filterState: expect.objectContaining({ selectedValues: [value] }),
          }),
      context: expect.objectContaining({
        drillToDetail: [expect.objectContaining({ col: column, val: value })],
        ...(!mixed && {
          drillBy: expect.objectContaining({
            xAxisFilters: [
              expect.objectContaining({ col: column, val: value }),
            ],
          }),
        }),
      }),
    });
  },
);
