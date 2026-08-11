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
import { AxisType } from '@superset-ui/core';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import EchartsTimeseries from '../../src/Timeseries/EchartsTimeseries';
import { TimeseriesChartTransformedProps } from '../../src/Timeseries/types';

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
  setOption: jest.Mock;
  getHeight: jest.Mock;
  convertToPixel: jest.Mock;
  convertFromPixel: jest.Mock;
  getModel: jest.Mock;
};

jest.mock('../../src/components/Echart', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  return {
    __esModule: true,
    default: forwardRef((_props: unknown, ref: unknown) => {
      useImperativeHandle(ref, () => ({
        getEchartInstance: () => mockChart,
      }));
      return null;
    }),
  };
});

const PX_PER_UNIT = 100;

function setupChartMock() {
  mockChart = {
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
  setupChartMock();
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
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
