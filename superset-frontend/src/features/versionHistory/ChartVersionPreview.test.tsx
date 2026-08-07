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
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import type { VersionHistoryState } from './types';
import type { VersionHistoryRootState } from './reducer';
import { fetchDatasourceMetadata, fetchVersionSnapshot } from './api';
import ChartVersionPreview from './ChartVersionPreview';

jest.mock('./api', () => ({
  fetchDatasourceMetadata: jest.fn(),
  fetchVersionSnapshot: jest.fn(),
}));
jest.mock('./PreviewBanner', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('src/components/Chart/chartAction', () => ({
  getChartDataRequest: jest.fn(),
  handleChartDataResponse: jest.fn(),
}));
// SuperChart would need a registered viz plugin; the assertions here are
// about what the effect resolves to, not how it renders.
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SuperChart: ({ formData }: { formData: { datasource: string } }) => (
    <div data-test="super-chart">{formData.datasource}</div>
  ),
}));

const { handleChartDataResponse } = jest.requireMock(
  'src/components/Chart/chartAction',
);

const previewState = (): VersionHistoryState => ({
  isPanelOpen: true,
  entityType: 'chart',
  include: 'all',
  // SET_VERSION_PREVIEW always enters the applying state; starting from the
  // real post-dispatch shape keeps these tests honest about the lifecycle —
  // the component itself must announce completion.
  isPreviewApplying: true,
  preview: {
    entityUuid: 'chart-uuid',
    versionUuid: 'version-uuid',
    transactionId: 1,
    headline: 'A save',
    issuedAt: '2026-07-01T00:00:00Z',
  },
  sessionLog: [],
  restoreCount: 0,
  lastRestoredEntityUuid: null,
});

const LIVE_DATASOURCE = { id: 5, type: 'table', columns: [], metrics: [] };

const renderPreview = (liveDatasource: unknown = LIVE_DATASOURCE) => {
  const store = createStore(
    {
      versionHistory: previewState(),
      explore: { datasource: liveDatasource, slice: { editors: [{ id: 1 }] } },
      user: { userId: 1, roles: {} },
    },
    reducerIndex,
  );
  render(<ChartVersionPreview />, { useTheme: true, store });
  return store;
};

beforeEach(() => {
  jest.clearAllMocks();
  (fetchVersionSnapshot as jest.Mock).mockResolvedValue({
    params: '{"metric":"count"}',
    viz_type: 'table',
    datasource_id: 5,
    datasource_type: 'table',
  });
  (getChartDataRequest as jest.Mock).mockResolvedValue({
    response: {},
    json: {},
  });
  (handleChartDataResponse as jest.Mock).mockResolvedValue([{ data: [] }]);
});

test('renders the snapshot against the datasource the version was built on', async () => {
  renderPreview();

  await waitFor(() => {
    expect(screen.getByTestId('super-chart')).toHaveTextContent('5__table');
  });
  // The live datasource already matches, so no extra metadata round trip.
  expect(fetchDatasourceMetadata).not.toHaveBeenCalled();
});

test('announces the applied preview so the banner can offer Restore', async () => {
  // The store enters isPreviewApplying on SET_VERSION_PREVIEW and only this
  // component's announcement leaves it; without it the banner reads "Loading
  // historical version" forever and never renders the Restore button.
  const store = renderPreview();

  await waitFor(() => {
    expect(
      (store.getState() as unknown as VersionHistoryRootState).versionHistory
        .isPreviewApplying,
    ).toBe(false);
  });
});

test('announces completion even when the preview fails to load', async () => {
  // A failed load shows the error alert in place of the chart; the applying
  // state must still clear so the banner is not stuck reporting a load that
  // has already settled.
  (getChartDataRequest as jest.Mock).mockRejectedValue(
    new Response(JSON.stringify({ message: 'boom' }), { status: 500 }),
  );
  const store = renderPreview();

  await waitFor(() => {
    expect(
      (store.getState() as unknown as VersionHistoryRootState).versionHistory
        .isPreviewApplying,
    ).toBe(false);
  });
});

test('fetches metadata when the version used a different datasource', async () => {
  // A chart repointed at another dataset since the snapshot: the preview must
  // describe itself with the dataset the version actually used, not the
  // current one.
  (fetchVersionSnapshot as jest.Mock).mockResolvedValue({
    params: '{}',
    viz_type: 'table',
    datasource_id: 9,
    datasource_type: 'table',
  });
  (fetchDatasourceMetadata as jest.Mock).mockResolvedValue({
    id: 9,
    type: 'table',
    columns: [],
    metrics: [],
  });
  renderPreview();

  await waitFor(() => {
    expect(fetchDatasourceMetadata).toHaveBeenCalledWith(9, 'table');
  });
  expect(screen.getByTestId('super-chart')).toHaveTextContent('9__table');
});

test('explains a version whose datasource is gone rather than failing generically', async () => {
  (fetchVersionSnapshot as jest.Mock).mockResolvedValue({
    params: '{}',
    viz_type: 'table',
    datasource_id: 9,
    datasource_type: 'table',
  });
  (fetchDatasourceMetadata as jest.Mock).mockRejectedValue(new Error('404'));
  renderPreview();

  await waitFor(() => {
    expect(
      screen.getByText(/data this version was built on is no longer available/),
    ).toBeInTheDocument();
  });
  expect(screen.queryByTestId('super-chart')).not.toBeInTheDocument();
});

test('explains a version that records no viz type or dataset', async () => {
  // Every version-table column is nullable — a row written for a delete
  // carries nulls throughout. Without the guard the preview requested
  // `undefined__undefined` and surfaced whatever the API said about it.
  (fetchVersionSnapshot as jest.Mock).mockResolvedValue({
    params: '{}',
    viz_type: null,
    datasource_id: null,
    datasource_type: null,
  });
  renderPreview();

  await waitFor(() => {
    expect(
      screen.getByText(
        /does not record a visualization type and dataset, so it cannot be previewed/,
      ),
    ).toBeInTheDocument();
  });
  expect(fetchDatasourceMetadata).not.toHaveBeenCalled();
  expect(getChartDataRequest).not.toHaveBeenCalled();
  expect(screen.queryByTestId('super-chart')).not.toBeInTheDocument();
});

test('surfaces a chart-data failure instead of rendering an empty chart', async () => {
  (getChartDataRequest as jest.Mock).mockRejectedValue(
    new Response(JSON.stringify({ message: 'Query timed out' }), {
      status: 422,
    }),
  );
  renderPreview();

  await waitFor(() => {
    expect(screen.getByText(/Query timed out/)).toBeInTheDocument();
  });
  expect(screen.queryByTestId('super-chart')).not.toBeInTheDocument();
});

test('malformed snapshot params surface as an error, not a crash', async () => {
  // params is free-form JSON stored per version; a snapshot written by an
  // older or hand-edited record must not take the page down.
  (fetchVersionSnapshot as jest.Mock).mockResolvedValue({
    params: '{not json',
    viz_type: 'table',
    datasource_id: 5,
    datasource_type: 'table',
  });
  renderPreview();

  await waitFor(() => {
    expect(screen.queryByTestId('super-chart')).not.toBeInTheDocument();
  });
  expect(screen.getByRole('alert')).toBeInTheDocument();
});
