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
 * sc-131032: the author opens Explore on their own changes.
 *
 * Explore opened on the published chart while the author had an open
 * change on it. Two things followed. The author pressed Edit and was
 * handed the live version, which is the stale chart as filed; and because
 * Explore posts every control rather than the ones that moved, their next
 * save wrote live over the draft, which is the lost edit filed after it.
 * One cause, two tickets.
 *
 * It is fixed here rather than in the review components because there is
 * no post-load seam to use. `hydrateExplore` builds the controls, the
 * form data, `latestQueryFormData` and the chart entry in a single pass;
 * writing the proposal in afterwards leaves them disagreeing and took the
 * panel down on an undefined `chartStatus` three times over. So the
 * proposal arrives as the form data, before the store exists.
 */
import fetchMock from 'fetch-mock';
import { render, waitFor } from 'spec/helpers/testing-library';
import { getExploreFormData } from 'spec/fixtures/mockExploreFormData';
import { FeatureFlag, JsonObject, VizType } from '@superset-ui/core';
import { useUnsavedChangesPrompt } from 'src/hooks/useUnsavedChangesPrompt';
import { getParsedExploreURLParams } from 'src/explore/exploreUtils/getParsedExploreURLParams';
import * as hydrateExploreActions from 'src/explore/actions/hydrateExplore';
import ChartPage from '.';

jest.mock('src/hooks/useUnsavedChangesPrompt', () => ({
  useUnsavedChangesPrompt: jest.fn(),
}));
jest.mock('re-resizable', () => ({
  Resizable: () => <div data-test="mock-re-resizable" />,
}));
jest.mock(
  'src/explore/components/ExploreChartPanel',
  () =>
    ({ exploreState }: { exploreState: JsonObject }) => (
      <div data-test="mock-explore-chart-panel">
        {JSON.stringify(exploreState)}
      </div>
    ),
);
jest.mock('src/dashboard/util/charts/getFormDataWithExtraFilters');
jest.mock('src/explore/exploreUtils/getParsedExploreURLParams', () => ({
  getParsedExploreURLParams: jest.fn(),
}));

const EXPLORE = 'glob:*/api/v1/explore/*';
const OPEN_CHANGE = 'glob:*/api/v1/change_request/asset/chart/*';

const SLICE_ID = 42;

/** The published chart: the row limit the reviewer's viewers are served. */
const liveFormData = getExploreFormData({
  viz_type: VizType.Table,
  slice_id: SLICE_ID,
  row_limit: 1000,
});

/** What the gate captured from the author's save: the whole posted form. */
const draftParams = {
  ...liveFormData,
  row_limit: 50,
};

const openChange = (over: JsonObject = {}) => ({
  result: {
    id: 9,
    asset_type: 'chart',
    asset_id: SLICE_ID,
    status: 'changes_requested',
    is_open: true,
    is_author: true,
    changed_fields: ['params'],
    proposed: {
      slice_name: 'Sales by region',
      params: JSON.stringify(draftParams),
      viz_type: VizType.Table,
      datasource_id: 1,
      datasource_type: 'table',
    },
    ...over,
  },
});

const mount = () =>
  render(<ChartPage />, { useRouter: true, useRedux: true, useDnd: true });

const hydratedWith = (spy: jest.SpyInstance) =>
  spy.mock.calls[spy.mock.calls.length - 1][0];

let hydrateSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };
  (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
    showModal: false,
    setShowModal: jest.fn(),
    handleConfirmNavigation: jest.fn(),
    handleSaveAndCloseModal: jest.fn(),
  });
  (getParsedExploreURLParams as jest.Mock).mockReturnValue(
    new Map([['slice_id', SLICE_ID]]),
  );
  fetchMock.get(EXPLORE, {
    result: { dataset: { id: 1 }, form_data: liveFormData },
  });
  hydrateSpy = jest.spyOn(hydrateExploreActions, 'hydrateExplore');
});

afterEach(() => {
  window.featureFlags = {};
  hydrateSpy.mockRestore();
  fetchMock.clearHistory().removeRoutes();
});

test('the author is given their own changes to edit', async () => {
  fetchMock.get(OPEN_CHANGE, openChange());

  mount();

  await waitFor(() => expect(hydrateSpy).toHaveBeenCalled());
  await waitFor(() =>
    expect(hydratedWith(hydrateSpy).form_data.row_limit).toBe(50),
  );
  expect(hydratedWith(hydrateSpy).openedOnProposal).toBe(true);
});

test('it is still their own chart, not an unsaved copy', async () => {
  // The reviewer's preview is drawn with `slice_id: 0` so it cannot land
  // in the live chart's cache slot. Doing that here would turn the
  // author's next Save into a Save as.
  fetchMock.get(OPEN_CHANGE, openChange());

  mount();

  await waitFor(() => expect(hydrateSpy).toHaveBeenCalled());
  await waitFor(() =>
    expect(hydratedWith(hydrateSpy).form_data.slice_id).toBe(SLICE_ID),
  );
});

test('somebody else’s change is not put in front of them', async () => {
  fetchMock.get(OPEN_CHANGE, openChange({ is_author: false }));

  mount();

  await waitFor(() => expect(hydrateSpy).toHaveBeenCalled());
  await waitFor(() =>
    expect(hydratedWith(hydrateSpy).form_data.row_limit).toBe(1000),
  );
  expect(hydratedWith(hydrateSpy).openedOnProposal).toBe(false);
});

test('a change that has been decided is not reopened', async () => {
  fetchMock.get(OPEN_CHANGE, openChange({ is_open: false, status: 'approved' }));

  mount();

  await waitFor(() => expect(hydrateSpy).toHaveBeenCalled());
  await waitFor(() =>
    expect(hydratedWith(hydrateSpy).form_data.row_limit).toBe(1000),
  );
});

test('a lookup that fails leaves the chart exactly as it was', async () => {
  // This runs on the load path of every chart page. Review may be off, the
  // route may be absent, the request may simply fail. None of those is a
  // reason to refuse someone their chart.
  fetchMock.get(OPEN_CHANGE, 500);

  mount();

  await waitFor(() => expect(hydrateSpy).toHaveBeenCalled());
  await waitFor(() =>
    expect(hydratedWith(hydrateSpy).form_data.row_limit).toBe(1000),
  );
  expect(hydratedWith(hydrateSpy).openedOnProposal).toBe(false);
});

test('a change carrying nothing drawable is left alone', async () => {
  // A rename through the properties modal proposes `slice_name` and no
  // params. There is nothing to open on, and the live chart is correct.
  fetchMock.get(
    OPEN_CHANGE,
    openChange({ proposed: {}, changed_fields: ['slice_name'] }),
  );

  mount();

  await waitFor(() => expect(hydrateSpy).toHaveBeenCalled());
  await waitFor(() =>
    expect(hydratedWith(hydrateSpy).form_data.row_limit).toBe(1000),
  );
  expect(hydratedWith(hydrateSpy).openedOnProposal).toBe(false);
});

test('with review off, nothing is asked and nothing is delayed', async () => {
  // The lookup is one request in front of every chart page. On a
  // deployment without review there is no draft it could find, so it is
  // not made at all and the page hydrates exactly as it did before.
  window.featureFlags = {};
  fetchMock.get(OPEN_CHANGE, openChange());

  mount();

  await waitFor(() => expect(hydrateSpy).toHaveBeenCalled());
  expect(fetchMock.callHistory.calls(OPEN_CHANGE)).toHaveLength(0);
  expect(hydratedWith(hydrateSpy).form_data.row_limit).toBe(1000);
});
