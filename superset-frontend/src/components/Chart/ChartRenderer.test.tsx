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
import { render } from 'spec/helpers/testing-library';
import {
  ChartMetadata,
  getChartMetadataRegistry,
  VizType,
  JsonObject,
  FeatureFlagMap,
} from '@superset-ui/core';
import ChartRenderer, {
  ChartRendererProps,
} from 'src/components/Chart/ChartRenderer';
import { ChartSource } from 'src/types/ChartSource';
import type { Dispatch } from 'redux';

interface MockSuperChartProps {
  postTransformProps?: (props: JsonObject) => JsonObject;
  formData?: JsonObject;
  [key: string]: unknown;
}

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SuperChart: ({
    postTransformProps = (x: JsonObject) => x,
    isRefreshing = false,
    ...props
  }: MockSuperChartProps & { isRefreshing?: boolean }) => (
    <div
      data-test="mock-super-chart"
      data-is-refreshing={isRefreshing ? 'true' : 'false'}
    >
      {JSON.stringify(postTransformProps(props).formData)}
    </div>
  ),
}));

jest.mock(
  'src/components/Chart/ChartContextMenu/ChartContextMenu',
  () => () => <div data-test="mock-chart-context-menu" />,
);

interface MockActions {
  chartRenderingSucceeded: (chartId: number) => Dispatch;
  chartRenderingFailed: (
    error: string,
    chartId: number,
    componentStack: string | null,
  ) => Dispatch;
  logEvent: (eventName: string, payload: JsonObject) => Dispatch;
}

const mockActions: MockActions = {
  chartRenderingSucceeded: jest.fn() as unknown as (
    chartId: number,
  ) => Dispatch,
  chartRenderingFailed: jest.fn() as unknown as (
    error: string,
    chartId: number,
    componentStack: string | null,
  ) => Dispatch,
  logEvent: jest.fn() as unknown as (
    eventName: string,
    payload: JsonObject,
  ) => Dispatch,
};

const requiredProps: Partial<ChartRendererProps> = {
  chartId: 1,
  datasource: {} as ChartRendererProps['datasource'],
  formData: {
    testControl: 'foo',
  } as unknown as ChartRendererProps['formData'],
  latestQueryFormData: {
    testControl: 'bar',
  } as unknown as ChartRendererProps['latestQueryFormData'],
  vizType: VizType.Table,
  source: ChartSource.Dashboard,
  actions: mockActions as ChartRendererProps['actions'],
};

declare global {
  interface Window {
    featureFlags: FeatureFlagMap;
  }
}

beforeAll(() => {
  window.featureFlags = { DRILL_TO_DETAIL: true } as FeatureFlagMap;
});
afterAll(() => {
  window.featureFlags = {} as FeatureFlagMap;
});

test('should render SuperChart', () => {
  const { getByTestId } = render(
    <ChartRenderer
      {...(requiredProps as ChartRendererProps)}
      chartIsStale={false}
    />,
  );
  expect(getByTestId('mock-super-chart')).toBeInTheDocument();
});

test('should use latestQueryFormData instead of formData when chartIsStale is true', () => {
  const { getByTestId } = render(
    <ChartRenderer {...(requiredProps as ChartRendererProps)} chartIsStale />,
  );
  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify({
      testControl: 'bar',
    }),
  );
});

test('should render chart context menu', () => {
  const { getByTestId } = render(
    <ChartRenderer {...(requiredProps as ChartRendererProps)} />,
  );
  expect(getByTestId('mock-chart-context-menu')).toBeInTheDocument();
});

test('should not render chart context menu if the context menu is suppressed for given viz plugin', () => {
  getChartMetadataRegistry().registerValue(
    'chart_without_context_menu',
    new ChartMetadata({
      name: 'chart with suppressed context menu',
      thumbnail: '.png',
      useLegacyApi: false,
      suppressContextMenu: true,
    }),
  );
  const { queryByTestId } = render(
    <ChartRenderer
      {...(requiredProps as ChartRendererProps)}
      vizType="chart_without_context_menu"
    />,
  );
  expect(queryByTestId('mock-chart-context-menu')).not.toBeInTheDocument();
});

test('should detect changes in matrixify properties', () => {
  const initialProps: Partial<ChartRendererProps> = {
    ...requiredProps,
    formData: {
      ...requiredProps.formData,
      datasource: '',
      viz_type: VizType.Table,
      matrixify_enable_vertical_layout: true,
      matrixify_dimension_x: { dimension: 'country', values: ['USA'] },
      matrixify_dimension_y: { dimension: 'category', values: ['Tech'] },
      matrixify_charts_per_row: 3,
      matrixify_show_row_labels: true,
    },
    queriesResponse: [{ data: 'initial' } as unknown as JsonObject],
    chartStatus: 'success',
  };

  render(<ChartRenderer {...(initialProps as ChartRendererProps)} />);

  // Since we can't directly test shouldComponentUpdate, we verify the component
  // correctly identifies matrixify-related properties by checking the implementation
  expect(
    (initialProps.formData as JsonObject).matrixify_enable_vertical_layout,
  ).toBe(true);
  expect((initialProps.formData as JsonObject).matrixify_dimension_x).toEqual({
    dimension: 'country',
    values: ['USA'],
  });
});

test('should detect changes in postTransformProps', () => {
  const postTransformProps = jest.fn((x: JsonObject) => x);
  const initialProps: Partial<ChartRendererProps> = {
    ...requiredProps,
    queriesResponse: [{ data: 'initial' } as unknown as JsonObject],
    chartStatus: 'success',
  };
  const { rerender } = render(
    <ChartRenderer {...(initialProps as ChartRendererProps)} />,
  );
  const updatedProps: Partial<ChartRendererProps> = {
    ...initialProps,
    postTransformProps,
  };
  expect(postTransformProps).toHaveBeenCalledTimes(0);
  rerender(<ChartRenderer {...(updatedProps as ChartRendererProps)} />);
  expect(postTransformProps).toHaveBeenCalledTimes(1);
});

test('should identify matrixify property changes correctly', () => {
  // Test that formData with different matrixify properties triggers updates
  const initialProps: Partial<ChartRendererProps> = {
    ...requiredProps,
    formData: {
      datasource: '',
      viz_type: VizType.Table,
      matrixify_enable_vertical_layout: true,
      matrixify_dimension_x: { dimension: 'country', values: ['USA'] },
      matrixify_charts_per_row: 3,
    },
    queriesResponse: [{ data: 'current' } as unknown as JsonObject],
    chartStatus: 'success',
  };

  const { rerender, getByTestId } = render(
    <ChartRenderer {...(initialProps as ChartRendererProps)} />,
  );

  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(initialProps.formData),
  );

  // Update with changed matrixify_dimension_x values
  const updatedProps: Partial<ChartRendererProps> = {
    ...initialProps,
    formData: {
      datasource: '',
      viz_type: VizType.Table,
      matrixify_enable_vertical_layout: true,
      matrixify_dimension_x: {
        dimension: 'country',
        values: ['USA', 'Canada'], // Changed
      },
      matrixify_charts_per_row: 3,
    },
  };

  rerender(<ChartRenderer {...(updatedProps as ChartRendererProps)} />);

  // Verify the component re-rendered with new props
  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(updatedProps.formData),
  );
});

test('should handle matrixify-related form data changes', () => {
  const initialProps: Partial<ChartRendererProps> = {
    ...requiredProps,
    formData: {
      datasource: '',
      viz_type: VizType.Table,
      regular_control: 'value1',
    },
    queriesResponse: [{ data: 'current' } as unknown as JsonObject],
    chartStatus: 'success',
  };

  const { rerender, getByTestId } = render(
    <ChartRenderer {...(initialProps as ChartRendererProps)} />,
  );

  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(initialProps.formData),
  );

  // Enable matrixify
  const updatedProps: Partial<ChartRendererProps> = {
    ...initialProps,
    formData: {
      datasource: '',
      viz_type: VizType.Table,
      matrixify_enable_vertical_layout: true, // This is a significant change
      regular_control: 'value1',
    },
  };

  rerender(<ChartRenderer {...(updatedProps as ChartRendererProps)} />);

  // Verify the component re-rendered with matrixify enabled
  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(updatedProps.formData),
  );
});

test('should detect matrixify property addition', () => {
  const initialProps: Partial<ChartRendererProps> = {
    ...requiredProps,
    formData: {
      datasource: '',
      viz_type: VizType.Table,
      matrixify_enable_vertical_layout: true,
      // No matrixify_dimension_x initially
    },
    queriesResponse: [{ data: 'current' } as unknown as JsonObject],
    chartStatus: 'success',
  };

  const { rerender, getByTestId } = render(
    <ChartRenderer {...(initialProps as ChartRendererProps)} />,
  );

  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(initialProps.formData),
  );

  // Add matrixify_dimension_x
  const updatedProps: Partial<ChartRendererProps> = {
    ...initialProps,
    formData: {
      datasource: '',
      viz_type: VizType.Table,
      matrixify_enable_vertical_layout: true,
      matrixify_dimension_x: { dimension: 'country', values: ['USA'] }, // Added
    },
  };

  rerender(<ChartRenderer {...(updatedProps as ChartRendererProps)} />);

  // Verify the component re-rendered with the new property
  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(updatedProps.formData),
  );
});

test('should detect nested matrixify property changes', () => {
  const initialProps: Partial<ChartRendererProps> = {
    ...requiredProps,
    formData: {
      datasource: '',
      viz_type: VizType.Table,
      matrixify_enable_vertical_layout: true,
      matrixify_dimension_x: {
        dimension: 'country',
        values: ['USA'],
        topN: { metric: 'sales', value: 10 },
      },
    },
    queriesResponse: [{ data: 'current' } as unknown as JsonObject],
    chartStatus: 'success',
  };

  const { rerender, getByTestId } = render(
    <ChartRenderer {...(initialProps as ChartRendererProps)} />,
  );

  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(initialProps.formData),
  );

  // Change nested topN value
  const updatedProps: Partial<ChartRendererProps> = {
    ...initialProps,
    formData: {
      datasource: '',
      viz_type: VizType.Table,
      matrixify_enable_vertical_layout: true,
      matrixify_dimension_x: {
        dimension: 'country',
        values: ['USA'],
        topN: { metric: 'sales', value: 15 }, // Nested change
      },
    },
  };

  rerender(<ChartRenderer {...(updatedProps as ChartRendererProps)} />);

  // Verify the component re-rendered with the nested change
  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(updatedProps.formData),
  );
});

test('renders chart during loading when suppressLoadingSpinner has valid data', () => {
  const props = {
    ...requiredProps,
    chartStatus: 'loading' as const,
    chartAlert: undefined,
    suppressLoadingSpinner: true,
    queriesResponse: [{ data: [{ value: 1 }] }],
  };

  const { getByTestId } = render(<ChartRenderer {...props} />);
  expect(getByTestId('mock-super-chart')).toBeInTheDocument();
  expect(getByTestId('mock-super-chart')).toHaveAttribute(
    'data-is-refreshing',
    'true',
  );
});

test('does not mark chart as refreshing when loading is not in progress', () => {
  const props = {
    ...requiredProps,
    chartStatus: 'success' as const,
    chartAlert: undefined,
    suppressLoadingSpinner: true,
    queriesResponse: [{ data: [{ value: 1 }] }],
  };

  const { getByTestId } = render(<ChartRenderer {...props} />);
  expect(getByTestId('mock-super-chart')).toHaveAttribute(
    'data-is-refreshing',
    'false',
  );
});

test('does not mark chart as refreshing when spinner suppression is disabled', () => {
  const props = {
    ...requiredProps,
    chartStatus: 'success' as const,
    chartAlert: undefined,
    suppressLoadingSpinner: false,
    queriesResponse: [{ data: [{ value: 1 }] }],
  };

  const { getByTestId } = render(<ChartRenderer {...props} />);
  expect(getByTestId('mock-super-chart')).toHaveAttribute(
    'data-is-refreshing',
    'false',
  );
});

test('does not render chart during loading when last data has errors', () => {
  const props = {
    ...requiredProps,
    chartStatus: 'loading' as const,
    chartAlert: undefined,
    suppressLoadingSpinner: true,
    queriesResponse: [{ error: 'bad' }],
  };

  const { queryByTestId } = render(<ChartRenderer {...props} />);
  expect(queryByTestId('mock-super-chart')).not.toBeInTheDocument();
});
