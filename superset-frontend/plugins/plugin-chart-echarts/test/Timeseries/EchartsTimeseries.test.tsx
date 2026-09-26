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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AxisType, DTTM_ALIAS, TimeGranularity } from '@superset-ui/core';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import { logging } from '@apache-superset/core/utils';
import type { ECElementEvent } from 'echarts/types/src/util/types';
import EchartsTimeseries from '../../src/Timeseries/EchartsTimeseries';
import {
  OrientationType,
  TimeseriesChartTransformedProps,
} from '../../src/Timeseries/types';
import type { EchartsProps } from '../../src/types';
import { LegendOrientation } from '../../src/types';

jest.mock('@visx/responsive', () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: object) => React.ReactNode;
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const hostRef = React.useRef<HTMLDivElement>(null);
    const [size, setSize] = React.useState<{
      height: number;
      width: number;
    }>();

    React.useLayoutEffect(() => {
      const frame = hostRef.current?.closest<HTMLElement>('.with-legend');
      const legend = frame?.querySelector<HTMLElement>(
        '[data-test="timeseries-custom-legend"]',
      );
      if (!frame || !legend) {
        return;
      }

      const frameHeight = Number.parseFloat(frame.style.height);
      const frameWidth = Number.parseFloat(frame.style.width);
      const maxHeight = Number.parseFloat(
        globalThis.getComputedStyle(legend).maxHeight,
      );
      const itemCount = legend.querySelectorAll('[aria-pressed]').length;
      const selectorHeight = legend.querySelectorAll('[aria-pressed]').length
        ? 20
        : 0;
      const naturalHeight = selectorHeight + Math.ceil(itemCount / 4) * 20;
      setSize({
        height: frameHeight - Math.min(maxHeight, naturalHeight),
        width: frameWidth,
      });
    }, []);

    return <div ref={hostRef}>{size ? children(size) : null}</div>;
  },
}));

// Percent-change draggable baseline: this is the one piece of the ECharts
// rebuilds with zero prior test coverage despite six separate production
// bugs fixed against it (crash from a non-group graphic element, hardcoded
// colors, NaN from category-axis coercion, baseline resetting on rerender,
// unthrottled setOption calls, a getOption() undefined crash on warm nav).
// Echart itself is mocked as a forwardRef exposing a controllable fake
// EChartsType instance, since the baseline/drag logic drives the chart
// imperatively (setOption/convertToPixel/convertFromPixel) rather than
// through props. Defined inside the mock factory (rather than via
// mockImplementation afterward) because forwardRef() returns a React
// element descriptor, not a plain function a jest mock can invoke.
let mockChart: {
  dispatchAction: jest.Mock;
  setOption: jest.Mock;
  getHeight: jest.Mock;
  convertToPixel: jest.Mock;
  convertFromPixel: jest.Mock;
  getModel: jest.Mock;
};
const mockEchart = jest.fn();

jest.mock('../../src/components/Echart', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  return {
    __esModule: true,
    default: forwardRef((props: unknown, ref: unknown) => {
      mockEchart(props);
      useImperativeHandle(ref, () => ({
        getEchartInstance: () => mockChart,
      }));
      const { height } = props as { height: number };
      return <div data-height={height} data-test="mock-echart" />;
    }),
  };
});

const PX_PER_UNIT = 100;

function setupChartMock() {
  mockChart = {
    dispatchAction: jest.fn(),
    setOption: jest.fn(),
    getHeight: jest.fn(() => 400),
    // A trivial, invertible mapping so drag pixel deltas translate to
    // predictable x-data-value deltas: pixel = x * PX_PER_UNIT.
    convertToPixel: jest.fn((_finder: unknown, x: number) => x * PX_PER_UNIT),
    convertFromPixel: jest.fn(
      (_finder: unknown, px: number) => px / PX_PER_UNIT,
    ),
    // No grid component registered; drawHandle() falls back to the full
    // chart height, matching real behavior when the lookup throws.
    getModel: jest.fn(() => {
      throw new Error('no grid component in this test double');
    }),
  };
}

function getCustomLegend(
  itemCount: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    items: Array.from({ length: itemCount }, (_, index) => ({
      color: `rgb(${index % 255}, 0, 0)`,
      interactive: true,
      name: `Series ${index + 1}`,
      selected: true,
    })),
    orientation: LegendOrientation.Top,
    grid: { bottom: 20, top: 20 },
    showSelectors: true,
    ...overrides,
  };
}

const BASE_SERIES_DATA: [number, number][] = [
  [0, 10],
  [1, 20],
  [2, 30],
];

function renderTimeseries(
  overrides: Partial<TimeseriesChartTransformedProps> = {},
) {
  const props: TimeseriesChartTransformedProps = {
    formData: {
      rebasePercentChange: true,
      vizType: 'echarts_timeseries_line',
    } as any,
    height: 400,
    width: 800,
    echartOptions: { series: [{ data: BASE_SERIES_DATA }] } as any,
    groupby: [],
    labelMap: {},
    selectedValues: {},
    setDataMask: jest.fn(),
    setControlValue: jest.fn(),
    legendData: [],
    onContextMenu: jest.fn(),
    onLegendStateChanged: jest.fn(),
    onFocusedSeries: jest.fn(),
    xValueFormatter: String,
    xAxis: { label: 'x', type: AxisType.Time },
    refs: {},
    emitCrossFilters: false,
    coltypeMapping: {},
    onLegendScroll: jest.fn(),
    ...overrides,
  };
  return render(
    <ThemeProvider theme={supersetTheme}>
      <EchartsTimeseries {...props} />
    </ThemeProvider>,
  );
}

function getLatestEchartProps() {
  const lastCall = mockEchart.mock.calls.at(-1);
  expect(lastCall).toBeDefined();
  const [props] = lastCall as [EchartsProps];
  return props;
}

function advanceClickTimer() {
  jest.advanceTimersByTime(300);
}

// Pulls the graphic descriptor for the draggable baseline handle out of the
// most recent setOption call, mirroring how ECharts itself would read it.
function getBaselineGraphic() {
  const call = mockChart.setOption.mock.calls
    .filter(([option]) => Array.isArray(option?.graphic))
    .at(-1);
  return call?.[0].graphic[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEchart.mockReset();
  setupChartMock();
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('renders fitting content at the allocated height without a scroll viewport', () => {
  const { container } = renderTimeseries();

  expect(screen.getByTestId('mock-echart')).toHaveAttribute(
    'data-height',
    '400',
  );
  expect(container.querySelector('[style*="overflow-y"]')).toBeNull();
});

test('caps a dense custom Plain legend while keeping scrolling inside the legend region', () => {
  renderTimeseries({
    ...({ customLegend: getCustomLegend(200) } as any),
    formData: { rebasePercentChange: false } as any,
  });

  const legend = screen.getByTestId('timeseries-custom-legend');
  expect(legend).toHaveStyle({
    maxHeight: '120px',
    overflowY: 'auto',
  });
  expect(legend.style.height).toBe('');
  expect(screen.getAllByRole('button')).toHaveLength(202);
  expect(screen.getByTestId('mock-echart')).toHaveAttribute(
    'data-height',
    '280',
  );
  expect(legend.closest('.with-legend')).toHaveStyle({
    height: '400px',
    width: '800px',
  });
});

test('lets a short custom Plain legend use its natural height', () => {
  renderTimeseries({
    ...({ customLegend: getCustomLegend(2) } as any),
    formData: { rebasePercentChange: false } as any,
  });

  const legend = screen.getByTestId('timeseries-custom-legend');
  expect(legend).toHaveStyle({ maxHeight: '120px' });
  expect(legend.style.height).toBe('');
  expect(screen.getAllByRole('button')).toHaveLength(4);
  expect(screen.getByTestId('mock-echart')).toHaveAttribute(
    'data-height',
    '360',
  );
});

test.each([
  [99, 99],
  [100, 100],
  [120, 120],
])(
  'does not allocate a custom legend when a %ipx zoomable chart has no usable grid space',
  (height, expectedChartHeight) => {
    renderTimeseries({
      ...({
        customLegend: getCustomLegend(200, {
          grid: { bottom: 80, top: 20 },
        }),
      } as any),
      formData: { rebasePercentChange: false, zoomable: true } as any,
      height,
    });

    expect(
      screen.queryByTestId('timeseries-custom-legend'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-echart')).toHaveAttribute(
      'data-height',
      String(expectedChartHeight),
    );
  },
);

test('accounts for axis-title grid reservations when bounding the custom legend', () => {
  renderTimeseries({
    ...({
      customLegend: getCustomLegend(200, {
        grid: { bottom: 80, top: 60 },
      }),
    } as any),
    formData: { rebasePercentChange: false } as any,
    height: 240,
  });

  expect(screen.getByTestId('timeseries-custom-legend')).toHaveStyle({
    maxHeight: '20px',
  });
  expect(screen.getByTestId('mock-echart')).toHaveAttribute(
    'data-height',
    '220',
  );
});

test.each([
  [LegendOrientation.Top, 'column'],
  [LegendOrientation.Bottom, 'column-reverse'],
])('places a custom Plain legend at %s', (orientation, flexDirection) => {
  renderTimeseries({
    ...({
      customLegend: getCustomLegend(2, { orientation }),
    } as any),
    formData: { rebasePercentChange: false } as any,
  });

  expect(
    screen.getByTestId('timeseries-custom-legend').closest('.with-legend'),
  ).toHaveStyle({ flexDirection });
});

test('dispatches the native ECharts toggle, All, and Inverse legend actions', () => {
  renderTimeseries({
    ...({ customLegend: getCustomLegend(2) } as any),
    formData: { rebasePercentChange: false } as any,
  });

  fireEvent.click(screen.getByRole('button', { name: 'Series 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'All' }));
  fireEvent.click(screen.getByRole('button', { name: 'Inverse' }));

  expect(mockChart.dispatchAction.mock.calls).toEqual([
    [{ name: 'Series 1', type: 'legendToggleSelect' }],
    [{ type: 'legendAllSelect' }],
    [{ type: 'legendInverseSelect' }],
  ]);
});

test('does not dispatch legend actions for non-interactive color-by-primary-axis items', () => {
  renderTimeseries({
    ...({
      customLegend: getCustomLegend(2, {
        items: getCustomLegend(2).items.map(item => ({
          ...item,
          interactive: false,
        })),
        showSelectors: false,
      }),
    } as any),
    formData: { rebasePercentChange: false } as any,
  });

  const item = screen.getByRole('button', { name: 'Series 1' });
  expect(item).toBeDisabled();
  fireEvent.click(item);

  expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Inverse' }),
  ).not.toBeInTheDocument();
  expect(mockChart.dispatchAction).not.toHaveBeenCalled();
});

test('draws the baseline handle at the first x value on mount', () => {
  renderTimeseries();

  const graphic = getBaselineGraphic();
  expect(graphic).toMatchObject({
    id: 'percent-change-baseline',
    type: 'group',
    draggable: true,
  });
  // x=0 -> convertToPixel returns 0 -> handle left edge is centered on it.
  expect(graphic.x).toBe(0 - 4);
});

test('does not draw a baseline when the rebase flag is off', () => {
  renderTimeseries({ formData: { rebasePercentChange: false } as any });

  expect(getBaselineGraphic()).toBeUndefined();
});

test('dragging the handle rebases every series against the snapped x value', () => {
  renderTimeseries();
  const graphic = getBaselineGraphic();
  mockChart.setOption.mockClear();
  // Drag to a pixel position corresponding to x=1 (the middle point): with
  // PX_PER_UNIT=100 and the +4 offset the drag handler subtracts back out,
  // this.x + 4 must convertFromPixel to 1.
  const dragThis = { x: 1 * PX_PER_UNIT - 4, y: 0 };
  graphic.ondrag.call(dragThis);

  const rebaseCall = mockChart.setOption.mock.calls.find(([option]) =>
    Array.isArray(option?.series),
  );
  expect(rebaseCall).toBeDefined();
  const [{ series }] = rebaseCall!;
  // Rebased against x=1 (value 20): (1+v)/(1+20)-1 for each point.
  expect(series[0].data).toEqual([
    [0, (1 + 10) / (1 + 20) - 1],
    [1, 0],
    [2, (1 + 30) / (1 + 20) - 1],
  ]);
});

test('dragging snaps to the nearest known x value rather than an arbitrary pixel', () => {
  renderTimeseries();
  const graphic = getBaselineGraphic();
  mockChart.setOption.mockClear();
  // A pixel position just past x=1 (at 1.4) must snap to 1, not float.
  const dragThis = { x: 1.4 * PX_PER_UNIT - 4, y: 0 };
  graphic.ondrag.call(dragThis);

  const rebaseCall = mockChart.setOption.mock.calls.find(([option]) =>
    Array.isArray(option?.series),
  );
  const [{ series }] = rebaseCall!;
  expect(series[0].data[1]).toEqual([1, 0]);
});

test('dragging to the already-active baseline does not re-issue a redundant rebase', () => {
  renderTimeseries();
  const graphic = getBaselineGraphic();
  mockChart.setOption.mockClear();
  // The baseline starts at x=0; dragging to the same snapped value should
  // not trigger a second series update.
  graphic.ondrag.call({ x: 0 * PX_PER_UNIT - 4, y: 0 });

  const rebaseCall = mockChart.setOption.mock.calls.find(([option]) =>
    Array.isArray(option?.series),
  );
  expect(rebaseCall).toBeUndefined();
});

test('does not draw a baseline when the series has no plottable points', () => {
  renderTimeseries({
    echartOptions: { series: [{ data: [] }] } as any,
  });

  expect(getBaselineGraphic()).toBeUndefined();
});

test('ondragend redraws the handle at its current position', () => {
  renderTimeseries();
  const graphic = getBaselineGraphic();
  mockChart.setOption.mockClear();
  graphic.ondragend();

  expect(
    mockChart.setOption.mock.calls.some(([option]) =>
      Array.isArray(option?.graphic),
    ),
  ).toBe(true);
});

test('removes the baseline graphic on unmount', () => {
  const { unmount } = renderTimeseries();
  mockChart.setOption.mockClear();

  unmount();

  expect(mockChart.setOption).toHaveBeenCalledWith({
    graphic: [{ id: 'percent-change-baseline', $action: 'remove' }],
  });
});

test('does not touch the chart instance when rebase is disabled', () => {
  renderTimeseries({ formData: { rebasePercentChange: false } as any });

  expect(mockChart.setOption).not.toHaveBeenCalled();
});

test('emits TEMPORAL_RANGE cross-filter from time axis label click on day bucket', () => {
  const setDataMask = jest.fn();

  renderTimeseries({
    emitCrossFilters: true,
    setDataMask,
    groupby: [],
    resolvedTimeGrain: TimeGranularity.DAY,
    formData: {
      granularitySqla: 'ds',
      timeGrainSqla: TimeGranularity.DAY,
      vizType: 'echarts_timeseries_line',
    } as any,
    xAxis: {
      label: DTTM_ALIAS,
      type: AxisType.Time,
    },
  });

  const labelClickHandler = getLatestEchartProps().queryEventHandlers?.find(
    ({ query }) => query === 'xAxis',
  )?.handler;
  expect(labelClickHandler).toBeDefined();
  labelClickHandler?.({
    targetType: 'axisLabel',
    value: '2021-01-01',
  } as unknown as ECElementEvent);

  expect(setDataMask.mock.calls[0][0]).toEqual({
    extraFormData: {
      filters: [
        {
          col: 'ds',
          op: 'TEMPORAL_RANGE',
          val: '2021-01-01T00:00:00 : 2021-01-02T00:00:00',
        },
      ],
    },
    filterState: {
      label: ['2021-01-01T00:00:00 : 2021-01-02T00:00:00'],
      value: ['2021-01-01T00:00:00 : 2021-01-02T00:00:00'],
      selectedValues: ['2021-01-01T00:00:00 : 2021-01-02T00:00:00'],
    },
  });
});

test('emits upper-exclusive TEMPORAL_RANGE from time point click on month bucket', () => {
  jest.useFakeTimers();
  const setDataMask = jest.fn();

  renderTimeseries({
    emitCrossFilters: true,
    setDataMask,
    groupby: [],
    resolvedTimeGrain: TimeGranularity.MONTH,
    formData: {
      granularitySqla: 'ds',
      timeGrainSqla: TimeGranularity.MONTH,
      vizType: 'echarts_timeseries_line',
    } as any,
    xAxis: {
      label: DTTM_ALIAS,
      type: AxisType.Time,
    },
  });

  getLatestEchartProps().eventHandlers?.click?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [Date.UTC(2021, 0, 1), 100],
    name: '2021-01-01',
    dataIndex: 0,
  });
  advanceClickTimer();

  expect(setDataMask.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2021-02-01T00:00:00',
    },
  ]);
});

test('uses resolved time grain for temporal point-click cross-filter', () => {
  jest.useFakeTimers();
  const setDataMask = jest.fn();

  renderTimeseries({
    emitCrossFilters: true,
    setDataMask,
    groupby: [],
    resolvedTimeGrain: TimeGranularity.MONTH,
    formData: {
      granularitySqla: 'ds',
      timeGrainSqla: TimeGranularity.DAY,
      extraFormData: {
        time_grain_sqla: TimeGranularity.MONTH,
      },
      vizType: 'echarts_timeseries_line',
    } as any,
    xAxis: {
      label: DTTM_ALIAS,
      type: AxisType.Time,
    },
  });

  getLatestEchartProps().eventHandlers?.click?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [Date.UTC(2021, 0, 1), 100],
    name: '2021-01-01',
    dataIndex: 0,
  });
  advanceClickTimer();

  expect(setDataMask.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2021-02-01T00:00:00',
    },
  ]);
});

test('emits TEMPORAL_RANGE from string-typed time point click value', () => {
  jest.useFakeTimers();
  const setDataMask = jest.fn();

  renderTimeseries({
    emitCrossFilters: true,
    setDataMask,
    groupby: [],
    resolvedTimeGrain: TimeGranularity.MONTH,
    formData: {
      granularitySqla: 'ds',
      timeGrainSqla: TimeGranularity.MONTH,
      vizType: 'echarts_timeseries_line',
    } as any,
    xAxis: {
      label: DTTM_ALIAS,
      type: AxisType.Time,
    },
  });

  getLatestEchartProps().eventHandlers?.click?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: ['2021-01-01T00:00:00Z', 100],
    name: '2021-01-01',
    dataIndex: 0,
  });
  advanceClickTimer();

  expect(setDataMask.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2021-02-01T00:00:00',
    },
  ]);
});

test('emits TEMPORAL_RANGE from horizontal time point click using timestamp, not metric', () => {
  jest.useFakeTimers();
  const setDataMask = jest.fn();

  renderTimeseries({
    emitCrossFilters: true,
    setDataMask,
    groupby: [],
    resolvedTimeGrain: TimeGranularity.MONTH,
    formData: {
      orientation: OrientationType.Horizontal,
      granularitySqla: 'ds',
      timeGrainSqla: TimeGranularity.MONTH,
      vizType: 'echarts_timeseries_line',
    } as any,
    xAxis: {
      label: DTTM_ALIAS,
      type: AxisType.Time,
    },
  });

  getLatestEchartProps().eventHandlers?.click?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [129, Date.UTC(2021, 0, 1)],
    name: '2021-01-01',
    dataIndex: 0,
  });
  advanceClickTimer();

  expect(setDataMask.mock.calls[0][0].extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2021-02-01T00:00:00',
    },
  ]);
});

test('clears temporal X-axis cross-filter when clicking selected bucket again', () => {
  jest.useFakeTimers();
  const setDataMask = jest.fn();
  const selectedRange = '2021-01-01T00:00:00 : 2021-02-01T00:00:00';

  renderTimeseries({
    emitCrossFilters: true,
    setDataMask,
    groupby: [],
    selectedValues: { 0: selectedRange },
    resolvedTimeGrain: TimeGranularity.MONTH,
    formData: {
      granularitySqla: 'ds',
      timeGrainSqla: TimeGranularity.MONTH,
      vizType: 'echarts_timeseries_line',
    } as any,
    xAxis: {
      label: DTTM_ALIAS,
      type: AxisType.Time,
    },
  });

  getLatestEchartProps().eventHandlers?.click?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [Date.UTC(2021, 0, 1), 100],
    name: '2021-01-01',
    dataIndex: 0,
  });
  advanceClickTimer();

  expect(setDataMask.mock.calls[0][0]).toEqual({
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

test('emits empty temporal X-axis data mask when filter grain is missing', () => {
  jest.useFakeTimers();
  const setDataMask = jest.fn();

  renderTimeseries({
    emitCrossFilters: true,
    setDataMask,
    groupby: [],
    formData: {
      granularitySqla: 'ds',
      timeGrainSqla: undefined,
      vizType: 'echarts_timeseries_line',
    } as any,
    xAxis: {
      label: DTTM_ALIAS,
      type: AxisType.Time,
    },
  });

  getLatestEchartProps().eventHandlers?.click?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [Date.UTC(2021, 0, 1), 100],
    name: '2021-01-01',
    dataIndex: 0,
  });
  advanceClickTimer();

  expect(setDataMask.mock.calls[0][0]).toEqual({
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

test('warns and skips temporal cross-filter when string value cannot be parsed', () => {
  jest.useFakeTimers();
  const setDataMask = jest.fn();
  const warn = jest.spyOn(logging, 'warn').mockImplementation();

  renderTimeseries({
    emitCrossFilters: true,
    setDataMask,
    groupby: [],
    resolvedTimeGrain: TimeGranularity.MONTH,
    formData: {
      granularitySqla: 'ds',
      timeGrainSqla: TimeGranularity.MONTH,
      vizType: 'echarts_timeseries_line',
    } as any,
    xAxis: {
      label: DTTM_ALIAS,
      type: AxisType.Time,
    },
  });

  getLatestEchartProps().eventHandlers?.click?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: ['not-a-date', 100],
    name: 'not-a-date',
    dataIndex: 0,
  });
  advanceClickTimer();

  expect(setDataMask).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith(
    'Unable to parse time axis value for cross-filtering',
    'not-a-date',
  );
});

test('does not emit temporal X-axis label cross-filter when dimensions are set', () => {
  const setDataMask = jest.fn();

  renderTimeseries({
    emitCrossFilters: true,
    setDataMask,
    groupby: ['country'],
    formData: {
      groupby: ['country'],
      granularitySqla: 'ds',
      timeGrainSqla: TimeGranularity.MONTH,
      vizType: 'echarts_timeseries_line',
    } as any,
    xAxis: {
      label: DTTM_ALIAS,
      type: AxisType.Time,
    },
  });

  const labelClickHandler = getLatestEchartProps().queryEventHandlers?.find(
    ({ query }) => query === 'xAxis',
  )?.handler;
  expect(labelClickHandler).toBeDefined();
  labelClickHandler?.({
    targetType: 'axisLabel',
    value: '2021-01-01',
  } as unknown as ECElementEvent);

  expect(setDataMask).not.toHaveBeenCalled();
});

test('context menu cross-filter is available for a temporal bar point', async () => {
  const onContextMenu = jest.fn();

  renderTimeseries({
    emitCrossFilters: true,
    onContextMenu,
    groupby: [],
    resolvedTimeGrain: TimeGranularity.MONTH,
    formData: {
      granularitySqla: 'ds',
      timeGrainSqla: TimeGranularity.DAY,
      extraFormData: {
        time_grain_sqla: TimeGranularity.MONTH,
      },
      vizType: 'echarts_timeseries_line',
    } as any,
    xAxis: {
      label: DTTM_ALIAS,
      type: AxisType.Time,
    },
  });

  await getLatestEchartProps().eventHandlers?.contextmenu?.({
    componentType: 'series',
    seriesName: 'Sales',
    data: [Date.UTC(2021, 0, 1), 100],
    name: '2021-01-01',
    event: { stop: jest.fn(), event: { clientX: 10, clientY: 20 } },
  });

  await waitFor(() => {
    expect(onContextMenu).toHaveBeenCalled();
  });

  const { crossFilter } = onContextMenu.mock.calls[0][2];
  expect(crossFilter.dataMask.extraFormData.filters).toEqual([
    {
      col: 'ds',
      op: 'TEMPORAL_RANGE',
      val: '2021-01-01T00:00:00 : 2021-02-01T00:00:00',
    },
  ]);
});
