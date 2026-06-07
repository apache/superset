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
import { ReactElement } from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, supersetTheme } from '@apache-superset/core/theme';
import { QueryFormData } from '@superset-ui/core';
import { DrillDownHost } from './DrillDownHost';
import type { ChartRendererProps } from '../ChartRenderer';

function render(ui: ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider theme={supersetTheme}>{children}</ThemeProvider>
    ),
  });
}

jest.mock('src/components/Chart/chartAction', () => ({
  getChartDataRequest: jest.fn(() =>
    Promise.resolve({ response: {}, json: { result: [{ data: [] }] } }),
  ),
  handleChartDataResponse: jest.fn(() =>
    Promise.resolve([{ data: [{ region: 'Texas' }] }]),
  ),
}));

jest.mock('src/explore/exploreUtils', () => ({
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
    x_axis: ['country', 'region', 'city'],
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
    x_axis: ['country', 'region', 'city'],
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
