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
/**
 * @fileoverview One read of review state for a whole dashboard.
 *
 * The tag existed on the chart list and nowhere inside a dashboard, so an
 * editor opening one could not see which cards had a change waiting
 * (QA-21). Asking per card would have turned that into a request per
 * chart, which is why the answer is read once and shared.
 */
import fetchMock from 'fetch-mock';
import { FeatureFlag } from '@superset-ui/core';
import { render, screen } from 'spec/helpers/testing-library';
import ReviewStatusTag, {
  OpenChangesProvider,
  useOpenChangeStatus,
} from './ReviewStatusTag';

const OPEN_ENDPOINT = 'glob:*/api/v1/change_request/open/chart';

const originalFlags = window.featureFlags;

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
  // The provider reads nothing with review switched off, which is the
  // behaviour every other deployment gets.
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };
});

afterAll(() => {
  fetchMock.clearHistory().removeRoutes();
  window.featureFlags = originalFlags;
});

/** Stands in for a chart header inside a dashboard. */
function Header({ id }: { id: number }) {
  const status = useOpenChangeStatus(id);
  return <ReviewStatusTag status={status} assetType="chart" assetId={id} />;
}

const dashboardWith = (ids: number[]) =>
  render(
    <OpenChangesProvider assetType="chart">
      {ids.map(id => (
        <Header key={id} id={id} />
      ))}
    </OpenChangesProvider>,
    { useRedux: true, useRouter: true },
  );

test('a chart with a change waiting is tagged inside the dashboard', async () => {
  fetchMock.get(OPEN_ENDPOINT, { result: { '71': 'draft' } });

  dashboardWith([71]);

  expect(await screen.findByText('Changes pending')).toBeInTheDocument();
});

test('a chart with nothing waiting is not tagged', async () => {
  fetchMock.get(OPEN_ENDPOINT, { result: { '71': 'draft' } });

  dashboardWith([71, 72]);

  await screen.findByText('Changes pending');
  expect(screen.getAllByTestId('review-status-tag')).toHaveLength(1);
});

test('many charts cost one request, not one each', async () => {
  // The whole reason this is a provider rather than a fetch per tag.
  fetchMock.get(OPEN_ENDPOINT, { result: { '71': 'pending' } });

  dashboardWith([71, 72, 73, 74, 75]);

  await screen.findByText('Awaiting review');
  expect(fetchMock.callHistory.calls(OPEN_ENDPOINT)).toHaveLength(1);
});

test('nothing is read when review is switched off', async () => {
  window.featureFlags = { [FeatureFlag.ChangeManagement]: false };
  fetchMock.get(OPEN_ENDPOINT, { result: { '71': 'draft' } });

  dashboardWith([71]);

  expect(screen.queryByTestId('review-status-tag')).not.toBeInTheDocument();
  expect(fetchMock.callHistory.calls(OPEN_ENDPOINT)).toHaveLength(0);
});
