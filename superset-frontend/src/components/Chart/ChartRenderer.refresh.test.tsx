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
  () =>
    ({ formData }: { formData: { label?: string } }) => (
      <div data-test="chart-context-menu" data-label={formData.label} />
    ),
);

const VIZ_TYPE = 'refresh_test_chart';
const SELF_FETCHING_VIZ_TYPE = 'refresh_test_self_fetching_chart';
const NO_RESULTS = 'No results were returned for this query';

interface TestChartProps {
  queriesData: { data: { value: number }[] }[];
  label?: string;
  colorScheme?: string;
  stack?: boolean;
  viewport?: { zoom: number };
}

const TestChart = ({
  queriesData,
  label,
  colorScheme,
  stack,
  viewport,
}: TestChartProps) => (
  <div data-test="refresh-test-chart">
    value={queriesData[0].data[0].value} label={label}
    <span data-test="refresh-test-chart-scheme">{colorScheme}</span>
    <span data-test="refresh-test-chart-display">
      stack={String(stack)} zoom={viewport?.zoom}
    </span>
  </div>
);

const testChartTransformed = jest.fn();
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
    transformProps: chartProps => {
      testChartTransformed(chartProps.formData);
      return {
        queriesData: chartProps.queriesData,
        label: chartProps.formData.label,
        colorScheme: chartProps.formData.colorScheme,
        stack: chartProps.formData.stack,
        viewport: chartProps.formData.viewport,
      };
    },
    // `label` needs a query. `stack` and `viewport` only redraw the chart, the
    // way an Area chart's stack toggle and a deck.gl map's viewport do.
    controlPanel: {
      controlPanelSections: [
        {
          label: 'Query',
          expanded: true,
          controlSetRows: [
            [{ name: 'label', config: { type: 'TextControl' } }],
            [
              {
                name: 'stack',
                config: { type: 'CheckboxControl', renderTrigger: true },
              },
            ],
            [
              {
                name: 'viewport',
                config: { type: 'ViewportControl', dontRefreshOnChange: true },
              },
            ],
          ],
        },
      ],
    },
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
  testChartTransformed.mockClear();
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

// Chart passes the form data the response in the store was queried with.
const props = (overrides: Partial<ChartRendererProps>): ChartRendererProps => {
  const merged: ChartRendererProps = {
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
  };
  return { responseFormData: merged.formData, ...merged };
};

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

test('draws each previous response with the form data it was queried with', async () => {
  // The store keeps the same response object until the new one lands, and
  // latestQueryFormData is the form data of the request that produced it.
  const first = queriesResponse(1);
  const { rerender } = render(
    <Chart
      {...dashboardChartProps}
      chartStatus="rendered"
      formData={labelledFormData('first')}
      latestQueryFormData={labelledFormData('first')}
      queriesResponse={first}
    />,
  );
  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'label=first',
  );

  rerender(
    <Chart
      {...dashboardChartProps}
      chartStatus="loading"
      formData={labelledFormData('second')}
      latestQueryFormData={labelledFormData('second')}
      queriesResponse={first}
    />,
  );
  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'value=1 label=first',
  );

  const second = queriesResponse(2);
  rerender(
    <Chart
      {...dashboardChartProps}
      chartStatus="success"
      formData={labelledFormData('second')}
      latestQueryFormData={labelledFormData('second')}
      queriesResponse={second}
    />,
  );
  expect(await screen.findByText('value=2 label=second')).toBeInTheDocument();

  // The second refresh draws the second response with its own form data, not
  // with the first query's.
  rerender(
    <Chart
      {...dashboardChartProps}
      chartStatus="loading"
      formData={labelledFormData('third')}
      latestQueryFormData={labelledFormData('third')}
      queriesResponse={second}
    />,
  );
  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'value=2 label=second',
  );
});

test('draws the previous data with the current form data when the store recorded empty request form data', async () => {
  const first = queriesResponse(1);
  const { rerender } = render(
    <Chart
      {...dashboardChartProps}
      chartStatus="rendered"
      formData={labelledFormData('dashboard')}
      latestQueryFormData={{}}
      queriesResponse={first}
    />,
  );
  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'value=1 label=dashboard',
  );

  rerender(
    <Chart
      {...dashboardChartProps}
      chartStatus="loading"
      formData={labelledFormData('dashboard')}
      latestQueryFormData={{}}
      queriesResponse={first}
    />,
  );
  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'value=1 label=dashboard',
  );
  expect(screen.getByRole('status')).toBeInTheDocument();
});

test('draws a dashboard chart at rest with its current form data', async () => {
  // In edit mode a filter change moves formData on without a query, so the
  // response in the store still belongs to the earlier request.
  const response = queriesResponse(1);
  const { rerender } = render(
    <Chart
      {...dashboardChartProps}
      chartStatus="rendered"
      formData={labelledFormData('queried')}
      latestQueryFormData={labelledFormData('queried')}
      queriesResponse={response}
    />,
  );
  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'label=queried',
  );

  rerender(
    <Chart
      {...dashboardChartProps}
      chartStatus="rendered"
      formData={labelledFormData('current')}
      latestQueryFormData={labelledFormData('queried')}
      queriesResponse={response}
    />,
  );
  expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
    'value=1 label=current',
  );
});

test('pairs a response that lands while the chart is off screen with the request that produced it', async () => {
  // With deferred data, a chart off screen starts no new query, but a query
  // already in flight keeps running and its response lands against the newer
  // form data.
  const previousFlags = window.featureFlags;
  window.featureFlags = {
    ...previousFlags,
    [FeatureFlag.DashboardVirtualization]: true,
    [FeatureFlag.DashboardVirtualizationDeferData]: true,
  };
  try {
    const first = queriesResponse(1);
    const { rerender } = render(
      <Chart
        {...dashboardChartProps}
        chartStatus="rendered"
        formData={labelledFormData('country')}
        latestQueryFormData={labelledFormData('country')}
        queriesResponse={first}
      />,
    );
    await screen.findByTestId('refresh-test-chart');

    // A country refresh is in flight when the chart scrolls out of view.
    rerender(
      <Chart
        {...dashboardChartProps}
        isInView={false}
        chartStatus="loading"
        formData={labelledFormData('country')}
        latestQueryFormData={labelledFormData('country')}
        queriesResponse={first}
      />,
    );
    // Dynamic Group By moves to region. The region query is deferred, so the
    // request's form data stays country.
    rerender(
      <Chart
        {...dashboardChartProps}
        isInView={false}
        chartStatus="loading"
        formData={labelledFormData('region')}
        latestQueryFormData={labelledFormData('country')}
        queriesResponse={first}
      />,
    );
    // The country response lands.
    const country = queriesResponse(2);
    rerender(
      <Chart
        {...dashboardChartProps}
        isInView={false}
        chartStatus="success"
        formData={labelledFormData('region')}
        latestQueryFormData={labelledFormData('country')}
        queriesResponse={country}
      />,
    );
    // Back in view, the region query starts and the country rows are drawn
    // with the country form data until it lands.
    rerender(
      <Chart
        {...dashboardChartProps}
        chartStatus="loading"
        formData={labelledFormData('region')}
        latestQueryFormData={labelledFormData('region')}
        queriesResponse={country}
      />,
    );
    expect(await screen.findByTestId('refresh-test-chart')).toHaveTextContent(
      'value=2 label=country',
    );
  } finally {
    window.featureFlags = previousFlags;
  }
});

test('builds the context menu from the form data the chart is drawn with while it refreshes', async () => {
  // A drill from the context menu has to match the rows on screen, which
  // keep the previous grouping until the new response lands.
  const previousFlags = window.featureFlags;
  window.featureFlags = {
    ...previousFlags,
    [FeatureFlag.DrillToDetail]: true,
  };
  try {
    const first = queriesResponse(1);
    const { rerender } = render(
      <Chart
        {...dashboardChartProps}
        chartStatus="rendered"
        formData={labelledFormData('country')}
        latestQueryFormData={labelledFormData('country')}
        queriesResponse={first}
      />,
    );
    await screen.findByTestId('refresh-test-chart');

    rerender(
      <Chart
        {...dashboardChartProps}
        chartStatus="loading"
        formData={labelledFormData('region')}
        latestQueryFormData={labelledFormData('region')}
        queriesResponse={first}
      />,
    );
    expect(screen.getByTestId('chart-context-menu')).toHaveAttribute(
      'data-label',
      'country',
    );

    rerender(
      <Chart
        {...dashboardChartProps}
        chartStatus="success"
        formData={labelledFormData('region')}
        latestQueryFormData={labelledFormData('region')}
        queriesResponse={queriesResponse(2)}
      />,
    );
    expect(await screen.findByText('value=2 label=region')).toBeInTheDocument();
    expect(screen.getByTestId('chart-context-menu')).toHaveAttribute(
      'data-label',
      'region',
    );
  } finally {
    window.featureFlags = previousFlags;
  }
});

test('draws the previous data with the values the chart set on itself', async () => {
  // A chart sets controls on itself through setControlValue, which a dashboard
  // merges into the form data without a new query. A refresh then re-queries
  // with the form data of the previous request.
  const previous = queriesResponse(1);
  const withDisplay = (stack: boolean, zoom: number) =>
    ({
      ...labelledFormData('before'),
      stack,
      viewport: { zoom },
    }) as ChartRendererProps['formData'];
  const { rerender } = render(
    <Chart
      {...dashboardChartProps}
      chartStatus="rendered"
      formData={withDisplay(false, 1)}
      latestQueryFormData={withDisplay(false, 1)}
      queriesResponse={previous}
    />,
  );
  expect(
    await screen.findByTestId('refresh-test-chart-display'),
  ).toHaveTextContent('stack=false zoom=1');

  rerender(
    <Chart
      {...dashboardChartProps}
      chartStatus="rendered"
      formData={withDisplay(true, 4)}
      latestQueryFormData={withDisplay(false, 1)}
      queriesResponse={previous}
    />,
  );
  expect(
    await screen.findByTestId('refresh-test-chart-display'),
  ).toHaveTextContent('stack=true zoom=4');

  rerender(
    <Chart
      {...dashboardChartProps}
      chartStatus="loading"
      formData={withDisplay(true, 4)}
      latestQueryFormData={withDisplay(false, 1)}
      queriesResponse={previous}
    />,
  );
  expect(screen.getByTestId('refresh-test-chart-display')).toHaveTextContent(
    'stack=true zoom=4',
  );
  expect(screen.getByTestId('refresh-test-chart')).toHaveTextContent(
    'value=1 label=before',
  );
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

test('draws the previous data with the current dashboard colour scheme', async () => {
  // Changing the dashboard colour scheme doesn't run a new query, so formData
  // moves on while the response in the store stays the same.
  const previous = queriesResponse(1);
  const withScheme = (colorScheme: string) =>
    ({
      ...labelledFormData('before'),
      color_scheme: colorScheme,
    }) as ChartRendererProps['formData'];
  const { rerender } = render(
    <Chart
      {...dashboardChartProps}
      chartStatus="rendered"
      formData={withScheme('supersetColors')}
      queriesResponse={previous}
    />,
  );
  expect(
    await screen.findByTestId('refresh-test-chart-scheme'),
  ).toHaveTextContent('supersetColors');

  rerender(
    <Chart
      {...dashboardChartProps}
      chartStatus="rendered"
      formData={withScheme('bnbColors')}
      queriesResponse={previous}
    />,
  );
  expect(
    await screen.findByTestId('refresh-test-chart-scheme'),
  ).toHaveTextContent('bnbColors');

  rerender(
    <Chart
      {...dashboardChartProps}
      chartStatus="loading"
      formData={withScheme('bnbColors')}
      queriesResponse={previous}
    />,
  );
  expect(screen.getByTestId('refresh-test-chart-scheme')).toHaveTextContent(
    'bnbColors',
  );
});

test('draws the previous data without a colour setting cleared on the dashboard', async () => {
  // The response was queried with a colour scheme that the dashboard then
  // drops without a new query.
  const previous = queriesResponse(1);
  const { rerender } = render(
    <Chart
      {...dashboardChartProps}
      chartStatus="rendered"
      formData={
        {
          ...labelledFormData('before'),
          color_scheme: 'supersetColors',
        } as ChartRendererProps['formData']
      }
      queriesResponse={previous}
    />,
  );
  expect(
    await screen.findByTestId('refresh-test-chart-scheme'),
  ).toHaveTextContent('supersetColors');

  rerender(
    <Chart
      {...dashboardChartProps}
      chartStatus="rendered"
      formData={labelledFormData('before')}
      queriesResponse={previous}
    />,
  );
  rerender(
    <Chart
      {...dashboardChartProps}
      chartStatus="loading"
      formData={labelledFormData('before')}
      queriesResponse={previous}
    />,
  );
  await waitForChartLoad();

  expect(screen.getByTestId('refresh-test-chart')).toHaveTextContent('value=1');
  expect(screen.getByTestId('refresh-test-chart-scheme')).toBeEmptyDOMElement();
});

test.each([
  ['color_scheme', 'colorScheme', 'supersetColors', 'bnbColors'],
  ['own_color_scheme', 'ownColorScheme', 'supersetColors', 'bnbColors'],
  ['label_colors', 'labelColors', { boy: '#111111' }, { boy: '#222222' }],
  ['shared_label_colors', 'sharedLabelColors', ['boy'], ['boy', 'girl']],
  [
    'map_label_colors',
    'mapLabelColors',
    { boy: '#111111' },
    { boy: '#222222' },
  ],
])(
  'draws the previous data with the %s the dashboard set without a query',
  async (key, chartPropsKey, queried, current) => {
    // Label colour edits and shared colour sync change formData without
    // running a query, so the response and its request form data stay as
    // they were.
    const previous = queriesResponse(1);
    const queriedFormData = {
      ...labelledFormData('before'),
      [key]: queried,
    } as ChartRendererProps['formData'];
    const currentFormData = {
      ...labelledFormData('before'),
      [key]: current,
    } as ChartRendererProps['formData'];
    const { rerender } = render(
      <Chart
        {...dashboardChartProps}
        chartStatus="rendered"
        formData={queriedFormData}
        latestQueryFormData={queriedFormData}
        queriesResponse={previous}
      />,
    );
    await waitForChartLoad();

    rerender(
      <Chart
        {...dashboardChartProps}
        chartStatus="rendered"
        formData={currentFormData}
        latestQueryFormData={queriedFormData}
        queriesResponse={previous}
      />,
    );
    rerender(
      <Chart
        {...dashboardChartProps}
        chartStatus="loading"
        formData={currentFormData}
        latestQueryFormData={queriedFormData}
        queriesResponse={previous}
      />,
    );
    await waitForChartLoad();

    expect(screen.getByTestId('refresh-test-chart')).toHaveTextContent(
      'value=1 label=before',
    );
    expect(testChartTransformed).toHaveBeenLastCalledWith(
      expect.objectContaining({ [chartPropsKey]: current }),
    );
  },
);

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

test('does not redraw a dashboard chart under the spinner when a refresh starts with nothing changed', async () => {
  // A refresh sends latestQueryFormData again, so the store keeps both form
  // data objects as they are. The form data the chart is drawn with is built
  // from them while it refreshes, and an ECharts chart replays its entrance
  // animation each time the plugin transforms it again. The dashboard also
  // passes its filter callbacks memoized.
  const chartProps = {
    ...dashboardChartProps,
    addFilter: jest.fn(),
    onFilterMenuOpen: jest.fn(),
    onFilterMenuClose: jest.fn(),
  };
  const formData = labelledFormData('first');
  const latestQueryFormData = labelledFormData('first');
  const response = queriesResponse(1);
  const { rerender } = render(
    <Chart
      {...chartProps}
      chartStatus="rendered"
      formData={formData}
      latestQueryFormData={latestQueryFormData}
      queriesResponse={response}
    />,
  );
  await screen.findByTestId('refresh-test-chart');
  const transformsBeforeRefresh = testChartTransformed.mock.calls.length;

  rerender(
    <Chart
      {...chartProps}
      chartStatus="loading"
      formData={formData}
      latestQueryFormData={latestQueryFormData}
      queriesResponse={response}
    />,
  );
  await waitForChartLoad();

  expect(screen.getByTestId('refresh-test-chart')).toHaveTextContent(
    'value=1 label=first',
  );
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(testChartTransformed).toHaveBeenCalledTimes(transformsBeforeRefresh);

  const second = queriesResponse(2);
  rerender(
    <Chart
      {...chartProps}
      chartStatus="success"
      formData={formData}
      latestQueryFormData={latestQueryFormData}
      queriesResponse={second}
    />,
  );
  expect(await screen.findByText('value=2 label=first')).toBeInTheDocument();

  // A filter change: the request starts with the new form data, and the chart
  // is drawn with it once its response lands.
  const filteredFormData = labelledFormData('second');
  const filteredQueryFormData = labelledFormData('second');
  const third = queriesResponse(3);
  rerender(
    <Chart
      {...chartProps}
      chartStatus="loading"
      formData={filteredFormData}
      latestQueryFormData={filteredQueryFormData}
      queriesResponse={second}
    />,
  );
  rerender(
    <Chart
      {...chartProps}
      chartStatus="success"
      formData={filteredFormData}
      latestQueryFormData={filteredQueryFormData}
      queriesResponse={third}
    />,
  );
  expect(await screen.findByText('value=3 label=second')).toBeInTheDocument();

  // The next refresh with nothing changed compares against the form data the
  // chart was last drawn with, not the one it was first drawn with.
  const transformsBeforeSecondRefresh = testChartTransformed.mock.calls.length;
  rerender(
    <Chart
      {...chartProps}
      chartStatus="loading"
      formData={filteredFormData}
      latestQueryFormData={filteredQueryFormData}
      queriesResponse={third}
    />,
  );
  await waitForChartLoad();

  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(testChartTransformed).toHaveBeenCalledTimes(
    transformsBeforeSecondRefresh,
  );
});

test('does not redraw a dashboard chart under the spinner when its query records new form data objects', async () => {
  // A query started from the chart itself sends formData, and the store
  // records it as latestQueryFormData: a different object from the one the
  // response was queried with, with the same values.
  const chartProps = {
    ...dashboardChartProps,
    addFilter: jest.fn(),
    onFilterMenuOpen: jest.fn(),
    onFilterMenuClose: jest.fn(),
  };
  const formData = labelledFormData('first');
  const response = queriesResponse(1);
  const { rerender } = render(
    <Chart
      {...chartProps}
      chartStatus="rendered"
      formData={formData}
      latestQueryFormData={labelledFormData('first')}
      queriesResponse={response}
    />,
  );
  await screen.findByTestId('refresh-test-chart');
  const transformsBeforeRefresh = testChartTransformed.mock.calls.length;

  rerender(
    <Chart
      {...chartProps}
      chartStatus="loading"
      formData={formData}
      latestQueryFormData={formData}
      queriesResponse={response}
    />,
  );
  await waitForChartLoad();

  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(testChartTransformed).toHaveBeenCalledTimes(transformsBeforeRefresh);
});

const selfFetchingChartProps = {
  ...dashboardChartProps,
  vizType: SELF_FETCHING_VIZ_TYPE,
  formData: {
    datasource: '1__table',
    viz_type: SELF_FETCHING_VIZ_TYPE,
  } as ChartRendererProps['formData'],
};

test('replaces a self-fetching dashboard chart with the spinner through a manual refresh', async () => {
  // Its own query lands first and its data reloads after that, so kept on
  // screen it would show the previous data with no spinner while it reloads.
  const { rerender } = render(
    <Chart
      {...selfFetchingChartProps}
      chartStatus="rendered"
      queriesResponse={[]}
    />,
  );
  await screen.findByTestId('self-fetching-test-chart');

  rerender(
    <Chart
      {...selfFetchingChartProps}
      chartStatus="loading"
      queriesResponse={[]}
    />,
  );
  expect(
    screen.queryByTestId('self-fetching-test-chart'),
  ).not.toBeInTheDocument();
  expect(screen.getByText('Waiting on database...')).toBeInTheDocument();

  rerender(
    <Chart
      {...selfFetchingChartProps}
      chartStatus="success"
      queriesResponse={[]}
    />,
  );
  expect(
    await screen.findByTestId('self-fetching-test-chart'),
  ).toBeInTheDocument();
  // Mounting again is what reloads its data.
  expect(selfFetchingChartMounted).toHaveBeenCalledTimes(2);
});

test('keeps a self-fetching dashboard chart mounted through an auto-refresh', async () => {
  const { rerender } = render(
    <Chart
      {...selfFetchingChartProps}
      chartStatus="rendered"
      queriesResponse={[]}
    />,
  );
  await screen.findByTestId('self-fetching-test-chart');

  rerender(
    <Chart
      {...selfFetchingChartProps}
      chartStatus="loading"
      queriesResponse={[]}
      suppressLoadingSpinner
    />,
  );
  expect(screen.getByTestId('self-fetching-test-chart')).toBeInTheDocument();

  rerender(
    <Chart
      {...selfFetchingChartProps}
      chartStatus="success"
      queriesResponse={[]}
      suppressLoadingSpinner
    />,
  );
  expect(screen.getByTestId('self-fetching-test-chart')).toBeInTheDocument();
  expect(selfFetchingChartMounted).toHaveBeenCalledTimes(1);
});

// A plugin that throws while rendering leaves its response in the store with
// no query error, and only the chart status and alert record the failure.
test.each([
  ['a manual refresh', false],
  ['an auto-refresh', true],
])(
  'does not draw a response that failed to render again during %s',
  async (_, suppressLoadingSpinner) => {
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

    rerender(
      <Chart
        {...dashboardChartProps}
        chartStatus="failed"
        chartAlert="An error occurred while rendering the visualization"
        formData={labelledFormData('before')}
        queriesResponse={previous}
      />,
    );
    expect(screen.queryByTestId('refresh-test-chart')).not.toBeInTheDocument();

    rerender(
      <Chart
        {...dashboardChartProps}
        chartStatus="loading"
        formData={labelledFormData('before')}
        queriesResponse={previous}
        suppressLoadingSpinner={suppressLoadingSpinner}
      />,
    );
    await waitForChartLoad();

    expect(screen.queryByTestId('refresh-test-chart')).not.toBeInTheDocument();
    // Even when an auto-refresh suppresses the spinner, the chart can't be
    // drawn, so the spinner fills the box until the new response lands.
    expect(screen.getByText('Waiting on database...')).toBeInTheDocument();
  },
);

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
