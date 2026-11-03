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
import type { QueryFormData } from '@superset-ui/core';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import { fetchDatasourceMetadata } from 'src/features/versionHistory/api';
import ProposedChartPreview from './ProposedChartPreview';

jest.mock('src/features/versionHistory/api', () => ({
  fetchDatasourceMetadata: jest.fn(),
}));
jest.mock('src/components/Chart/chartAction', () => ({
  requestChartDataResolved: jest.fn(),
}));
// SuperChart would need a registered viz plugin; what matters here is what
// the effect resolves to and hands it, not how the plugin draws it.
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SuperChart: ({ formData }: { formData: QueryFormData }) => (
    <div data-test="super-chart">{`${formData.viz_type} ${formData.datasource} ${formData.slice_id}`}</div>
  ),
}));

const LIVE_DATASOURCE = { id: 1, type: 'table', columns: [], metrics: [] };

const PROPOSED = {
  viz_type: 'table',
  datasource: '1__table',
  slice_id: 0,
  row_limit: 50,
} as unknown as QueryFormData;

const renderPreview = (formData: QueryFormData = PROPOSED) => {
  const store = createStore(
    { explore: { datasource: LIVE_DATASOURCE } },
    reducerIndex,
  );
  render(<ProposedChartPreview formData={formData} />, {
    useTheme: true,
    store,
  });
  return store;
};

beforeEach(() => {
  jest.clearAllMocks();
  (requestChartDataResolved as jest.Mock).mockResolvedValue([{ data: [] }]);
});

test('draws the proposed chart as an unsaved one', async () => {
  renderPreview();

  await waitFor(() => {
    expect(screen.getByTestId('super-chart')).toHaveTextContent(
      'table 1__table 0',
    );
  });
  // The chart is on the same dataset it is now, so no extra round trip.
  expect(fetchDatasourceMetadata).not.toHaveBeenCalled();
});

test('warns when the dataset underneath has its own change open', async () => {
  // Approving this chart first publishes it against columns that do not
  // exist yet, and viewers see it break (QA-09). The preview queries the
  // live dataset, so it cannot show that on its own.
  render(
    <ProposedChartPreview
      formData={PROPOSED}
      pendingDataset={{ title: 'birth_names', author: 'Priya Shah' }}
    />,
    { useTheme: true, store: createStore({ explore: { datasource: LIVE_DATASOURCE } }, reducerIndex) },
  );

  expect(
    screen.getByTestId('proposed-chart-pending-dataset'),
  ).toHaveTextContent(/awaiting review from Priya Shah/);
});

test('says nothing about the dataset when nothing is pending on it', () => {
  renderPreview();

  expect(
    screen.queryByTestId('proposed-chart-pending-dataset'),
  ).not.toBeInTheDocument();
});

test('fetches metadata when the change moves the chart to another dataset', async () => {
  (fetchDatasourceMetadata as jest.Mock).mockResolvedValue({
    id: 9,
    type: 'table',
    columns: [],
    metrics: [],
  });

  renderPreview({ ...PROPOSED, datasource: '9__table' } as QueryFormData);

  await waitFor(() => {
    expect(fetchDatasourceMetadata).toHaveBeenCalledWith(9, 'table');
  });
  expect(screen.getByTestId('super-chart')).toHaveTextContent('9__table');
});

test('a dataset that is gone is reported rather than drawn against the live one', async () => {
  (fetchDatasourceMetadata as jest.Mock).mockRejectedValue(new Error('404'));

  renderPreview({ ...PROPOSED, datasource: '9__table' } as QueryFormData);

  await waitFor(() => {
    expect(
      screen.getByText(/dataset this change points at is not available/),
    ).toBeInTheDocument();
  });
  expect(screen.queryByTestId('super-chart')).not.toBeInTheDocument();
});

test("a proposal that will not query shows the query's own message", async () => {
  // Worth knowing before approving it, so the message is kept rather than
  // replaced with a generic failure.
  (requestChartDataResolved as jest.Mock).mockRejectedValue(
    new Error('Column [bad] not found'),
  );

  renderPreview();

  await waitFor(() => {
    expect(screen.getByText(/Column \[bad\] not found/)).toBeInTheDocument();
  });
  expect(screen.queryByTestId('super-chart')).not.toBeInTheDocument();
});
