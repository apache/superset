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
import { render, waitFor } from '@testing-library/react';
import { ThemeProvider, supersetTheme } from '@apache-superset/core/ui';
import { AxisType } from '@superset-ui/core';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import EchartsTimeseries from '../../src/Timeseries/EchartsTimeseries';
import { EchartsHandler } from '../../src/types';

// Mock ECharts to avoid canvas rendering issues in tests
jest.mock('echarts/core', () => ({
  use: jest.fn(),
  init: jest.fn(() => ({
    setOption: jest.fn(),
    resize: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    getZr: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
    })),
    dispatchAction: jest.fn(),
    dispose: jest.fn(),
  })),
  registerLocale: jest.fn(),
}));

jest.mock('echarts/charts', () => ({
  LineChart: {},
  BarChart: {},
  ScatterChart: {},
  PieChart: {},
  FunnelChart: {},
  GaugeChart: {},
  GraphChart: {},
  RadarChart: {},
  BoxplotChart: {},
  TreeChart: {},
  TreemapChart: {},
  HeatmapChart: {},
  SunburstChart: {},
  CustomChart: {},
  SankeyChart: {},
}));

jest.mock('echarts/renderers', () => ({
  CanvasRenderer: {},
}));

jest.mock('echarts/components', () => ({
  TooltipComponent: {},
  TitleComponent: {},
  GridComponent: {},
  VisualMapComponent: {},
  LegendComponent: {},
  DataZoomComponent: {},
  ToolboxComponent: {},
  GraphicComponent: {},
  AriaComponent: {},
  MarkAreaComponent: {},
  MarkLineComponent: {},
  BrushComponent: {},
}));

jest.mock('echarts/features', () => ({
  LabelLayout: {},
}));

const mockStore = configureStore({
  reducer: {
    common: () => ({ locale: 'en' }),
  },
});

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={mockStore}>
      <ThemeProvider theme={supersetTheme}>{children}</ThemeProvider>
    </Provider>
  );
};

const baseFormData = {
  datasource: '1__table',
  viz_type: 'echarts_timeseries',
  granularitySqla: 'ds',
};

const baseXAxis = {
  label: '__timestamp',
  type: AxisType.Time as AxisType,
};

const baseEchartOptions = {
  xAxis: { type: 'time' },
  yAxis: { type: 'value' },
  series: [],
};

test('brush selection in Explore view calls setControlValue with time_range', async () => {
  const mockSetControlValue = jest.fn();
  const mockSetDataMask = jest.fn();
  const refs: { echartRef?: React.RefObject<EchartsHandler> } = {};

  // Capture the brushEnd handler when it's registered
  let capturedBrushEndHandler: ((params: any) => void) | null = null;
  const mockEchartsInstance = {
    setOption: jest.fn(),
    resize: jest.fn(),
    on: jest.fn((eventName: string, handler: any) => {
      if (eventName === 'brushEnd') {
        capturedBrushEndHandler = handler;
      }
    }),
    off: jest.fn(),
    getZr: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
    })),
    dispatchAction: jest.fn(),
    dispose: jest.fn(),
  };

  // Override the mock to capture handlers
  const echartsCore = require('echarts/core');
  echartsCore.init.mockReturnValue(mockEchartsInstance);

  render(
    <EchartsTimeseries
      formData={baseFormData as any}
      height={400}
      width={600}
      echartOptions={baseEchartOptions as any}
      groupby={[]}
      labelMap={{}}
      selectedValues={{}}
      setDataMask={mockSetDataMask}
      setControlValue={mockSetControlValue}
      legendData={[]}
      onContextMenu={jest.fn()}
      onLegendStateChanged={jest.fn()}
      onFocusedSeries={jest.fn()}
      xValueFormatter={((val: number) => new Date(val).toISOString()) as any}
      xAxis={baseXAxis}
      refs={refs}
      emitCrossFilters={false}
      coltypeMapping={{}}
    />,
    { wrapper: createWrapper() },
  );

  // Wait for component to mount and register handlers
  await waitFor(() => {
    expect(capturedBrushEndHandler).not.toBeNull();
  });

  // Simulate brush selection with time range (lineX brush returns flat array)
  const startTime = 1609459200000; // 2021-01-01T00:00:00.000Z
  const endTime = 1609545600000; // 2021-01-02T00:00:00.000Z

  capturedBrushEndHandler!({
    areas: [{ coordRange: [startTime, endTime] }],
  });

  // Wait for the setTimeout in the handler
  await waitFor(
    () => {
      expect(mockSetControlValue).toHaveBeenCalledWith(
        'time_range',
        '2021-01-01T00:00:00 : 2021-01-02T00:00:00',
      );
    },
    { timeout: 100 },
  );

  // setDataMask should NOT be called when emitCrossFilters is false
  expect(mockSetDataMask).not.toHaveBeenCalled();
});

test('brush selection on dashboard calls setDataMask with cross-filter', async () => {
  const mockSetControlValue = jest.fn();
  const mockSetDataMask = jest.fn();
  const refs: { echartRef?: React.RefObject<EchartsHandler> } = {};

  let capturedBrushEndHandler: ((params: any) => void) | null = null;
  const mockEchartsInstance = {
    setOption: jest.fn(),
    resize: jest.fn(),
    on: jest.fn((eventName: string, handler: any) => {
      if (eventName === 'brushEnd') {
        capturedBrushEndHandler = handler;
      }
    }),
    off: jest.fn(),
    getZr: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
    })),
    dispatchAction: jest.fn(),
    dispose: jest.fn(),
  };

  const echartsCore = require('echarts/core');
  echartsCore.init.mockReturnValue(mockEchartsInstance);

  render(
    <EchartsTimeseries
      formData={baseFormData as any}
      height={400}
      width={600}
      echartOptions={baseEchartOptions as any}
      groupby={[]}
      labelMap={{}}
      selectedValues={{}}
      setDataMask={mockSetDataMask}
      setControlValue={mockSetControlValue}
      legendData={[]}
      onContextMenu={jest.fn()}
      onLegendStateChanged={jest.fn()}
      onFocusedSeries={jest.fn()}
      xValueFormatter={((val: number) => new Date(val).toISOString()) as any}
      xAxis={baseXAxis}
      refs={refs}
      emitCrossFilters={true}
      coltypeMapping={{}}
    />,
    { wrapper: createWrapper() },
  );

  await waitFor(() => {
    expect(capturedBrushEndHandler).not.toBeNull();
  });

  const startTime = 1609459200000;
  const endTime = 1609545600000;

  capturedBrushEndHandler!({
    areas: [{ coordRange: [startTime, endTime] }],
  });

  await waitFor(
    () => {
      expect(mockSetDataMask).toHaveBeenCalledWith(
        expect.objectContaining({
          extraFormData: {
            filters: [
              { col: 'ds', op: '>=', val: startTime },
              { col: 'ds', op: '<=', val: endTime },
            ],
          },
          filterState: expect.objectContaining({
            value: [startTime, endTime],
            selectedValues: [startTime, endTime],
          }),
        }),
      );
    },
    { timeout: 100 },
  );

  // setControlValue should also be called in addition to setDataMask
  expect(mockSetControlValue).toHaveBeenCalledWith(
    'time_range',
    '2021-01-01T00:00:00 : 2021-01-02T00:00:00',
  );
});

test('brush selection does nothing for non-time axis', async () => {
  const mockSetControlValue = jest.fn();
  const mockSetDataMask = jest.fn();
  const refs: { echartRef?: React.RefObject<EchartsHandler> } = {};

  let capturedBrushEndHandler: ((params: any) => void) | null = null;
  const mockEchartsInstance = {
    setOption: jest.fn(),
    resize: jest.fn(),
    on: jest.fn((eventName: string, handler: any) => {
      if (eventName === 'brushEnd') {
        capturedBrushEndHandler = handler;
      }
    }),
    off: jest.fn(),
    getZr: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
    })),
    dispatchAction: jest.fn(),
    dispose: jest.fn(),
  };

  const echartsCore = require('echarts/core');
  echartsCore.init.mockReturnValue(mockEchartsInstance);

  // Use a category axis instead of time
  const categoryXAxis = {
    label: 'category',
    type: AxisType.Category as AxisType,
  };

  render(
    <EchartsTimeseries
      formData={baseFormData as any}
      height={400}
      width={600}
      echartOptions={baseEchartOptions as any}
      groupby={[]}
      labelMap={{}}
      selectedValues={{}}
      setDataMask={mockSetDataMask}
      setControlValue={mockSetControlValue}
      legendData={[]}
      onContextMenu={jest.fn()}
      onLegendStateChanged={jest.fn()}
      onFocusedSeries={jest.fn()}
      xValueFormatter={((val: number) => String(val)) as any}
      xAxis={categoryXAxis}
      refs={refs}
      emitCrossFilters={true}
      coltypeMapping={{}}
    />,
    { wrapper: createWrapper() },
  );

  await waitFor(() => {
    expect(capturedBrushEndHandler).not.toBeNull();
  });

  capturedBrushEndHandler!({
    areas: [{ coordRange: [100, 200] }],
  });

  // Wait a bit and verify nothing was called
  await new Promise(resolve => setTimeout(resolve, 50));

  expect(mockSetControlValue).not.toHaveBeenCalled();
  expect(mockSetDataMask).not.toHaveBeenCalled();
});

test('clearing brush on dashboard resets filter', async () => {
  const mockSetControlValue = jest.fn();
  const mockSetDataMask = jest.fn();
  const refs: { echartRef?: React.RefObject<EchartsHandler> } = {};

  let capturedBrushEndHandler: ((params: any) => void) | null = null;
  const mockEchartsInstance = {
    setOption: jest.fn(),
    resize: jest.fn(),
    on: jest.fn((eventName: string, handler: any) => {
      if (eventName === 'brushEnd') {
        capturedBrushEndHandler = handler;
      }
    }),
    off: jest.fn(),
    getZr: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
    })),
    dispatchAction: jest.fn(),
    dispose: jest.fn(),
  };

  const echartsCore = require('echarts/core');
  echartsCore.init.mockReturnValue(mockEchartsInstance);

  render(
    <EchartsTimeseries
      formData={baseFormData as any}
      height={400}
      width={600}
      echartOptions={baseEchartOptions as any}
      groupby={[]}
      labelMap={{}}
      selectedValues={{}}
      setDataMask={mockSetDataMask}
      setControlValue={mockSetControlValue}
      legendData={[]}
      onContextMenu={jest.fn()}
      onLegendStateChanged={jest.fn()}
      onFocusedSeries={jest.fn()}
      xValueFormatter={((val: number) => new Date(val).toISOString()) as any}
      xAxis={baseXAxis}
      refs={refs}
      emitCrossFilters={true}
      coltypeMapping={{}}
    />,
    { wrapper: createWrapper() },
  );

  await waitFor(() => {
    expect(capturedBrushEndHandler).not.toBeNull();
  });

  // Simulate clearing the brush (empty areas array)
  capturedBrushEndHandler!({
    areas: [],
  });

  await waitFor(
    () => {
      expect(mockSetDataMask).toHaveBeenCalledWith({
        extraFormData: {},
        filterState: {
          value: null,
          selectedValues: null,
        },
      });
    },
    { timeout: 100 },
  );
});

test('brush selection uses custom column name when xAxis.label is not DTTM_ALIAS', async () => {
  const mockSetControlValue = jest.fn();
  const mockSetDataMask = jest.fn();
  const refs: { echartRef?: React.RefObject<EchartsHandler> } = {};

  let capturedBrushEndHandler: ((params: any) => void) | null = null;
  const mockEchartsInstance = {
    setOption: jest.fn(),
    resize: jest.fn(),
    on: jest.fn((eventName: string, handler: any) => {
      if (eventName === 'brushEnd') {
        capturedBrushEndHandler = handler;
      }
    }),
    off: jest.fn(),
    getZr: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
    })),
    dispatchAction: jest.fn(),
    dispose: jest.fn(),
  };

  const echartsCore = require('echarts/core');
  echartsCore.init.mockReturnValue(mockEchartsInstance);

  // Use a custom time column name
  const customXAxis = {
    label: 'created_at',
    type: AxisType.Time as AxisType,
  };

  render(
    <EchartsTimeseries
      formData={baseFormData as any}
      height={400}
      width={600}
      echartOptions={baseEchartOptions as any}
      groupby={[]}
      labelMap={{}}
      selectedValues={{}}
      setDataMask={mockSetDataMask}
      setControlValue={mockSetControlValue}
      legendData={[]}
      onContextMenu={jest.fn()}
      onLegendStateChanged={jest.fn()}
      onFocusedSeries={jest.fn()}
      xValueFormatter={((val: number) => new Date(val).toISOString()) as any}
      xAxis={customXAxis}
      refs={refs}
      emitCrossFilters={true}
      coltypeMapping={{}}
    />,
    { wrapper: createWrapper() },
  );

  await waitFor(() => {
    expect(capturedBrushEndHandler).not.toBeNull();
  });

  const startTime = 1609459200000;
  const endTime = 1609545600000;

  capturedBrushEndHandler!({
    areas: [{ coordRange: [startTime, endTime] }],
  });

  await waitFor(
    () => {
      expect(mockSetDataMask).toHaveBeenCalledWith(
        expect.objectContaining({
          extraFormData: {
            filters: [
              { col: 'created_at', op: '>=', val: startTime },
              { col: 'created_at', op: '<=', val: endTime },
            ],
          },
        }),
      );
    },
    { timeout: 100 },
  );
});

test('brush selection with invalid coordRange does not trigger filter', async () => {
  const mockSetControlValue = jest.fn();
  const mockSetDataMask = jest.fn();
  const refs: { echartRef?: React.RefObject<EchartsHandler> } = {};

  let capturedBrushEndHandler: ((params: any) => void) | null = null;
  const mockEchartsInstance = {
    setOption: jest.fn(),
    resize: jest.fn(),
    on: jest.fn((eventName: string, handler: any) => {
      if (eventName === 'brushEnd') {
        capturedBrushEndHandler = handler;
      }
    }),
    off: jest.fn(),
    getZr: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
    })),
    dispatchAction: jest.fn(),
    dispose: jest.fn(),
  };

  const echartsCore = require('echarts/core');
  echartsCore.init.mockReturnValue(mockEchartsInstance);

  render(
    <EchartsTimeseries
      formData={baseFormData as any}
      height={400}
      width={600}
      echartOptions={baseEchartOptions as any}
      groupby={[]}
      labelMap={{}}
      selectedValues={{}}
      setDataMask={mockSetDataMask}
      setControlValue={mockSetControlValue}
      legendData={[]}
      onContextMenu={jest.fn()}
      onLegendStateChanged={jest.fn()}
      onFocusedSeries={jest.fn()}
      xValueFormatter={((val: number) => new Date(val).toISOString()) as any}
      xAxis={baseXAxis}
      refs={refs}
      emitCrossFilters={true}
      coltypeMapping={{}}
    />,
    { wrapper: createWrapper() },
  );

  await waitFor(() => {
    expect(capturedBrushEndHandler).not.toBeNull();
  });

  // Test with null coordRange
  capturedBrushEndHandler!({
    areas: [{ coordRange: null }],
  });

  await new Promise(resolve => setTimeout(resolve, 50));
  expect(mockSetControlValue).not.toHaveBeenCalled();
  expect(mockSetDataMask).not.toHaveBeenCalled();

  // Test with coordRange having only one value
  capturedBrushEndHandler!({
    areas: [{ coordRange: [123] }],
  });

  await new Promise(resolve => setTimeout(resolve, 50));
  expect(mockSetControlValue).not.toHaveBeenCalled();
  expect(mockSetDataMask).not.toHaveBeenCalled();
});

test('brush selection formats time range correctly for different timestamps', async () => {
  const mockSetControlValue = jest.fn();
  const mockSetDataMask = jest.fn();
  const refs: { echartRef?: React.RefObject<EchartsHandler> } = {};

  let capturedBrushEndHandler: ((params: any) => void) | null = null;
  const mockEchartsInstance = {
    setOption: jest.fn(),
    resize: jest.fn(),
    on: jest.fn((eventName: string, handler: any) => {
      if (eventName === 'brushEnd') {
        capturedBrushEndHandler = handler;
      }
    }),
    off: jest.fn(),
    getZr: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
    })),
    dispatchAction: jest.fn(),
    dispose: jest.fn(),
  };

  const echartsCore = require('echarts/core');
  echartsCore.init.mockReturnValue(mockEchartsInstance);

  render(
    <EchartsTimeseries
      formData={baseFormData as any}
      height={400}
      width={600}
      echartOptions={baseEchartOptions as any}
      groupby={[]}
      labelMap={{}}
      selectedValues={{}}
      setDataMask={mockSetDataMask}
      setControlValue={mockSetControlValue}
      legendData={[]}
      onContextMenu={jest.fn()}
      onLegendStateChanged={jest.fn()}
      onFocusedSeries={jest.fn()}
      xValueFormatter={((val: number) => new Date(val).toISOString()) as any}
      xAxis={baseXAxis}
      refs={refs}
      emitCrossFilters={false}
      coltypeMapping={{}}
    />,
    { wrapper: createWrapper() },
  );

  await waitFor(() => {
    expect(capturedBrushEndHandler).not.toBeNull();
  });

  // Test with a different date range including time
  const startTime = 1640995200000; // 2022-01-01T00:00:00.000Z
  const endTime = 1641049200000; // 2022-01-01T15:00:00.000Z

  capturedBrushEndHandler!({
    areas: [{ coordRange: [startTime, endTime] }],
  });

  await waitFor(
    () => {
      expect(mockSetControlValue).toHaveBeenCalledWith(
        'time_range',
        '2022-01-01T00:00:00 : 2022-01-01T15:00:00',
      );
    },
    { timeout: 100 },
  );
});
