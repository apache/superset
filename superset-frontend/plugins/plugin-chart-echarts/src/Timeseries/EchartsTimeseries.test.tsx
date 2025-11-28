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
import type { EChartsCoreOption } from 'echarts/core';
import type { ReactNode } from 'react';
import { AxisType } from '@superset-ui/core';
import {
  render,
  waitFor,
  cleanup,
} from '../../../../spec/helpers/testing-library';
import {
  LegendOrientation,
  LegendType,
  type EchartsHandler,
  type EchartsProps,
} from '../types';
import EchartsTimeseries from './EchartsTimeseries';
import {
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
  cleanup();
  mockEchart.mockReset();
  (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
    originalResizeObserver;
});

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
  xAxisTitleMargin: 0,
  yAxisTitle: '',
  yAxisTitleMargin: 0,
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

function getLatestHeight() {
  const lastCall = mockEchart.mock.calls.at(-1);
  expect(lastCall).toBeDefined();
  const [props] = lastCall as [EchartsProps];
  return props.height;
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
