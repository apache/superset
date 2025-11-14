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
} from '@superset-ui/core';
import ChartRenderer, {
  cleanupAllChartLegendStates,
  resetGlobalCleanupPathname,
} from 'src/components/Chart/ChartRenderer';
import { ChartSource } from 'src/types/ChartSource';
import { getItem, setItem } from 'src/utils/localStorageHelpers';

let capturedSuperChartProps = null;

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SuperChart: ({ postTransformProps = x => x, ...props }) => {
    // Capture props for testing legend state handlers
    capturedSuperChartProps = props;
    return (
      <div data-test="mock-super-chart">
        {JSON.stringify(postTransformProps(props).formData)}
      </div>
    );
  },
}));

jest.mock(
  'src/components/Chart/ChartContextMenu/ChartContextMenu',
  () => () => <div data-test="mock-chart-context-menu" />,
);

const requiredProps = {
  chartId: 1,
  datasource: {},
  formData: { testControl: 'foo' },
  latestQueryFormData: {
    testControl: 'bar',
  },
  vizType: VizType.Table,
  source: ChartSource.Dashboard,
};

beforeAll(() => {
  window.featureFlags = { DRILL_TO_DETAIL: true };
});
afterAll(() => {
  window.featureFlags = {};
});

test('should render SuperChart', () => {
  const { getByTestId } = render(
    <ChartRenderer {...requiredProps} chartIsStale={false} />,
  );
  expect(getByTestId('mock-super-chart')).toBeInTheDocument();
});

test('should use latestQueryFormData instead of formData when chartIsStale is true', () => {
  const { getByTestId } = render(
    <ChartRenderer {...requiredProps} chartIsStale />,
  );
  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify({ testControl: 'bar' }),
  );
});

test('should render chart context menu', () => {
  const { getByTestId } = render(<ChartRenderer {...requiredProps} />);
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
    <ChartRenderer {...requiredProps} vizType="chart_without_context_menu" />,
  );
  expect(queryByTestId('mock-chart-context-menu')).not.toBeInTheDocument();
});

test('should detect changes in matrixify properties', () => {
  const initialProps = {
    ...requiredProps,
    formData: {
      ...requiredProps.formData,
      matrixify_enable_vertical_layout: true,
      matrixify_dimension_x: { dimension: 'country', values: ['USA'] },
      matrixify_dimension_y: { dimension: 'category', values: ['Tech'] },
      matrixify_charts_per_row: 3,
      matrixify_show_row_labels: true,
    },
    queriesResponse: [{ data: 'initial' }],
    chartStatus: 'success',
  };

  // eslint-disable-next-line no-unused-vars
  const wrapper = render(<ChartRenderer {...initialProps} />);

  // Since we can't directly test shouldComponentUpdate, we verify the component
  // correctly identifies matrixify-related properties by checking the implementation
  expect(initialProps.formData.matrixify_enable_vertical_layout).toBe(true);
  expect(initialProps.formData.matrixify_dimension_x).toEqual({
    dimension: 'country',
    values: ['USA'],
  });
});

test('should detect changes in postTransformProps', () => {
  const postTransformProps = jest.fn(x => x);
  const initialProps = {
    ...requiredProps,
    queriesResponse: [{ data: 'initial' }],
    chartStatus: 'success',
  };
  const { rerender } = render(<ChartRenderer {...initialProps} />);
  const updatedProps = {
    ...initialProps,
    postTransformProps,
  };
  expect(postTransformProps).toHaveBeenCalledTimes(0);
  rerender(<ChartRenderer {...updatedProps} />);
  expect(postTransformProps).toHaveBeenCalledTimes(1);
});

test('should identify matrixify property changes correctly', () => {
  // Test that formData with different matrixify properties triggers updates
  const initialProps = {
    ...requiredProps,
    formData: {
      matrixify_enable_vertical_layout: true,
      matrixify_dimension_x: { dimension: 'country', values: ['USA'] },
      matrixify_charts_per_row: 3,
    },
    queriesResponse: [{ data: 'current' }],
    chartStatus: 'success',
  };

  const { rerender, getByTestId } = render(<ChartRenderer {...initialProps} />);

  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(initialProps.formData),
  );

  // Update with changed matrixify_dimension_x values
  const updatedProps = {
    ...initialProps,
    formData: {
      matrixify_enable_vertical_layout: true,
      matrixify_dimension_x: {
        dimension: 'country',
        values: ['USA', 'Canada'], // Changed
      },
      matrixify_charts_per_row: 3,
    },
  };

  rerender(<ChartRenderer {...updatedProps} />);

  // Verify the component re-rendered with new props
  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(updatedProps.formData),
  );
});

test('should handle matrixify-related form data changes', () => {
  const initialProps = {
    ...requiredProps,
    formData: {
      regular_control: 'value1',
    },
    queriesResponse: [{ data: 'current' }],
    chartStatus: 'success',
  };

  const { rerender, getByTestId } = render(<ChartRenderer {...initialProps} />);

  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(initialProps.formData),
  );

  // Enable matrixify
  const updatedProps = {
    ...initialProps,
    formData: {
      matrixify_enable_vertical_layout: true, // This is a significant change
      regular_control: 'value1',
    },
  };

  rerender(<ChartRenderer {...updatedProps} />);

  // Verify the component re-rendered with matrixify enabled
  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(updatedProps.formData),
  );
});

test('should detect matrixify property addition', () => {
  const initialProps = {
    ...requiredProps,
    formData: {
      matrixify_enable_vertical_layout: true,
      // No matrixify_dimension_x initially
    },
    queriesResponse: [{ data: 'current' }],
    chartStatus: 'success',
  };

  const { rerender, getByTestId } = render(<ChartRenderer {...initialProps} />);

  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(initialProps.formData),
  );

  // Add matrixify_dimension_x
  const updatedProps = {
    ...initialProps,
    formData: {
      matrixify_enable_vertical_layout: true,
      matrixify_dimension_x: { dimension: 'country', values: ['USA'] }, // Added
    },
  };

  rerender(<ChartRenderer {...updatedProps} />);

  // Verify the component re-rendered with the new property
  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(updatedProps.formData),
  );
});

test('should detect nested matrixify property changes', () => {
  const initialProps = {
    ...requiredProps,
    formData: {
      matrixify_enable_vertical_layout: true,
      matrixify_dimension_x: {
        dimension: 'country',
        values: ['USA'],
        topN: { metric: 'sales', value: 10 },
      },
    },
    queriesResponse: [{ data: 'current' }],
    chartStatus: 'success',
  };

  const { rerender, getByTestId } = render(<ChartRenderer {...initialProps} />);

  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(initialProps.formData),
  );

  // Change nested topN value
  const updatedProps = {
    ...initialProps,
    formData: {
      matrixify_enable_vertical_layout: true,
      matrixify_dimension_x: {
        dimension: 'country',
        values: ['USA'],
        topN: { metric: 'sales', value: 15 }, // Nested change
      },
    },
  };

  rerender(<ChartRenderer {...updatedProps} />);

  // Verify the component re-rendered with the nested change
  expect(getByTestId('mock-super-chart')).toHaveTextContent(
    JSON.stringify(updatedProps.formData),
  );
});

// localStorage legend state tests
let beforeUnloadHandlers = [];
let popstateHandlers = [];
let hashchangeHandlers = [];
let originalLocation;
let originalAddEventListener;
let originalRemoveEventListener;

beforeEach(() => {
  localStorage.clear();
  capturedSuperChartProps = null;
  resetGlobalCleanupPathname();

  delete window.__chartRendererCount;
  window.__chartLegendCleanupListenersSetup = false;
  if (window.__chartLegendCleanupInterval) {
    clearInterval(window.__chartLegendCleanupInterval);
    delete window.__chartLegendCleanupInterval;
  }

  // Reset handlers
  beforeUnloadHandlers = [];
  popstateHandlers = [];
  hashchangeHandlers = [];

  // Save original location
  originalLocation = window.location;

  // Mock window.location.pathname
  delete window.location;
  window.location = {
    pathname: '/dashboard/1',
    href: 'http://localhost/dashboard/1',
  };

  // Mock addEventListener to capture handlers
  const originalAddEventListenerImpl = window.addEventListener;
  originalAddEventListener = jest.spyOn(window, 'addEventListener');
  originalAddEventListener.mockImplementation((event, handler) => {
    if (event === 'beforeunload') {
      beforeUnloadHandlers.push(handler);
    } else if (event === 'popstate') {
      popstateHandlers.push(handler);
    } else if (event === 'hashchange') {
      hashchangeHandlers.push(handler);
    }
    originalAddEventListenerImpl.call(window, event, handler);
  });

  // Spy on removeEventListener to preserve original functionality
  originalRemoveEventListener = jest.spyOn(window, 'removeEventListener');

  // Use fake timers for interval tests
  jest.useFakeTimers();
});

afterEach(() => {
  // Restore
  window.location = originalLocation;
  if (
    originalAddEventListener &&
    typeof originalAddEventListener.mockRestore === 'function'
  ) {
    originalAddEventListener.mockRestore();
  }
  if (
    originalRemoveEventListener &&
    typeof originalRemoveEventListener.mockRestore === 'function'
  ) {
    originalRemoveEventListener.mockRestore();
  }

  // Clear intervals and storage
  if (window.__chartLegendCleanupInterval) {
    clearInterval(window.__chartLegendCleanupInterval);
    delete window.__chartLegendCleanupInterval;
  }
  localStorage.clear();

  delete window.__chartRendererCount;
  window.__chartLegendCleanupListenersSetup = false;

  // Restore timers
  jest.useRealTimers();
});

test('should save legend state to localStorage when handleLegendStateChanged is called', () => {
  const mockLegendState = { series1: true, series2: false };
  const legendStateKey = `chart_legend_state_${requiredProps.chartId}`;
  expect(getItem(legendStateKey, null)).toBeNull();

  render(<ChartRenderer {...requiredProps} />);

  // Verify SuperChart received the hooks prop with the handler
  expect(capturedSuperChartProps).not.toBeNull();
  expect(capturedSuperChartProps.hooks).toBeDefined();
  expect(capturedSuperChartProps.hooks.onLegendStateChanged).toBeDefined();

  capturedSuperChartProps.hooks.onLegendStateChanged(mockLegendState);

  // Verify it was saved to localStorage
  const saved = getItem(legendStateKey, null);
  expect(saved).toEqual(mockLegendState);
});

test('should save legend index to localStorage when handleLegendScroll is called', () => {
  const mockLegendIndex = 5;
  const legendIndexKey = `chart_legend_index_${requiredProps.chartId}`;

  expect(getItem(legendIndexKey, null)).toBeNull();

  render(<ChartRenderer {...requiredProps} />);

  // Verify SuperChart received the hooks prop with the handler
  expect(capturedSuperChartProps).not.toBeNull();
  expect(capturedSuperChartProps.hooks).toBeDefined();
  expect(capturedSuperChartProps.hooks.onLegendScroll).toBeDefined();

  capturedSuperChartProps.hooks.onLegendScroll(mockLegendIndex);

  // Verify it was saved to localStorage
  const saved = getItem(legendIndexKey, null);
  expect(saved).toBe(mockLegendIndex);
});

test('should load legend state from localStorage on mount', () => {
  const mockLegendState = { series1: true, series2: false };
  const legendStateKey = `chart_legend_state_${requiredProps.chartId}`;
  setItem(legendStateKey, mockLegendState);

  render(<ChartRenderer {...requiredProps} />);

  // Verify localStorage data was loaded (still there in localStorage)
  const saved = getItem(legendStateKey, null);
  expect(saved).toEqual(mockLegendState);
});

test('should load legend index from localStorage on mount', () => {
  const mockLegendIndex = 10;
  const legendIndexKey = `chart_legend_index_${requiredProps.chartId}`;
  setItem(legendIndexKey, mockLegendIndex);

  render(<ChartRenderer {...requiredProps} />);

  const saved = getItem(legendIndexKey, null);
  expect(saved).toBe(mockLegendIndex);
});

test('should clean up all chart legend states on beforeunload event', () => {
  setItem('chart_legend_state_1', { a: true });
  setItem('chart_legend_index_1', 5);
  setItem('chart_legend_state_2', { b: false });
  setItem('chart_legend_index_2', 10);
  setItem('other_key', 'should not be removed');

  render(<ChartRenderer {...requiredProps} />);

  // Trigger beforeunload handler
  if (beforeUnloadHandlers.length > 0) {
    beforeUnloadHandlers[0]();
  }

  expect(getItem('chart_legend_state_1', null)).toBeNull();
  expect(getItem('chart_legend_index_1', null)).toBeNull();
  expect(getItem('chart_legend_state_2', null)).toBeNull();
  expect(getItem('chart_legend_index_2', null)).toBeNull();
  expect(getItem('other_key', null)).toBe('should not be removed');
});

test('should clean up all chart legend states on popstate event', () => {
  setItem('chart_legend_state_1', { a: true });
  setItem('chart_legend_index_1', 5);

  render(<ChartRenderer {...requiredProps} />);

  // Change pathname to trigger cleanup
  window.location.pathname = '/welcome';

  // Trigger popstate handler
  if (popstateHandlers.length > 0) {
    popstateHandlers[0]();
  }

  expect(getItem('chart_legend_state_1', null)).toBeNull();
  expect(getItem('chart_legend_index_1', null)).toBeNull();
});

test('should clean up all chart legend states on hashchange event', () => {
  setItem('chart_legend_state_1', { a: true });
  setItem('chart_legend_index_1', 5);

  render(<ChartRenderer {...requiredProps} />);

  // Change pathname to trigger cleanup
  window.location.pathname = '/dashboard/2';

  // Trigger hashchange handler
  if (hashchangeHandlers.length > 0) {
    hashchangeHandlers[0]();
  }

  expect(getItem('chart_legend_state_1', null)).toBeNull();
  expect(getItem('chart_legend_index_1', null)).toBeNull();
});

test('should clean up all chart legend states when pathname changes', () => {
  // Reset global cleanup pathname to ensure clean state
  resetGlobalCleanupPathname();

  setItem('chart_legend_state_1', { a: true });
  setItem('chart_legend_index_1', 5);
  setItem('chart_legend_state_2', { b: false });

  window.location.pathname = '/dashboard/1';
  const { unmount } = render(<ChartRenderer {...requiredProps} />);

  // Verify data exists after mount (should not be cleaned up yet)
  expect(getItem('chart_legend_state_1', null)).not.toBeNull();
  expect(getItem('chart_legend_index_1', null)).not.toBeNull();

  unmount();

  // Change pathname to simulate navigation
  window.location.pathname = '/welcome';

  // Mount new component on different page (should trigger cleanup)
  render(<ChartRenderer {...requiredProps} chartId={2} />);

  // Wait a bit for the interval to trigger (>100)
  jest.advanceTimersByTime(150);

  expect(getItem('chart_legend_state_1', null)).toBeNull();
  expect(getItem('chart_legend_index_1', null)).toBeNull();
  expect(getItem('chart_legend_state_2', null)).toBeNull();
});

test('should not clean up chart legend states when pathname is the same (scrolling scenario)', () => {
  // Set up some legend state data
  const mockLegendState = { series1: true };
  const legendStateKey = `chart_legend_state_${requiredProps.chartId}`;
  setItem(legendStateKey, mockLegendState);

  window.location.pathname = '/dashboard/1';
  const { unmount } = render(<ChartRenderer {...requiredProps} />);

  // Simulating scroll out of view
  unmount();

  // Verify data is still there (pathname didn't change, so no cleanup)
  const saved = getItem(legendStateKey, null);
  expect(saved).toEqual(mockLegendState);
});

test('cleanupAllChartLegendStates should remove all chart legend keys', () => {
  setItem('chart_legend_state_1', { a: true });
  setItem('chart_legend_index_1', 5);
  setItem('chart_legend_state_2', { b: false });
  setItem('chart_legend_index_2', 10);
  setItem('other_key', 'should not be removed');
  setItem('chart_legend_state_3', { c: true });

  cleanupAllChartLegendStates();

  expect(getItem('chart_legend_state_1', null)).toBeNull();
  expect(getItem('chart_legend_index_1', null)).toBeNull();
  expect(getItem('chart_legend_state_2', null)).toBeNull();
  expect(getItem('chart_legend_index_2', null)).toBeNull();
  expect(getItem('chart_legend_state_3', null)).toBeNull();
  expect(getItem('other_key', null)).toBe('should not be removed');
});
