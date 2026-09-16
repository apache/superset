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
import {
  render,
  waitFor,
  cleanup,
} from '../../../../spec/helpers/testing-library';
import {
  AxisType,
  createTimeRangeFromGranularity,
  DTTM_ALIAS,
  TimeGranularity,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { logging } from '@apache-superset/core/utils';
import type { EChartsCoreOption } from 'echarts/core';
import type { ECElementEvent } from 'echarts/types/src/util/types';
import type { ReactNode } from 'react';
import {
  LegendOrientation,
  LegendType,
  type EchartsHandler,
  type EchartsProps,
} from '../types';
import EchartsTimeseries from './EchartsTimeseries';
import {
  BarValueLabelPosition,
  EchartsTimeseriesSeriesType,
  OrientationType,
  type EchartsTimeseriesFormData,
  type TimeseriesChartTransformedProps,
} from './types';

const mockEchart = jest.fn();

jest.mock('../components/Echart', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');
  const MockEchart = forwardRef<EchartsHandler | null, EchartsProps>(
    (props, _ref) => {
      mockEchart(props);
      return null;
    },
  );
  MockEchart.displayName = 'MockEchart';
  return {
    __esModule: true,
    default: MockEchart,
  };
});

jest.mock('../components/ExtraControls', () => ({
  ExtraControls: ({ children }: { children?: ReactNode }) => (
    <div data-testid="extra-controls">{children}</div>
  ),
}));

const originalResizeObserver = globalThis.ResizeObserver;
const offsetHeightDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetHeight',
);

let mockOffsetHeight = 0;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return mockOffsetHeight;
    },
  });
});

afterAll(() => {
  if (offsetHeightDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'offsetHeight',
      offsetHeightDescriptor,
    );
  } else {
    delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
  }
});

afterEach(() => {
  jest.useRealTimers();
  cleanup();
  mockEchart.mockReset();
  (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
    originalResizeObserver;
});

const advanceClickTimer = () => {
  jest.advanceTimersByTime(300);
};

const defaultFormData: EchartsTimeseriesFormData & {
  vizType: string;
  dateFormat: string;
  numberFormat: string;
  granularitySqla?: string;
} = {
  annotationLayers: [],
  area: false,
  colorScheme: undefined,
  timeShiftColor: false,
  contributionMode: undefined,
  forecastEnabled: false,
  forecastPeriods: 0,
  forecastInterval: 0,
  forecastSeasonalityDaily: null,
  forecastSeasonalityWeekly: null,
  forecastSeasonalityYearly: null,
  logAxis: false,
  markerEnabled: false,
  markerSize: 1,
  metrics: [],
  minorSplitLine: false,
  minorTicks: false,
  gridlines: true,
  axisTicks: true,
  opacity: 1,
  orderDesc: false,
  rowLimit: 0,
  seriesType: EchartsTimeseriesSeriesType.Line,
  stack: null,
  stackDimension: '',
  timeCompare: [],
  tooltipTimeFormat: undefined,
  showTooltipTotal: false,
  showTooltipPercentage: false,
  truncateXAxis: false,
  truncateYAxis: false,
  yAxisFormat: undefined,
  xAxisForceCategorical: false,
  xAxisTimeFormat: undefined,
  timeGrainSqla: undefined,
  forceMaxInterval: false,
  xAxisBounds: [null, null],
  yAxisBounds: [null, null],
  zoomable: false,
  richTooltip: false,
  xAxisLabelRotation: 0,
  xAxisLabelInterval: 0,
  showValue: false,
  valueLabelPosition: BarValueLabelPosition.Auto,
  onlyTotal: false,
  showExtraControls: true,
  percentageThreshold: 0,
  orientation: OrientationType.Vertical,
  datasource: '1__table',
  viz_type: 'echarts_timeseries',
  legendMargin: 0,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Plain,
  showLegend: false,
  legendSort: null,
  xAxisTitle: '',
  xAxisTitleMargin: 40,
  yAxisTitle: '',
  yAxisTitleMargin: 50,
  yAxisTitlePosition: '',
  time_range: 'No filter',
  granularity: undefined,
  granularity_sqla: undefined,
  sql: '',
  url_params: {},
  custom_params: {},
  extra_form_data: {},
  adhoc_filters: [],
  order_desc: false,
  row_limit: 0,
  row_offset: 0,
  time_grain_sqla: undefined,
  vizType: 'echarts_timeseries',
  dateFormat: 'smart_date',
  numberFormat: 'SMART_NUMBER',
};

const defaultProps: TimeseriesChartTransformedProps = {
  echartOptions: {} as EChartsCoreOption,
  formData: defaultFormData,
  height: 400,
  width: 800,
  onContextMenu: jest.fn(),
  setDataMask: jest.fn(),
  onLegendStateChanged: jest.fn(),
  refs: {},
  emitCrossFilters: false,
  coltypeMapping: {},
  onLegendScroll: jest.fn(),
  groupby: [],
  labelMap: {},
  setControlValue: jest.fn(),
  selectedValues: {},
  legendData: [],
  xValueFormatter: String,
  xAxis: {
    label: 'x',
    type: AxisType.Time,
  },
  onFocusedSeries: jest.fn(),
};

function getLatestEchartProps() {
  const lastCall = mockEchart.mock.calls.at(-1);
  expect(lastCall).toBeDefined();
  const [props] = lastCall as [EchartsProps];
  return props;
}

function getLatestHeight() {
  return getLatestEchartProps().height;
}

test('observes extra control height changes when ResizeObserver is available', async () => {
  const disconnectSpy = jest.fn();
  const observeSpy = jest.fn();

  class MockResizeObserver implements ResizeObserver {
    private static latestInstance: MockResizeObserver | null = null;
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      MockResizeObserver.latestInstance = this;
    }

    observe = (target: Element) => {
      observeSpy(target);
    };

    unobserve(_target: Element): void {}

    disconnect = () => {
      disconnectSpy();
    };

    trigger(entries: ResizeObserverEntry[] = []) {
      this.callback(entries, this);
    }

    static getLatestInstance() {
      return this.latestInstance;
    }
  }

  (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
    MockResizeObserver as unknown as typeof ResizeObserver;

  mockOffsetHeight = 42;
  const { unmount } = render(<EchartsTimeseries {...defaultProps} />);

  await waitFor(() => {
    expect(getLatestHeight()).toBe(defaultProps.height - mockOffsetHeight);
  });

  expect(observeSpy).toHaveBeenCalledWith(expect.any(HTMLElement));

  mockOffsetHeight = 24;
  MockResizeObserver.getLatestInstance()?.trigger();

  await waitFor(() => {
    expect(getLatestHeight()).toBe(defaultProps.height - mockOffsetHeight);
  });

  expect(disconnectSpy).not.toHaveBeenCalled();

  expect(MockResizeObserver.getLatestInstance()).not.toBeNull();

  unmount();

  expect(disconnectSpy).toHaveBeenCalled();
});

test('uses the post-control body height for compact custom-legend visibility', async () => {
  mockOffsetHeight = 40;
  const { queryByTestId } = render(
    <EchartsTimeseries
      {...defaultProps}
      height={140}
      echartOptions={{
        grid: { bottom: 80, containLabel: true, top: 20 },
      }}
      formData={{ ...defaultFormData, zoomable: true }}
      customLegend={
        {
          grid: { bottom: 80, top: 20 },
          items: Array.from({ length: 20 }, (_, index) => ({
            color: '#123456',
            interactive: true,
            name: `Series ${index}`,
            selected: true,
          })),
          orientation: LegendOrientation.Top,
          showSelectors: true,
        } as never
      }
    />,
  );

  await waitFor(() => {
    expect(queryByTestId('timeseries-custom-legend')).not.toBeInTheDocument();
    expect(getLatestHeight()).toBe(100);
    expect(getLatestEchartProps().echartOptions.grid).toEqual({
      bottom: 80,
      containLabel: false,
      top: 12,
    });
  });
});

test('keeps a no-legend grid within a very small post-control body', async () => {
  mockOffsetHeight = 40;
  render(
    <EchartsTimeseries
      {...defaultProps}
      height={50}
      echartOptions={{
        grid: { bottom: 37, containLabel: false, top: 12 },
      }}
      formData={{ ...defaultFormData, zoomable: true }}
    />,
  );

  await waitFor(() => {
    expect(getLatestHeight()).toBe(10);
    expect(getLatestEchartProps().echartOptions.grid).toEqual({
      bottom: 0,
      containLabel: false,
      top: 9,
    });
  });
});

test('falls back to window resize listener when ResizeObserver is unavailable', async () => {
  (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
    undefined;

  const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
  const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

  mockOffsetHeight = 30;

  const { unmount } = render(<EchartsTimeseries {...defaultProps} />);

  await waitFor(() => {
    expect(getLatestHeight()).toBe(defaultProps.height - mockOffsetHeight);
  });

  expect(addEventListenerSpy).toHaveBeenCalledWith(
    'resize',
    expect.any(Function),
  );

  mockOffsetHeight = 10;
  window.dispatchEvent(new Event('resize'));

  await waitFor(() => {
    expect(getLatestHeight()).toBe(defaultProps.height - mockOffsetHeight);
  });

  unmount();

  expect(removeEventListenerSpy).toHaveBeenCalledWith(
    'resize',
    expect.any(Function),
  );

  addEventListenerSpy.mockRestore();
  removeEventListenerSpy.mockRestore();
});

// Test for issue #25334: Bar chart cross-filter without dimensions
test('emits cross-filter on X-axis value when no dimensions and categorical X-axis', () => {
  jest.useFakeTimers();
  const setDataMaskMock = jest.fn();

  const propsWithCategoricalXAxis: TimeseriesChartTransformedProps = {
    ...defaultProps,
    emitCrossFilters: true,
    setDataMask: setDataMaskMock,
    groupby: [], // No dimensions
    xAxis: {
      label: 'category_column',
      type: AxisType.Category, // Categorical X-axis
    },
  };

  render(<EchartsTimeseries {...propsWithCategoricalXAxis} />);

  // Get the click handler from the mock
  const lastCall = mockEchart.mock.calls.at(-1);
  expect(lastCall).toBeDefined();
  const [props] = lastCall as [EchartsProps];
  expect(props.eventHandlers).toBeDefined();
  expect(props.eventHandlers?.click).toBeDefined();

  // Simulate a click event with X-axis data
  const clickHandler = props.eventHandlers?.click;
  if (clickHandler) {
    clickHandler({
      componentType: 'series',
      seriesName: 'Sales', // This is the metric name
      data: ['Product A', 100], // X-axis value is 'Product A'
      name: 'Product A',
      dataIndex: 0,
    });

    advanceClickTimer();

    // Verify the cross-filter uses the X-axis column and value, not the metric
    const dataMaskCall = setDataMaskMock.mock.calls[0][0];
    expect(dataMaskCall.extraFormData.filters).toEqual([
      {
        col: 'category_column', // X-axis column
        op: 'IN',
        val: ['Product A'], // X-axis value, not 'Sales' (metric)
      },
    ]);
  }
});

test('emits cross-filter on category value for horizontal bar clicks', () => {
  jest.useFakeTimers();
  const setDataMaskMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      formData={{
        ...defaultFormData,
        orientation: OrientationType.Horizontal,
      }}
      xAxis={{
        label: 'category_column',
        type: AxisType.Category,
      }}
    />,
  );

  const clickHandler = getLatestEchartProps().eventHandlers?.click;
  expect(clickHandler).toBeDefined();
  clickHandler?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [100, 'Product A'],
    name: 'Product A',
    dataIndex: 0,
  });

  advanceClickTimer();

  expect(setDataMaskMock.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'category_column',
      op: 'IN',
      val: ['Product A'],
    },
  ]);
});

test('uses rendered categorical axis for query event handlers', () => {
  render(
    <EchartsTimeseries
      {...defaultProps}
      xAxis={{
        label: 'category_column',
        type: AxisType.Category,
      }}
    />,
  );

  expect(getLatestEchartProps().queryEventHandlers?.[0].query).toBe('xAxis');

  cleanup();
  mockEchart.mockReset();

  render(
    <EchartsTimeseries
      {...defaultProps}
      formData={{
        ...defaultFormData,
        orientation: OrientationType.Horizontal,
      }}
      xAxis={{
        label: 'category_column',
        type: AxisType.Category,
      }}
    />,
  );

  expect(getLatestEchartProps().queryEventHandlers?.[0].query).toBe('yAxis');
});

test('emits cross-filter from horizontal categorical axis label clicks', () => {
  const setDataMaskMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      formData={{
        ...defaultFormData,
        orientation: OrientationType.Horizontal,
      }}
      xAxis={{
        label: 'category_column',
        type: AxisType.Category,
      }}
    />,
  );

  const labelClickHandler =
    getLatestEchartProps().queryEventHandlers?.[0].handler;
  expect(labelClickHandler).toBeDefined();
  labelClickHandler?.({
    targetType: 'axisLabel',
    value: 'Product A',
  } as unknown as ECElementEvent);

  expect(setDataMaskMock.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'category_column',
      op: 'IN',
      val: ['Product A'],
    },
  ]);
});

test('does not emit duplicate cross-filter for generic axis label clicks', () => {
  jest.useFakeTimers();
  const setDataMaskMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      xAxis={{
        label: 'category_column',
        type: AxisType.Category,
      }}
    />,
  );

  const clickHandler = getLatestEchartProps().eventHandlers?.click;
  expect(clickHandler).toBeDefined();
  clickHandler?.({
    componentType: 'xAxis',
    name: 'Product A',
  });

  jest.advanceTimersByTime(400);
  expect(setDataMaskMock).not.toHaveBeenCalled();
});

test('keeps temporal range exclusive ends on whole-second boundaries', () => {
  const clickedTimestamp = new Date(Date.UTC(2021, 0, 15, 12, 34, 56, 789));

  [TimeGranularity.DAY, TimeGranularity.MONTH, TimeGranularity.YEAR].forEach(
    grain => {
      const [, inclusiveEnd] = createTimeRangeFromGranularity(
        clickedTimestamp,
        grain,
        false,
      );
      const exclusiveEnd = new Date(inclusiveEnd.getTime() + 1);

      expect(exclusiveEnd.getUTCMilliseconds()).toBe(0);
    },
  );
});

test('emits TEMPORAL_RANGE cross-filter from time axis label click on day bucket', () => {
  const setDataMaskMock = jest.fn();

  const propsWithTimeXAxis: TimeseriesChartTransformedProps = {
    ...defaultProps,
    emitCrossFilters: true,
    setDataMask: setDataMaskMock,
    groupby: [], // No dimensions
    resolvedTimeGrain: TimeGranularity.DAY,
    formData: {
      ...defaultFormData,
      granularitySqla: 'ds',
      timeGrainSqla: TimeGranularity.DAY,
    },
    xAxis: {
      label: DTTM_ALIAS,
      type: AxisType.Time,
    },
  };

  render(<EchartsTimeseries {...propsWithTimeXAxis} />);

  const labelClickHandler = getLatestEchartProps().queryEventHandlers?.find(
    ({ query }) => query === 'xAxis',
  )?.handler;
  expect(labelClickHandler).toBeDefined();
  labelClickHandler?.({
    targetType: 'axisLabel',
    value: '2021-01-01',
  } as unknown as ECElementEvent);

  expect(setDataMaskMock.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2021-01-02T00:00:00',
    },
  ]);
});

test('emits TEMPORAL_RANGE cross-filter from time axis label click on month bucket', () => {
  const setDataMaskMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      groupby={[]}
      resolvedTimeGrain={TimeGranularity.MONTH}
      formData={{
        ...defaultFormData,
        granularitySqla: 'ds',
        timeGrainSqla: TimeGranularity.MONTH,
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const labelClickHandler = getLatestEchartProps().queryEventHandlers?.find(
    ({ query }) => query === 'xAxis',
  )?.handler;
  expect(labelClickHandler).toBeDefined();
  labelClickHandler?.({
    targetType: 'axisLabel',
    value: '2021-01-01',
  } as unknown as ECElementEvent);

  expect(setDataMaskMock.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2021-02-01T00:00:00',
    },
  ]);
});

test('emits TEMPORAL_RANGE cross-filter from time axis label click on year bucket', () => {
  const setDataMaskMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      groupby={[]}
      resolvedTimeGrain={TimeGranularity.YEAR}
      formData={{
        ...defaultFormData,
        granularitySqla: 'ds',
        timeGrainSqla: TimeGranularity.YEAR,
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const labelClickHandler = getLatestEchartProps().queryEventHandlers?.find(
    ({ query }) => query === 'xAxis',
  )?.handler;
  expect(labelClickHandler).toBeDefined();
  labelClickHandler?.({
    targetType: 'axisLabel',
    value: '2021-01-01',
  } as unknown as ECElementEvent);

  expect(setDataMaskMock.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2022-01-01T00:00:00',
    },
  ]);
});

test('emits upper-exclusive TEMPORAL_RANGE from time point click on month bucket', () => {
  jest.useFakeTimers();
  const setDataMaskMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      groupby={[]}
      resolvedTimeGrain={TimeGranularity.MONTH}
      formData={{
        ...defaultFormData,
        granularitySqla: 'ds',
        timeGrainSqla: TimeGranularity.MONTH,
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const clickHandler = getLatestEchartProps().eventHandlers?.click;
  expect(clickHandler).toBeDefined();
  clickHandler?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [Date.UTC(2021, 0, 1), 100],
    name: '2021-01-01',
    dataIndex: 0,
  });

  advanceClickTimer();

  expect(setDataMaskMock.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2021-02-01T00:00:00',
    },
  ]);
});

test('emits TEMPORAL_RANGE from string-typed time point click value', () => {
  jest.useFakeTimers();
  const setDataMaskMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      groupby={[]}
      resolvedTimeGrain={TimeGranularity.MONTH}
      formData={{
        ...defaultFormData,
        granularitySqla: 'ds',
        timeGrainSqla: TimeGranularity.MONTH,
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const clickHandler = getLatestEchartProps().eventHandlers?.click;
  expect(clickHandler).toBeDefined();
  clickHandler?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: ['2021-01-01T00:00:00Z', 100],
    name: '2021-01-01',
    dataIndex: 0,
  });

  advanceClickTimer();

  expect(setDataMaskMock.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2021-02-01T00:00:00',
    },
  ]);
});

test('uses resolved time grain for temporal point-click cross-filter', () => {
  jest.useFakeTimers();
  const setDataMaskMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      groupby={[]}
      resolvedTimeGrain={TimeGranularity.MONTH}
      formData={{
        ...defaultFormData,
        granularitySqla: 'ds',
        timeGrainSqla: TimeGranularity.DAY,
        extraFormData: {
          time_grain_sqla: TimeGranularity.MONTH,
        },
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const clickHandler = getLatestEchartProps().eventHandlers?.click;
  expect(clickHandler).toBeDefined();
  clickHandler?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [Date.UTC(2021, 0, 1), 100],
    name: '2021-01-01',
    dataIndex: 0,
  });

  advanceClickTimer();

  expect(setDataMaskMock.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2021-02-01T00:00:00',
    },
  ]);
});

test('emits TEMPORAL_RANGE from horizontal time point click using timestamp, not metric', () => {
  jest.useFakeTimers();
  const setDataMaskMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      groupby={[]}
      resolvedTimeGrain={TimeGranularity.MONTH}
      formData={{
        ...defaultFormData,
        orientation: OrientationType.Horizontal,
        granularitySqla: 'ds',
        timeGrainSqla: TimeGranularity.MONTH,
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const clickHandler = getLatestEchartProps().eventHandlers?.click;
  expect(clickHandler).toBeDefined();
  clickHandler?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [129, Date.UTC(2021, 0, 1)],
    name: '2021-01-01',
    dataIndex: 0,
  });

  advanceClickTimer();

  expect(setDataMaskMock.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2021-02-01T00:00:00',
    },
  ]);
});

test('emits TEMPORAL_RANGE cross-filter from horizontal time axis label click', () => {
  const setDataMaskMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      groupby={[]}
      resolvedTimeGrain={TimeGranularity.MONTH}
      formData={{
        ...defaultFormData,
        orientation: OrientationType.Horizontal,
        granularitySqla: 'ds',
        timeGrainSqla: TimeGranularity.MONTH,
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const labelClickHandler = getLatestEchartProps().queryEventHandlers?.find(
    ({ query }) => query === 'yAxis',
  )?.handler;
  expect(labelClickHandler).toBeDefined();
  labelClickHandler?.({
    targetType: 'axisLabel',
    value: '2021-01-01',
  } as unknown as ECElementEvent);

  expect(setDataMaskMock.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2021-02-01T00:00:00',
    },
  ]);
});

test('warns and skips temporal axis label cross-filter when label value cannot be parsed', () => {
  const setDataMaskMock = jest.fn();
  const warn = jest.spyOn(logging, 'warn').mockImplementation();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      groupby={[]}
      formData={{
        ...defaultFormData,
        granularitySqla: 'ds',
        timeGrainSqla: TimeGranularity.MONTH,
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const labelClickHandler = getLatestEchartProps().queryEventHandlers?.find(
    ({ query }) => query === 'xAxis',
  )?.handler;
  expect(labelClickHandler).toBeDefined();
  labelClickHandler?.({
    targetType: 'axisLabel',
    value: 'not-a-date',
  } as unknown as ECElementEvent);

  expect(setDataMaskMock).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith(
    'Unable to parse time axis value for cross-filtering',
    'not-a-date',
  );

  warn.mockRestore();
});

test('logs and skips temporal point-click cross-filter when string value cannot be parsed', () => {
  jest.useFakeTimers();
  const setDataMaskMock = jest.fn();
  const warn = jest.spyOn(logging, 'warn').mockImplementation();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      groupby={[]}
      resolvedTimeGrain={TimeGranularity.MONTH}
      formData={{
        ...defaultFormData,
        granularitySqla: 'ds',
        timeGrainSqla: TimeGranularity.MONTH,
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const clickHandler = getLatestEchartProps().eventHandlers?.click;
  expect(clickHandler).toBeDefined();
  clickHandler?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: ['not-a-date', 100],
    name: 'not-a-date',
    dataIndex: 0,
  });

  advanceClickTimer();

  expect(setDataMaskMock).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith(
    'Unable to parse time axis value for cross-filtering',
    'not-a-date',
  );

  warn.mockRestore();
});

test('emits empty temporal X-axis data mask when filter grain is missing', () => {
  jest.useFakeTimers();
  const setDataMaskMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      groupby={[]}
      formData={{
        ...defaultFormData,
        granularitySqla: 'ds',
        timeGrainSqla: undefined,
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const clickHandler = getLatestEchartProps().eventHandlers?.click;
  expect(clickHandler).toBeDefined();
  clickHandler?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [Date.UTC(2021, 0, 1), 100],
    name: '2021-01-01',
    dataIndex: 0,
  });

  advanceClickTimer();

  expect(setDataMaskMock.mock.calls[0][0]).toEqual({
    extraFormData: {
      filters: [],
    },
    filterState: {
      label: undefined,
      value: null,
      selectedValues: null,
    },
  });
});

test('clears temporal X-axis cross-filter when clicking selected bucket again', () => {
  jest.useFakeTimers();
  const setDataMaskMock = jest.fn();
  const selectedRange = '2021-01-01T00:00:00 : 2021-02-01T00:00:00';

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      groupby={[]}
      selectedValues={{ 0: selectedRange }}
      resolvedTimeGrain={TimeGranularity.MONTH}
      formData={{
        ...defaultFormData,
        granularitySqla: 'ds',
        timeGrainSqla: TimeGranularity.MONTH,
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const clickHandler = getLatestEchartProps().eventHandlers?.click;
  expect(clickHandler).toBeDefined();
  clickHandler?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [Date.UTC(2021, 0, 1), 100],
    name: '2021-01-01',
    dataIndex: 0,
  });

  advanceClickTimer();

  expect(setDataMaskMock.mock.calls[0][0]).toEqual({
    extraFormData: {
      filters: [],
    },
    filterState: {
      label: undefined,
      value: null,
      selectedValues: null,
    },
  });
});

test('does not emit temporal X-axis label cross-filter when dimensions are set', () => {
  const setDataMaskMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      groupby={['country']}
      formData={{
        ...defaultFormData,
        groupby: ['country'],
        granularitySqla: 'ds',
        timeGrainSqla: TimeGranularity.MONTH,
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const labelClickHandler = getLatestEchartProps().queryEventHandlers?.find(
    ({ query }) => query === 'xAxis',
  )?.handler;
  expect(labelClickHandler).toBeDefined();
  labelClickHandler?.({
    targetType: 'axisLabel',
    value: '2021-01-01',
  } as unknown as ECElementEvent);

  expect(setDataMaskMock).not.toHaveBeenCalled();
});

test('does not emit temporal X-axis cross-filter when dimensions are set', () => {
  jest.useFakeTimers();
  const setDataMaskMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      setDataMask={setDataMaskMock}
      groupby={['country']}
      labelMap={{
        Sales: ['US'],
      }}
      formData={{
        ...defaultFormData,
        groupby: ['country'],
        granularitySqla: 'ds',
        timeGrainSqla: TimeGranularity.MONTH,
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const clickHandler = getLatestEchartProps().eventHandlers?.click;
  expect(clickHandler).toBeDefined();
  clickHandler?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [Date.UTC(2021, 0, 1), 100],
    name: '2021-01-01',
    dataIndex: 0,
  });

  advanceClickTimer();

  expect(setDataMaskMock.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'country',
      op: 'IN',
      val: ['US'],
    },
  ]);
  expect(
    setDataMaskMock.mock.calls[0][0].extraFormData.filters.some(
      (filter: { op: string }) => filter.op === 'TEMPORAL_RANGE',
    ),
  ).toBe(false);
});

// Test for issue #41102: horizontal bar cross-filter must use the category
// value, not the metric. For horizontal bars the data tuple is value-first
// (e.g. [100, 'Product A']), so relying on data[0] emitted the metric value.
test('emits cross-filter on the category value for a horizontal categorical bar', () => {
  jest.useFakeTimers();
  const setDataMaskMock = jest.fn();

  const propsWithHorizontalXAxis: TimeseriesChartTransformedProps = {
    ...defaultProps,
    emitCrossFilters: true,
    setDataMask: setDataMaskMock,
    formData: {
      ...defaultFormData,
      orientation: OrientationType.Horizontal,
    },
    groupby: [], // No dimensions
    xAxis: {
      label: 'category_column',
      type: AxisType.Category, // Categorical X-axis
    },
  };

  render(<EchartsTimeseries {...propsWithHorizontalXAxis} />);

  const lastCall = mockEchart.mock.calls.at(-1);
  expect(lastCall).toBeDefined();
  const [props] = lastCall as [EchartsProps];

  const clickHandler = props.eventHandlers?.click;
  if (clickHandler) {
    clickHandler({
      componentType: 'series',
      seriesName: 'Sales', // This is the metric name
      data: [100, 'Product A'], // Horizontal: value first, category second
      name: 'Product A',
      dataIndex: 0,
    });

    advanceClickTimer();

    // Must filter on the category ('Product A'), not the metric value (100)
    const dataMaskCall = setDataMaskMock.mock.calls[0][0];
    expect(dataMaskCall.extraFormData.filters).toEqual([
      {
        col: 'category_column',
        op: 'IN',
        val: ['Product A'],
      },
    ]);
  }
});

test('context menu cross-filter is available for a temporal bar point', async () => {
  const onContextMenuMock = jest.fn();

  render(
    <EchartsTimeseries
      {...defaultProps}
      emitCrossFilters
      onContextMenu={onContextMenuMock}
      groupby={[]}
      resolvedTimeGrain={TimeGranularity.MONTH}
      formData={{
        ...defaultFormData,
        granularitySqla: 'ds',
        timeGrainSqla: TimeGranularity.DAY,
        extraFormData: {
          time_grain_sqla: TimeGranularity.MONTH,
        },
      }}
      xAxis={{
        label: DTTM_ALIAS,
        type: AxisType.Time,
      }}
    />,
  );

  const contextMenuHandler = getLatestEchartProps().eventHandlers?.contextmenu;
  expect(contextMenuHandler).toBeDefined();
  await contextMenuHandler?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [Date.UTC(2021, 0, 1), 100],
    name: '2021-01-01',
    event: { stop: jest.fn(), event: { clientX: 10, clientY: 20 } },
  });

  await waitFor(() => {
    expect(onContextMenuMock).toHaveBeenCalled();
  });

  const { crossFilter } = onContextMenuMock.mock.calls[0][2];
  expect(crossFilter.dataMask.extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2021-02-01T00:00:00',
    },
  ]);
});

// Test for issue #41102: the context-menu ("Add cross-filter") path must also
// use the category value, not the metric, for a horizontal categorical bar.
test('context menu cross-filter uses the category value for a horizontal categorical bar', async () => {
  const onContextMenuMock = jest.fn();

  const propsWithHorizontalXAxis: TimeseriesChartTransformedProps = {
    ...defaultProps,
    emitCrossFilters: true,
    onContextMenu: onContextMenuMock,
    formData: {
      ...defaultFormData,
      orientation: OrientationType.Horizontal,
    },
    groupby: [], // No dimensions
    xAxis: {
      label: 'category_column',
      type: AxisType.Category, // Categorical X-axis
    },
  };

  render(<EchartsTimeseries {...propsWithHorizontalXAxis} />);

  const lastCall = mockEchart.mock.calls.at(-1);
  expect(lastCall).toBeDefined();
  const [props] = lastCall as [EchartsProps];

  const contextMenuHandler = props.eventHandlers?.contextmenu;
  expect(contextMenuHandler).toBeDefined();
  if (contextMenuHandler) {
    await contextMenuHandler({
      componentType: 'series',
      seriesName: 'Sales', // This is the metric name
      data: [100, 'Product A'], // Horizontal: value first, category second
      name: 'Product A',
      event: { stop: jest.fn(), event: { clientX: 10, clientY: 20 } },
    });

    await waitFor(() => {
      expect(onContextMenuMock).toHaveBeenCalled();
    });

    // The cross-filter must use the category ('Product A'), not the metric (100)
    const { crossFilter } = onContextMenuMock.mock.calls[0][2];
    expect(crossFilter.dataMask.extraFormData.filters).toEqual([
      {
        col: 'category_column',
        op: 'IN',
        val: ['Product A'],
      },
    ]);
  }
});

// A category axis can still sit on a temporal column when the axis is
// forced categorical (xAxisForceCategorical); the drillBy x-axis filter must
// then bucket by the configured time grain rather than doing an exact match.
test('drillBy filters by time bucket when a categorical axis is forced onto a temporal column', async () => {
  const onContextMenuMock = jest.fn();

  const propsWithForcedCategoricalTemporalAxis: TimeseriesChartTransformedProps =
    {
      ...defaultProps,
      onContextMenu: onContextMenuMock,
      formData: {
        ...defaultFormData,
        xAxisForceCategorical: true,
        timeGrainSqla: TimeGranularity.MONTH,
      },
      coltypeMapping: { order_date: GenericDataType.Temporal },
      xAxis: {
        label: 'order_date',
        type: AxisType.Category,
      },
    };

  render(<EchartsTimeseries {...propsWithForcedCategoricalTemporalAxis} />);

  const contextMenuHandler = getLatestEchartProps().eventHandlers?.contextmenu;
  expect(contextMenuHandler).toBeDefined();
  await contextMenuHandler?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: ['2021-02-01T00:00:00', 100],
    name: '2021-02-01T00:00:00',
    event: { stop: jest.fn(), event: { clientX: 10, clientY: 20 } },
  });

  await waitFor(() => {
    expect(onContextMenuMock).toHaveBeenCalled();
  });

  const { drillBy } = onContextMenuMock.mock.calls[0][2];
  expect(drillBy.xAxisFilters).toEqual([
    {
      col: 'order_date',
      op: 'TEMPORAL_RANGE',
      val: '2021-02-01T00:00:00 : 2021-03-01T00:00:00',
      formattedVal: '2021-02-01T00:00:00',
    },
  ]);
});

// For horizontal orientation the [x, value] pair reported by ECharts is
// swapped, so the drillBy x-axis filter must read the clicked time value
// from the second element of the data tuple rather than the first.
test('drillBy uses the swapped data index for a horizontal time-based axis', async () => {
  const onContextMenuMock = jest.fn();

  const propsWithHorizontalTimeAxis: TimeseriesChartTransformedProps = {
    ...defaultProps,
    onContextMenu: onContextMenuMock,
    formData: {
      ...defaultFormData,
      orientation: OrientationType.Horizontal,
    },
    xAxis: {
      label: 'order_date',
      type: AxisType.Time,
    },
  };

  render(<EchartsTimeseries {...propsWithHorizontalTimeAxis} />);

  const contextMenuHandler = getLatestEchartProps().eventHandlers?.contextmenu;
  expect(contextMenuHandler).toBeDefined();
  await contextMenuHandler?.({
    componentType: 'series',
    seriesName: 'Sales',
    // Horizontal: value first, x (time) value second
    data: [100, '2021-02-01T00:00:00'],
    name: '2021-02-01T00:00:00',
    event: { stop: jest.fn(), event: { clientX: 10, clientY: 20 } },
  });

  await waitFor(() => {
    expect(onContextMenuMock).toHaveBeenCalled();
  });

  const { drillBy } = onContextMenuMock.mock.calls[0][2];
  expect(drillBy.xAxisFilters).toEqual([
    {
      col: 'order_date',
      op: '==',
      val: '2021-02-01T00:00:00',
      formattedVal: '2021-02-01T00:00:00',
    },
  ]);
});
