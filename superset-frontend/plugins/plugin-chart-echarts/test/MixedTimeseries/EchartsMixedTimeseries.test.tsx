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
  ChartDataResponseResult,
  DataRecord,
  VizType,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import transformProps from '../../src/MixedTimeseries/transformProps';
import EchartsMixedTimeseries from '../../src/MixedTimeseries/EchartsMixedTimeseries';
import {
  DEFAULT_FORM_DATA,
  EchartsMixedTimeseriesFormData,
  EchartsMixedTimeseriesProps,
} from '../../src/MixedTimeseries/types';
import Echart from '../../src/components/Echart';
import { createEchartsTimeseriesTestChartProps } from '../helpers';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

const ts1 = 1704067200000;
const ts2 = 1704153600000;

/**
 * Backend-shaped fixture: flattened column names keep the metric label, so
 * label_map values lead with the metric label ahead of the dimension value.
 */
function createQueryData(): ChartDataResponseResult {
  const rows = [
    { ds: ts1, 'sum__num, boy': 1, 'sum__num, girl': 2 },
    { ds: ts2, 'sum__num, boy': 3, 'sum__num, girl': 4 },
  ];
  return {
    annotation_data: null,
    cache_key: null,
    cache_timeout: null,
    cached_dttm: null,
    queried_dttm: null,
    data: rows as DataRecord[],
    colnames: ['ds', 'sum__num, boy', 'sum__num, girl'],
    coltypes: [
      GenericDataType.Temporal,
      GenericDataType.Numeric,
      GenericDataType.Numeric,
    ],
    error: null,
    is_cached: false,
    query: '',
    rowcount: rows.length,
    sql_rowcount: rows.length,
    stacktrace: null,
    status: 'success',
    from_dttm: null,
    to_dttm: null,
    label_map: {
      ds: ['ds'],
      'sum__num, boy': ['sum__num', 'boy'],
      'sum__num, girl': ['sum__num', 'girl'],
    },
  } as ChartDataResponseResult;
}

function setup(
  formDataOverrides: Partial<EchartsMixedTimeseriesFormData> = {},
) {
  const queryData = createQueryData();
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    defaultFormData: DEFAULT_FORM_DATA as EchartsMixedTimeseriesFormData,
    defaultVizType: 'mixed_timeseries',
    defaultQueriesData: [queryData, queryData],
    formData: {
      colorScheme: 'bnbColors',
      metrics: ['sum__num'],
      metricsB: ['sum__num'],
      groupby: ['gender'],
      groupbyB: ['gender'],
      x_axis: 'ds',
      viz_type: VizType.MixedTimeseries,
      ...formDataOverrides,
    },
    queriesData: [queryData, queryData],
  });
  const transformed = transformProps(chartProps);
  const setDataMask = jest.fn();
  const onContextMenu = jest.fn();
  const onFocusedSeries = jest.fn();
  render(
    <EchartsMixedTimeseries
      {...transformed}
      setDataMask={setDataMask}
      onContextMenu={onContextMenu}
      onFocusedSeries={onFocusedSeries}
      emitCrossFilters
    />,
  );
  const lastCall = mockedEchart.mock.calls[mockedEchart.mock.calls.length - 1];
  const { eventHandlers } = lastCall[0] as any;
  return { eventHandlers, setDataMask, onContextMenu, onFocusedSeries };
}

beforeEach(() => {
  mockedEchart.mockClear();
});

test('EchartsMixedTimeseries click emits cross-filter with tail-anchored dimension values', () => {
  const { eventHandlers, setDataMask } = setup();

  eventHandlers.click({ seriesName: 'sum__num, boy', seriesIndex: 0 });

  expect(setDataMask).toHaveBeenCalledTimes(1);
  const dataMask = setDataMask.mock.calls[0][0];
  // label_map values are ['sum__num', 'boy'] — the metric label must be
  // skipped and the dimension value emitted.
  expect(dataMask.extraFormData.filters).toEqual([
    { col: 'gender', op: 'IN', val: ['boy'] },
  ]);
  expect(dataMask.filterState.selectedValues).toEqual(['sum__num, boy']);
});

test('EchartsMixedTimeseries click clears filters when the series misses the label map', () => {
  const { eventHandlers, setDataMask } = setup();

  eventHandlers.click({ seriesName: 'not a series', seriesIndex: 0 });

  expect(setDataMask).toHaveBeenCalledTimes(1);
  const dataMask = setDataMask.mock.calls[0][0];
  // An unresolvable series must not emit bogus IS NULL filters (#41622).
  expect(dataMask.extraFormData.filters).toEqual([]);
  expect(dataMask.filterState.value).toBeNull();
});

test('EchartsMixedTimeseries context menu drills with tail-anchored dimension values', async () => {
  const { eventHandlers, onContextMenu } = setup();

  await eventHandlers.contextmenu({
    data: [ts1, 1],
    seriesName: 'sum__num, boy',
    seriesIndex: 0,
    name: '',
    event: { stop: jest.fn(), event: { clientX: 11, clientY: 22 } },
  });

  expect(onContextMenu).toHaveBeenCalledTimes(1);
  const [x, y, payload] = onContextMenu.mock.calls[0];
  expect(x).toBe(11);
  expect(y).toBe(22);
  expect(payload.drillToDetail).toEqual([
    expect.objectContaining({ col: 'ds', op: '==', val: ts1 }),
    expect.objectContaining({
      col: 'gender',
      op: '==',
      val: 'boy',
      formattedVal: 'boy',
    }),
  ]);
  expect(payload.drillBy.filters).toEqual([
    expect.objectContaining({ col: 'gender', op: '==', val: 'boy' }),
  ]);
  expect(payload.drillBy.groupbyFieldName).toBe('groupby');
  expect(payload.crossFilter.dataMask.extraFormData.filters).toEqual([
    { col: 'gender', op: 'IN', val: ['boy'] },
  ]);
});

test('EchartsMixedTimeseries context menu emits the category x-axis filter', async () => {
  const { eventHandlers, onContextMenu } = setup({
    xAxisForceCategorical: true,
  });

  await eventHandlers.contextmenu({
    data: ['boy-cat', 1],
    seriesName: 'sum__num, girl',
    seriesIndex: 1,
    name: 'boy-cat',
    event: { stop: jest.fn(), event: { clientX: 0, clientY: 0 } },
  });

  const payload = onContextMenu.mock.calls[0][2];
  expect(payload.drillToDetail).toEqual([
    expect.objectContaining({
      col: 'ds',
      op: '==',
      val: 'boy-cat',
      formattedVal: 'boy-cat',
    }),
    expect.objectContaining({ col: 'gender', op: '==', val: 'girl' }),
  ]);
});

test('EchartsMixedTimeseries hover focuses and unfocuses the series', () => {
  const { eventHandlers, onFocusedSeries } = setup();

  eventHandlers.mouseover({ seriesName: 'sum__num, boy' });
  expect(onFocusedSeries).toHaveBeenLastCalledWith('sum__num, boy');

  eventHandlers.mouseout();
  expect(onFocusedSeries).toHaveBeenLastCalledWith(null);
});
