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
import fetchMock from 'fetch-mock';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { LEGACY_AGGREGATION_TAG } from 'src/explore/constants';
import { LegacyAggregationAlert } from './LegacyAggregationAlert';

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('renders nothing while tags are loading or when the legacy tag is absent', async () => {
  fetchMock.get('glob:*/api/v1/chart/123', {
    result: { tags: [{ id: 1, name: 'some-other-tag', type: 1 }] },
  });
  render(<LegacyAggregationAlert sliceId={123} />);
  await waitFor(() => expect(fetchMock.callHistory.calls().length).toBe(1));
  expect(
    screen.queryByText(
      'This chart was updated to use the restored aggregation',
    ),
  ).not.toBeInTheDocument();
});

test('renders nothing when sliceId is not yet known (e.g. an unsaved chart)', () => {
  render(<LegacyAggregationAlert sliceId={undefined} />);
  expect(fetchMock.callHistory.calls().length).toBe(0);
});

test('surfaces the legacy-aggregation notice and removes the tag on Accept', async () => {
  fetchMock.get('glob:*/api/v1/chart/123', {
    result: {
      tags: [{ id: 7, name: LEGACY_AGGREGATION_TAG, type: 1 }],
    },
  });
  fetchMock.delete(`glob:*/api/v1/tag/2/123/${LEGACY_AGGREGATION_TAG}`, {});

  render(<LegacyAggregationAlert sliceId={123} />);

  expect(
    await screen.findByText(
      'This chart was updated to use the restored aggregation',
    ),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls(
        `glob:*/api/v1/tag/2/123/${LEGACY_AGGREGATION_TAG}`,
      ).length,
    ).toBe(1),
  );
  await waitFor(() =>
    expect(
      screen.queryByText(
        'This chart was updated to use the restored aggregation',
      ),
    ).not.toBeInTheDocument(),
  );
});
