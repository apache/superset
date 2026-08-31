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

/**
 * Regression coverage for re-selecting the version already being previewed
 * (every change row is clickable, including rows of the previewed group).
 * SET_VERSION_PREVIEW used to re-enter the applying state unconditionally,
 * but the appliers' effects key on versionUuid and never re-run for an
 * identical value — so nothing announced completion again and the banner
 * reported "Loading historical version" forever, with Restore withheld.
 *
 * Test contributed by @kgabryje in review; assertions flipped to pin the
 * fixed behaviour (the reducer treats the re-selection as a no-op).
 */
import { act } from 'react';
import { createStore, render, waitFor } from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import type { VersionHistoryState } from './types';
import { setVersionPreview, type VersionHistoryRootState } from './reducer';
import { fetchDatasourceMetadata, fetchVersionSnapshot } from './api';
import ChartVersionPreview from './ChartVersionPreview';

jest.mock('./api', () => ({
  fetchDatasourceMetadata: jest.fn(),
  fetchVersionSnapshot: jest.fn(),
}));
jest.mock('./PreviewBanner', () => ({ __esModule: true, default: () => null }));
jest.mock('src/components/Chart/chartAction', () => ({
  getChartDataRequest: jest.fn(),
  handleChartDataResponse: jest.fn(),
}));
jest.mock('src/explore/exploreUtils', () => ({
  ...jest.requireActual('src/explore/exploreUtils'),
  getQuerySettings: () => [false],
}));
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SuperChart: () => <div data-test="super-chart" />,
}));

const { handleChartDataResponse } = jest.requireMock(
  'src/components/Chart/chartAction',
);

const PREVIEW = {
  entityUuid: 'chart-uuid',
  versionUuid: 'version-uuid',
  transactionId: 1,
  headline: 'A save',
  issuedAt: '2026-07-01T00:00:00Z',
};

const previewState = (): VersionHistoryState => ({
  isPanelOpen: true,
  entityType: 'chart',
  include: 'all',
  isPreviewApplying: true,
  preview: PREVIEW,
  sessionLog: [],
  restoreCount: 0,
  lastRestoredEntityUuid: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  (fetchVersionSnapshot as jest.Mock).mockResolvedValue({
    params: '{"metric":"count"}',
    viz_type: 'table',
    datasource_id: 5,
    datasource_type: 'table',
  });
  (fetchDatasourceMetadata as jest.Mock).mockResolvedValue({});
  (getChartDataRequest as jest.Mock).mockResolvedValue({
    response: {},
    json: {},
  });
  (handleChartDataResponse as jest.Mock).mockResolvedValue([{ data: [] }]);
});

test('re-selecting the already-previewed version does not re-enter applying', async () => {
  const store = createStore(
    {
      versionHistory: previewState(),
      explore: {
        datasource: { id: 5, type: 'table', columns: [], metrics: [] },
        slice: { editors: [{ id: 1 }] },
      },
      user: { userId: 1, roles: {} },
    },
    reducerIndex,
  );
  render(<ChartVersionPreview />, { useTheme: true, store });

  const applying = () =>
    (store.getState() as unknown as VersionHistoryRootState).versionHistory
      .isPreviewApplying;

  await waitFor(() => expect(applying()).toBe(false)); // first apply settles

  // The user clicks a change row inside the group they are already
  // previewing (every row is clickable, including the previewed group's).
  act(() => {
    store.dispatch(setVersionPreview({ ...PREVIEW }));
  });
  // The reducer treats it as a no-op: the applier effects key on versionUuid
  // and would never re-run for an identical value, so re-entering the
  // applying state here could never be left again.
  expect(applying()).toBe(false);

  // Flush pending microtasks to show nothing re-enters it later either.
  await act(async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 50);
    });
  });
  expect(applying()).toBe(false);
});
