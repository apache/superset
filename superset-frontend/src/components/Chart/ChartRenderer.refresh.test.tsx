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
import { useEffect } from 'react';
import { act, render, screen } from 'spec/helpers/testing-library';
import {
  ChartMetadata,
  ChartPlugin,
  FeatureFlag,
  QueryData,
} from '@superset-ui/core';
import Chart from 'src/components/Chart/Chart';
import type { Actions } from 'src/components/Chart/Chart';
import ChartRenderer, {
  ChartRendererProps,
} from 'src/components/Chart/ChartRenderer';
import { ChartSource } from 'src/types/ChartSource';

// These tests run the real SuperChart, because the bug they guard against
// lives in what SuperChart does with the data ChartRenderer hands it.
jest.mock(
  'src/components/Chart/ChartContextMenu/ChartContextMenu',
  () => () => <div />,
);

const VIZ_TYPE = 'refresh_test_chart';
const SELF_FETCHING_VIZ_TYPE = 'refresh_test_self_fetching_chart';
const NO_RESULTS = 'No results were returned for this query';

interface TestChartProps {
  queriesData: { data: { value: number }[] }[];
  label?: string;
}

const TestChart = ({ queriesData, label }: TestChartProps) => (
  <div data-test="refresh-test-chart">
    value={queriesData[0].data[0].value} label={label}
  </div>
);

const selfFetchingChartMounted = jest.fn();

// Stands in for deck.gl Multiple Layers: it issues no query of its own, so
// its response is an empty array, and it loads its data when it mounts.
const SelfFetchingTestChart = () => {
  useEffect(() => {
    selfFetchingChartMounted();
  }, []);
  return <div data-test="self-fetching-test-chart" />;
};

beforeAll(() => {
  new ChartPlugin({
    metadata: new ChartMetadata({ name: 'Refresh test chart', thumbnail: '' }),
    Chart: TestChart,
    transformProps: chartProps => ({
      queriesData: chartProps.queriesData,
      label: chartProps.formData.label,
    }),
  })
    .configure({ key: VIZ_TYPE })
    .register();
  new ChartPlugin({
    metadata: new ChartMetadata({
      name: 'Self-fetching refresh test chart',
      thumbnail: '',
      enableNoResults: false,
    }),
    Chart: SelfFetchingTestChart,
  })
    .configure({ key: SELF_FETCHING_VIZ_TYPE })
    .register();
});

beforeEach(() => {
  selfFetchingChartMounted.mockClear();
});

const queriesResponse = (value: number) =>
  [{ data: [{ value }] }] as unknown as QueryData[];

// SuperChart loads the chart plugin asynchronously, so a chart that is about
// to render is not in the DOM right after render(). Tests asserting that a
// chart stays absent have to let that load settle first.
const waitForChartLoad = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

const props = (overrides: Partial<ChartRendererProps>): ChartRendererProps => ({
  chartId: 1,
  datasource: {} as ChartRendererProps['datasource'],
  formData: { viz_type: VIZ_TYPE } as ChartRendererProps['formData'],
  vizType: VIZ_TYPE,
  source: ChartSource.Dashboard,
  width: 600,
  height: 400,
  actions: {
    chartRenderingSucceeded: jest.fn(),
    chartRenderingFailed: jest.fn(),
    logEvent: jest.fn(),
  } as unknown as ChartRendererProps['actions'],
  queriesResponse: queriesResponse(1),
  ...overrides,
});

test('keeps the chart on screen while an auto-refresh query is in flight', async () => {
  const { rerender } = render(
    <ChartRenderer
      {...props({ chartStatus: 'rendered', suppressLoadingSpinner: true })}
    />,
  );
  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'value=1',
  );

  rerender(
    <ChartRenderer
      {...props({ chartStatus: 'loading', suppressLoadingSpinner: true })}
    />,
  );

  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'value=1',
  );
  expect(screen.queryByText(NO_RESULTS)).not.toBeInTheDocument();
});

test('renders the previous data when mounted in the middle of an auto-refresh', async () => {
  render(
    <ChartRenderer
      {...props({ chartStatus: 'loading', suppressLoadingSpinner: true })}
    />,
  );

  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'value=1',
  );
  expect(screen.queryByText(NO_RESULTS)).not.toBeInTheDocument();
});

test('shows the new data once the auto-refresh query returns', async () => {
  const { rerender } = render(
    <ChartRenderer
      {...props({ chartStatus: 'rendered', suppressLoadingSpinner: true })}
    />,
  );
  await screen.findByTestId('refresh-test-chart');
  rerender(
    <ChartRenderer
      {...props({ chartStatus: 'loading', suppressLoadingSpinner: true })}
    />,
  );

  rerender(
    <ChartRenderer
      {...props({
        chartStatus: 'success',
        suppressLoadingSpinner: true,
        queriesResponse: queriesResponse(2),
      })}
    />,
  );

  expect(await screen.findByText(/value=2/)).toBeInTheDocument();
});

test('keeps a dashboard chart on screen while a manual refresh query is in flight', async () => {
  const { rerender } = render(
    <ChartRenderer {...props({ chartStatus: 'rendered' })} />,
  );
  await screen.findByTestId('refresh-test-chart');

  rerender(<ChartRenderer {...props({ chartStatus: 'loading' })} />);

  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'value=1',
  );
  expect(screen.queryByText(NO_RESULTS)).not.toBeInTheDocument();

  rerender(
    <ChartRenderer
      {...props({
        chartStatus: 'success',
        queriesResponse: queriesResponse(2),
      })}
    />,
  );

  expect(await screen.findByText(/value=2/)).toBeInTheDocument();
});

// A dashboard filter change, such as a Dynamic Group By, updates formData as
// soon as the new query starts. The previous rows don't match it. Chart tracks
// which form data the response in the store was queried with.
const labelledFormData = (label: string) =>
  ({
    datasource: '1__table',
    viz_type: VIZ_TYPE,
    label,
  }) as ChartRendererProps['formData'];

const dashboardChartProps = {
  chartId: 1,
  dashboardId: 17,
  width: 600,
  height: 400,
  vizType: VIZ_TYPE,
  setControlValue: jest.fn(),
  actions: {
    chartRenderingSucceeded: jest.fn(),
    chartRenderingFailed: jest.fn(),
    logEvent: jest.fn(),
    postChartFormData: jest.fn(),
  } as unknown as Actions,
};

test('draws the previous data with the form data it was queried with', async () => {
  // The store keeps the same response object until the new one lands.
  const previous = queriesResponse(1);
  const { rerender } = render(
    <Chart
      {...dashboardChartProps}
      chartStatus="rendered"
      formData={labelledFormData('before')}
      queriesResponse={previous}
    />,
  );
  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'label=before',
  );

  rerender(
    <Chart
      {...dashboardChartProps}
      chartStatus="loading"
      formData={labelledFormData('after')}
      queriesResponse={previous}
    />,
  );
  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'value=1 label=before',
  );

  rerender(
    <Chart
      {...dashboardChartProps}
      chartStatus="success"
      formData={labelledFormData('after')}
      queriesResponse={queriesResponse(2)}
    />,
  );
  expect(await screen.findByText('value=2 label=after')).toBeInTheDocument();
});

test('draws the previous data with its own form data when a virtualized chart scrolls back into view', async () => {
  const previousFlags = window.featureFlags;
  window.featureFlags = {
    ...previousFlags,
    [FeatureFlag.DashboardVirtualization]: true,
  };
  try {
    const previous = queriesResponse(1);
    const { rerender } = render(
      <Chart
        {...dashboardChartProps}
        chartStatus="rendered"
        formData={labelledFormData('before')}
        queriesResponse={previous}
      />,
    );
    await screen.findByTestId('refresh-test-chart');

    // Out of view, ChartRenderer unmounts while the filter change starts the
    // new query.
    rerender(
      <Chart
        {...dashboardChartProps}
        isInView={false}
        chartStatus="loading"
        formData={labelledFormData('after')}
        queriesResponse={previous}
      />,
    );
    expect(screen.queryByTestId('refresh-test-chart')).not.toBeInTheDocument();

    rerender(
      <Chart
        {...dashboardChartProps}
        chartStatus="loading"
        formData={labelledFormData('after')}
        queriesResponse={previous}
      />,
    );
    expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
      'value=1 label=before',
    );
  } finally {
    window.featureFlags = previousFlags;
  }
});

test('shows the regular spinner for a dashboard chart mounted while its query is in flight', async () => {
  // Nothing tells this chart which form data the response in the store was
  // queried with, so it can't draw that response.
  render(
    <Chart
      {...dashboardChartProps}
      chartStatus="loading"
      formData={labelledFormData('after')}
      queriesResponse={queriesResponse(1)}
    />,
  );
  await waitForChartLoad();

  expect(screen.queryByTestId('refresh-test-chart')).not.toBeInTheDocument();
  expect(screen.getByText('Waiting on database...')).toBeInTheDocument();
});

test('hides the chart while its query is in flight in Explore', async () => {
  const { rerender } = render(
    <ChartRenderer
      {...props({ chartStatus: 'rendered', source: ChartSource.Explore })}
    />,
  );
  await screen.findByTestId('refresh-test-chart');

  rerender(
    <ChartRenderer
      {...props({ chartStatus: 'loading', source: ChartSource.Explore })}
    />,
  );
  await waitForChartLoad();

  expect(screen.queryByTestId('refresh-test-chart')).not.toBeInTheDocument();
});

test('still shows the no-results state when a finished query returns no rows', async () => {
  render(
    <ChartRenderer
      {...props({
        chartStatus: 'rendered',
        suppressLoadingSpinner: true,
        queriesResponse: [{ data: [] }] as unknown as QueryData[],
      })}
    />,
  );

  expect(await screen.findByText(NO_RESULTS)).toBeInTheDocument();
});

const selfFetchingProps = (
  overrides: Partial<ChartRendererProps>,
): ChartRendererProps =>
  props({
    formData: {
      viz_type: SELF_FETCHING_VIZ_TYPE,
    } as ChartRendererProps['formData'],
    vizType: SELF_FETCHING_VIZ_TYPE,
    suppressLoadingSpinner: true,
    queriesResponse: [],
    ...overrides,
  });

test('keeps a self-fetching chart mounted while an auto-refresh query is in flight', async () => {
  const { rerender } = render(
    <ChartRenderer {...selfFetchingProps({ chartStatus: 'rendered' })} />,
  );
  await screen.findByTestId('self-fetching-test-chart');

  rerender(
    <ChartRenderer {...selfFetchingProps({ chartStatus: 'loading' })} />,
  );
  expect(screen.getByTestId('self-fetching-test-chart')).toBeInTheDocument();

  rerender(
    <ChartRenderer {...selfFetchingProps({ chartStatus: 'success' })} />,
  );
  expect(screen.getByTestId('self-fetching-test-chart')).toBeInTheDocument();
  // A remount would make the chart load all of its data again.
  expect(selfFetchingChartMounted).toHaveBeenCalledTimes(1);
});

test('does not render a self-fetching chart whose first query is still in flight', async () => {
  render(
    <ChartRenderer
      {...selfFetchingProps({ chartStatus: 'loading', queriesResponse: null })}
    />,
  );
  await waitForChartLoad();

  expect(
    screen.queryByTestId('self-fetching-test-chart'),
  ).not.toBeInTheDocument();
  expect(selfFetchingChartMounted).not.toHaveBeenCalled();
});

test('does not render a chart with an empty response while its query is in flight', async () => {
  render(
    <ChartRenderer
      {...props({
        chartStatus: 'loading',
        suppressLoadingSpinner: true,
        queriesResponse: [],
      })}
    />,
  );
  await waitForChartLoad();

  expect(screen.queryByTestId('refresh-test-chart')).not.toBeInTheDocument();
  expect(screen.queryByText(NO_RESULTS)).not.toBeInTheDocument();
});

test('reports the render when an auto-refresh lands on a chart kept on screen', async () => {
  const chartProps = props({ suppressLoadingSpinner: true });
  const { actions } = chartProps;
  const { rerender } = render(
    <ChartRenderer {...chartProps} chartStatus="rendered" />,
  );
  await screen.findByTestId('refresh-test-chart');
  rerender(<ChartRenderer {...chartProps} chartStatus="loading" />);
  await screen.findByTestId('refresh-test-chart');
  expect(actions.chartRenderingSucceeded).not.toHaveBeenCalled();

  rerender(
    <ChartRenderer
      {...chartProps}
      chartStatus="success"
      queriesResponse={queriesResponse(2)}
    />,
  );

  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'value=2',
  );
  expect(actions.chartRenderingSucceeded).toHaveBeenCalledTimes(1);
  expect(actions.chartRenderingSucceeded).toHaveBeenCalledWith(1);
  expect(actions.logEvent).toHaveBeenCalledTimes(1);
});

test('reports a refreshed render once when the plugin mounts for the new response', async () => {
  // The previous response had no rows, so the refresh shows the no-results
  // state and the plugin mounts, and reports itself, when data lands.
  const chartProps = props({
    suppressLoadingSpinner: true,
    queriesResponse: [{ data: [] }] as unknown as QueryData[],
  });
  const { actions } = chartProps;
  const { rerender } = render(
    <ChartRenderer {...chartProps} chartStatus="rendered" />,
  );
  await screen.findByText(NO_RESULTS);
  rerender(<ChartRenderer {...chartProps} chartStatus="loading" />);
  await screen.findByText(NO_RESULTS);

  rerender(
    <ChartRenderer
      {...chartProps}
      chartStatus="success"
      queriesResponse={queriesResponse(2)}
    />,
  );

  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'value=2',
  );
  await waitForChartLoad();
  expect(actions.chartRenderingSucceeded).toHaveBeenCalledTimes(1);
  expect(actions.logEvent).toHaveBeenCalledTimes(1);
});
