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
import { registerDeferralOracle } from 'src/core/deferredWrites';
import { render, waitFor } from 'spec/helpers/testing-library';
import { getExploreFormData } from 'spec/fixtures/mockExploreFormData';
import { JsonObject, VizType } from '@superset-ui/core';
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

const SLICE_ID = 42;

/** The published chart: the row limit the reviewer's viewers are served. */
const liveFormData = getExploreFormData({
  viz_type: VizType.Table,
  slice_id: SLICE_ID,
  row_limit: 1000,
});

/**
 * The held version, composed. Whoever held the write decides which of its
 * fields replace which of the live chart's -- only they know the shape they
 * stored -- so by the time the host sees it, it is form data and nothing
 * else. What the host owes is to hydrate it rather than the live chart.
 */
const heldFormData = {
  ...liveFormData,
  row_limit: 50,
};

const mount = () =>
  render(<ChartPage />, { useRouter: true, useRedux: true, useDnd: true });

const hydratedWith = (spy: jest.SpyInstance) =>
  spy.mock.calls[spy.mock.calls.length - 1][0];

let hydrateSpy: jest.SpyInstance;
let registration: { dispose(): void } | undefined;

/**
 * Register a holder that answers with `held`, as the extension's own oracle
 * does. `null` is the answer for nothing held -- somebody else's change, a
 * decided one, or a payload that would not compose -- and which of those it
 * was is the holder's business, tested on its side of the contract.
 */
const holding = (held: unknown) => {
  registration = registerDeferralOracle({
    wouldDefer: async () => ({}),
    heldVersion: async () => held,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
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
  registration?.dispose();
  registration = undefined;
  hydrateSpy.mockRestore();
  fetchMock.clearHistory().removeRoutes();
});

test('the held version is hydrated, not the live chart', async () => {
  holding(heldFormData);
  mount();

  await waitFor(() => expect(hydrateSpy).toHaveBeenCalled());
  await waitFor(() =>
    expect(hydratedWith(hydrateSpy).form_data.row_limit).toBe(50),
  );
  expect(hydratedWith(hydrateSpy).openedOnHeldVersion).toBe(true);
});

test('it is still their own chart, not an unsaved copy', async () => {
  holding(heldFormData);
  mount();

  await waitFor(() => expect(hydrateSpy).toHaveBeenCalled());
  await waitFor(() =>
    expect(hydratedWith(hydrateSpy).form_data.slice_id).toBe(SLICE_ID),
  );
});

test('nothing held leaves the chart exactly as it was', async () => {
  // Whether there was no change, somebody else's, one already decided, or a
  // payload that would not compose, the holder answers null and the host
  // opens the published chart.
  holding(null);
  mount();

  await waitFor(() => expect(hydrateSpy).toHaveBeenCalled());
  await waitFor(() =>
    expect(hydratedWith(hydrateSpy).form_data.row_limit).toBe(1000),
  );
  expect(hydratedWith(hydrateSpy).openedOnHeldVersion).toBe(false);
});

test('a holder that throws leaves the chart exactly as it was', async () => {
  registration = registerDeferralOracle({
    wouldDefer: async () => ({}),
    heldVersion: async () => {
      throw new Error('the holder is down');
    },
  });
  mount();

  await waitFor(() => expect(hydrateSpy).toHaveBeenCalled());
  await waitFor(() =>
    expect(hydratedWith(hydrateSpy).form_data.row_limit).toBe(1000),
  );
  expect(hydratedWith(hydrateSpy).openedOnHeldVersion).toBe(false);
});

test('with nothing registered, nothing is asked and nothing is delayed', async () => {
  mount();

  await waitFor(() => expect(hydrateSpy).toHaveBeenCalled());
  expect(hydratedWith(hydrateSpy).form_data.row_limit).toBe(1000);
  expect(hydratedWith(hydrateSpy).openedOnHeldVersion).toBe(false);
});
