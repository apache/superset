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

import {
  createStore,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { SupersetClient } from '@superset-ui/core';
import type { QueryFormData } from '@superset-ui/core';
import type { charts as chartsApi } from '@apache-superset/core';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import AssetChart from './AssetChart';
import { charts } from '.';

jest.mock('src/components/Chart/chartAction', () => ({
  requestChartDataResolved: jest.fn(),
}));
// SuperChart would need a registered viz plugin; what matters here is what
// the component resolves to and hands it, not how a plugin draws it.
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SuperChart: ({
    formData,
    datasource,
    queriesData,
  }: {
    formData: QueryFormData;
    datasource?: { id?: number };
    queriesData: unknown[];
  }) => (
    <div data-test="super-chart">
      {`${formData.viz_type} ${formData.datasource} ds=${datasource?.id} rows=${queriesData.length}`}
    </div>
  ),
}));

const LIVE_DATASOURCE = { id: 1, type: 'table', columns: [], metrics: [] };

const FORM_DATA = {
  viz_type: 'table',
  datasource: '1__table',
  row_limit: 50,
};

const renderChart = (
  formData: chartsApi.ChartFormData = FORM_DATA,
  state: object = { explore: { datasource: LIVE_DATASOURCE } },
) =>
  render(<AssetChart formData={formData} />, {
    useTheme: true,
    store: createStore(state, reducerIndex),
  });

let clientGet: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  (requestChartDataResolved as jest.Mock).mockResolvedValue([{ data: [] }]);
  clientGet = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: { dataset: { id: 1, type: 'table' } } },
  } as never);
});

afterEach(() => {
  clientGet.mockRestore();
});

test('is what the host hands extensions as charts.AssetChart', () => {
  expect(charts.AssetChart).toBe(AssetChart);
});

test('draws the form data it is given, queried as an unsaved chart', async () => {
  renderChart();

  await waitFor(() => {
    expect(screen.getByTestId('super-chart')).toHaveTextContent(
      'table 1__table ds=1 rows=1',
    );
  });
  expect(requestChartDataResolved).toHaveBeenCalledWith(
    { formData: FORM_DATA },
    expect.any(AbortSignal),
  );
  // Looked up from the form data's own `datasource`, not from the dataset the
  // page happens to hold.
  expect(clientGet).toHaveBeenCalledWith({
    endpoint: '/api/v1/explore/?datasource_id=1&datasource_type=table',
  });
});

test('reports a loading state until the query answers', async () => {
  let answer: (rows: unknown[]) => void = () => {};
  (requestChartDataResolved as jest.Mock).mockReturnValue(
    new Promise(resolve => {
      answer = resolve;
    }),
  );

  renderChart();

  expect(screen.getByTestId('asset-chart')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  expect(screen.queryByTestId('super-chart')).not.toBeInTheDocument();

  answer([{ data: [] }]);

  await waitFor(() => {
    expect(screen.getByTestId('super-chart')).toBeInTheDocument();
  });
  expect(screen.getByTestId('asset-chart')).toHaveAttribute(
    'aria-busy',
    'false',
  );
});

test('fetches the dataset its form data names', async () => {
  clientGet.mockResolvedValue({
    json: { result: { dataset: { id: 1, type: 'table' } } },
  });

  renderChart(FORM_DATA, {});

  await waitFor(() => {
    expect(screen.getByTestId('super-chart')).toHaveTextContent('ds=1');
  });
  expect(clientGet).toHaveBeenCalledWith({
    endpoint: '/api/v1/explore/?datasource_id=1&datasource_type=table',
  });
});

test("form data naming no dataset is not labelled with the page's", async () => {
  // The store holds a dataset here, and the form data names none. Reusing it
  // would caption the chart with an unrelated dataset's columns, so nothing
  // is reused and nothing is looked up.
  renderChart({ viz_type: 'table' });

  await waitFor(() => {
    expect(screen.getByTestId('super-chart')).toHaveTextContent(
      'table undefined ds=undefined',
    );
  });
  expect(clientGet).not.toHaveBeenCalled();
});

test('survives a store with no datasource and form data that names none', async () => {
  renderChart({ viz_type: 'table' }, { explore: {} });

  await waitFor(() => {
    expect(screen.getByTestId('super-chart')).toHaveTextContent(
      'table undefined ds=undefined',
    );
  });
  expect(clientGet).not.toHaveBeenCalled();
});

test('survives having no store at all', async () => {
  render(<AssetChart formData={{ viz_type: 'table' }} />, {
    useTheme: true,
    useRedux: false,
  });

  await waitFor(() => {
    expect(screen.getByTestId('super-chart')).toBeInTheDocument();
  });
});

test("leaves an unreadable dataset to the query's own refusal", async () => {
  clientGet.mockRejectedValue(new Response('{}', { status: 403 }));
  (requestChartDataResolved as jest.Mock).mockRejectedValue(
    new Response(
      JSON.stringify({ message: "You don't have access to this chart." }),
      { status: 403 },
    ),
  );

  renderChart({ ...FORM_DATA, datasource: '9__table' });

  expect(await screen.findByTestId('asset-chart-error')).toHaveTextContent(
    "You don't have access to this chart.",
  );
  expect(requestChartDataResolved).toHaveBeenCalled();
});

test('draws without metadata when only the lookup is refused', async () => {
  clientGet.mockRejectedValue(new Response('{}', { status: 403 }));

  renderChart({ ...FORM_DATA, datasource: '9__table' });

  await waitFor(() => {
    expect(screen.getByTestId('super-chart')).toHaveTextContent('ds=undefined');
  });
});

test("keeps the query's own message when it fails", async () => {
  (requestChartDataResolved as jest.Mock).mockRejectedValue(
    new Response(JSON.stringify({ message: 'Column "x" does not exist' }), {
      status: 400,
    }),
  );

  renderChart();

  expect(await screen.findByTestId('asset-chart-error')).toHaveTextContent(
    'Column "x" does not exist',
  );
  expect(screen.getByTestId('asset-chart')).toHaveAttribute(
    'aria-busy',
    'false',
  );
});

test('form data that names no viz type shows an empty state and queries nothing', () => {
  renderChart({ datasource: '1__table' });

  expect(screen.getByTestId('asset-chart-empty')).toHaveTextContent(
    /does not name a chart type/,
  );
  expect(screen.getByTestId('asset-chart')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  expect(requestChartDataResolved).not.toHaveBeenCalled();
  expect(screen.queryByTestId('super-chart')).not.toBeInTheDocument();
});

test('empty form data does not crash the page', () => {
  expect(() => renderChart({})).not.toThrow();
  expect(screen.getByTestId('asset-chart-empty')).toBeInTheDocument();
});

test('queries again, and aborts the old query, when the form data changes', async () => {
  const { rerender } = renderChart();
  await waitFor(() => {
    expect(screen.getByTestId('super-chart')).toBeInTheDocument();
  });
  const firstSignal = (requestChartDataResolved as jest.Mock).mock
    .calls[0][1] as AbortSignal;

  rerender(<AssetChart formData={{ ...FORM_DATA, row_limit: 10 }} />);

  await waitFor(() => {
    expect(requestChartDataResolved).toHaveBeenCalledTimes(2);
  });
  expect(firstSignal.aborted).toBe(true);
});

test('aborts its query when it unmounts', async () => {
  (requestChartDataResolved as jest.Mock).mockReturnValue(
    new Promise(() => {}),
  );
  const { unmount } = renderChart();
  await waitFor(() => expect(requestChartDataResolved).toHaveBeenCalled());
  const signal = (requestChartDataResolved as jest.Mock).mock
    .calls[0][1] as AbortSignal;

  unmount();

  expect(signal.aborted).toBe(true);
});
