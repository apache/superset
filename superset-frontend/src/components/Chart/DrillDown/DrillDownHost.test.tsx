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
import { render, screen, act, fireEvent } from 'spec/helpers/testing-library';
import { QueryFormData } from '@superset-ui/core';
import { ChartSource } from 'src/types/ChartSource';
import { DrillDownHost } from './DrillDownHost';
import { clearDrillDownState } from './useDrillDownState';
import type { ChartRendererProps } from '../ChartRenderer';

// Captures the onDrillDown callback handed to the chart renderer so tests can
// invoke a drill interaction directly.
let capturedOnDrillDown:
  ((filters: unknown, label: string) => void) | undefined;

function CaptureRenderer(
  props: ChartRendererProps & {
    onDrillDown?: (filters: unknown, label: string) => void;
  },
) {
  capturedOnDrillDown = props.onDrillDown;
  return <div data-test="mock-chart-renderer" />;
}

beforeEach(() => {
  clearDrillDownState();
  capturedOnDrillDown = undefined;
});

jest.mock('src/components/Chart/chartAction', () => ({
  getChartDataRequest: jest.fn(() =>
    Promise.resolve({ response: {}, json: { result: [{ data: [] }] } }),
  ),
  handleChartDataResponse: jest.fn(() =>
    Promise.resolve([{ data: [{ region: 'Texas' }] }]),
  ),
}));

jest.mock('src/explore/exploreUtils', () => ({
  ...jest.requireActual('src/explore/exploreUtils'),
  getQuerySettings: jest.fn(() => [false]),
}));

jest.mock('src/utils/simpleFilterToAdhoc', () => ({
  simpleFilterToAdhoc: jest.fn(filter => ({
    expressionType: 'SIMPLE',
    clause: 'WHERE',
    operator: filter.op,
    subject: filter.col,
    comparator: filter.val,
  })),
}));

// A simple mock ChartRenderer component that renders its props for inspection
function MockChartRenderer(
  props: ChartRendererProps & { onDrillDown?: unknown },
) {
  return (
    <div data-test="mock-chart-renderer">
      <span data-test="has-on-drill-down">
        {props.onDrillDown ? 'yes' : 'no'}
      </span>
      <span data-test="form-data-x-axis">
        {JSON.stringify((props.formData as Record<string, unknown>).x_axis)}
      </span>
    </div>
  );
}

const baseFormData: QueryFormData = {
  datasource: '1__table',
  viz_type: 'echarts_timeseries_bar',
  slice_id: 42,
  x_axis: 'country',
  groupby: [],
  adhoc_filters: [],
};

const baseRendererProps: ChartRendererProps = {
  formData: baseFormData,
  vizType: 'echarts_timeseries_bar',
  chartId: 1,
  height: 400,
  width: 600,
  queriesResponse: [{ data: [{ country: 'USA' }] }],
  actions: {} as ChartRendererProps['actions'],
  // Drill-down is a dashboard-only interaction.
  source: ChartSource.Dashboard,
};

test('DrillDownHost passes through to ChartRenderer when no hierarchy', () => {
  render(
    <DrillDownHost
      ChartRendererComponent={MockChartRenderer as any}
      {...baseRendererProps}
    />,
  );

  // Should render the chart
  expect(screen.getByTestId('mock-chart-renderer')).toBeInTheDocument();
  // No drill-down host wrapper when no hierarchy
  expect(screen.queryByTestId('drill-down-host')).not.toBeInTheDocument();
  // onDrillDown should not be provided
  expect(screen.getByTestId('has-on-drill-down')).toHaveTextContent('no');
});

test('DrillDownHost shows breadcrumb wrapper when hierarchy exists', () => {
  const formDataWithHierarchy: QueryFormData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region', 'city'],
  };

  render(
    <DrillDownHost
      ChartRendererComponent={MockChartRenderer as any}
      {...baseRendererProps}
      formData={formDataWithHierarchy}
    />,
  );

  // Should render the drill-down host wrapper
  expect(screen.getByTestId('drill-down-host')).toBeInTheDocument();
  // Chart should still render
  expect(screen.getByTestId('mock-chart-renderer')).toBeInTheDocument();
});

test('onDrillDown is provided when hierarchy exists', () => {
  const formDataWithHierarchy: QueryFormData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region', 'city'],
  };

  render(
    <DrillDownHost
      ChartRendererComponent={MockChartRenderer as any}
      {...baseRendererProps}
      formData={formDataWithHierarchy}
    />,
  );

  expect(screen.getByTestId('has-on-drill-down')).toHaveTextContent('yes');
});

test('DrillDownHost renders with drilldown_hierarchy field', () => {
  const formDataWithHierarchy: QueryFormData = {
    ...baseFormData,
    x_axis: 'country',
    drilldown_hierarchy: ['country', 'region', 'city'],
  };

  render(
    <DrillDownHost
      ChartRendererComponent={MockChartRenderer as any}
      {...baseRendererProps}
      formData={formDataWithHierarchy}
    />,
  );

  expect(screen.getByTestId('drill-down-host')).toBeInTheDocument();
  expect(screen.getByTestId('has-on-drill-down')).toHaveTextContent('yes');
});

test('returning to the top level clears the cross-filter and re-queries the base', async () => {
  const updateDataMask = jest.fn();
  const triggerQuery = jest.fn();
  const formDataWithHierarchy: QueryFormData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region', 'city'],
  };

  render(
    <DrillDownHost
      ChartRendererComponent={CaptureRenderer as any}
      {...baseRendererProps}
      formData={formDataWithHierarchy}
      emitCrossFilters
      actions={{ updateDataMask, triggerQuery } as any}
    />,
  );

  // Drill down one level so the breadcrumb appears.
  act(() => {
    capturedOnDrillDown?.([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });

  // Click the breadcrumb root (hierarchy[0]) to jump back to the top.
  const root = await screen.findByText('country');
  fireEvent.click(root);

  // The chart's own cross-filter is cleared...
  expect(updateDataMask).toHaveBeenCalledWith(
    1,
    expect.objectContaining({ extraFormData: { filters: [] } }),
  );
  // ...and a fresh base query is triggered so stale (filtered) base data from
  // cross-filter activity while drilled is replaced by the full chart.
  expect(triggerQuery).toHaveBeenCalledWith(true, 1);
});

test('drilling emits a cross-filter for the full accumulated path', () => {
  const updateDataMask = jest.fn();
  const formDataWithHierarchy: QueryFormData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region', 'city'],
  };

  render(
    <DrillDownHost
      ChartRendererComponent={CaptureRenderer as any}
      {...baseRendererProps}
      formData={formDataWithHierarchy}
      emitCrossFilters
      actions={{ updateDataMask } as any}
    />,
  );

  // First level: country = USA.
  act(() => {
    capturedOnDrillDown?.([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });
  expect(updateDataMask).toHaveBeenLastCalledWith(
    1,
    expect.objectContaining({
      extraFormData: {
        filters: [{ col: 'country', op: 'IN', val: ['USA'] }],
      },
    }),
  );

  // Second level: region = Texas. The cross-filter must carry BOTH levels.
  act(() => {
    capturedOnDrillDown?.([{ col: 'region', op: '==', val: 'Texas' }], 'Texas');
  });
  expect(updateDataMask).toHaveBeenLastCalledWith(
    1,
    expect.objectContaining({
      extraFormData: {
        filters: [
          { col: 'country', op: 'IN', val: ['USA'] },
          { col: 'region', op: 'IN', val: ['Texas'] },
        ],
      },
    }),
  );
});
