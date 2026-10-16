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
import {
  render,
  screen,
  waitFor,
  createStore,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { SAVE_SLICE_SUCCESS } from 'src/explore/actions/saveModalActions';
import { LEGACY_AGGREGATION_TAG } from 'src/explore/constants';
import reducerIndex from 'spec/helpers/reducerIndex';
import { LegacyAggregationAlert } from './LegacyAggregationAlert';

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('renders nothing while tags are loading or when the legacy tag is absent', async () => {
  fetchMock.get('glob:*/api/v1/chart/123', {
    result: { tags: [{ id: 1, name: 'some-other-tag', type: 1 }] },
  });
  render(<LegacyAggregationAlert sliceId={123} />, { useRedux: true });
  await waitFor(() => expect(fetchMock.callHistory.calls().length).toBe(1));
  expect(
    screen.queryByText(
      'This chart was updated to use the restored aggregation',
    ),
  ).not.toBeInTheDocument();
});

test('renders nothing when sliceId is not yet known (e.g. an unsaved chart)', () => {
  render(<LegacyAggregationAlert sliceId={undefined} />, { useRedux: true });
  expect(fetchMock.callHistory.calls().length).toBe(0);
});

test('surfaces the legacy-aggregation notice and removes the tag on Accept', async () => {
  fetchMock.get('glob:*/api/v1/chart/123', {
    result: {
      tags: [{ id: 7, name: LEGACY_AGGREGATION_TAG, type: 1 }],
    },
  });
  fetchMock.delete(`glob:*/api/v1/tag/2/123/${LEGACY_AGGREGATION_TAG}`, {});

  render(<LegacyAggregationAlert sliceId={123} />, { useRedux: true });

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

test('Accept falls back to the chart tag list when the tag route is forbidden', async () => {
  // A chart owner whose role has `can_write` on Chart but not on Tag: the
  // tag DELETE 403s, so the notice re-saves the chart's custom tag list
  // minus the legacy one (which `validate_tags` accepts via `can_tag`).
  fetchMock.get('glob:*/api/v1/chart/123', {
    result: {
      tags: [
        { id: 3, name: 'keep-me', type: 1 },
        { id: 7, name: LEGACY_AGGREGATION_TAG, type: 1 },
      ],
    },
  });
  fetchMock.delete(`glob:*/api/v1/tag/2/123/${LEGACY_AGGREGATION_TAG}`, {
    status: 403,
    body: { message: 'Forbidden' },
  });
  fetchMock.put('glob:*/api/v1/chart/123', { result: {} });

  render(<LegacyAggregationAlert sliceId={123} />, { useRedux: true });

  expect(
    await screen.findByText(
      'This chart was updated to use the restored aggregation',
    ),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/chart/123', {
        method: 'PUT',
      }),
    ).toHaveLength(1),
  );
  const [putCall] = fetchMock.callHistory.calls('glob:*/api/v1/chart/123', {
    method: 'PUT',
  });
  expect(JSON.parse(putCall.options.body as string)).toEqual({ tags: [3] });
  await waitFor(() =>
    expect(
      screen.queryByText(
        'This chart was updated to use the restored aggregation',
      ),
    ).not.toBeInTheDocument(),
  );
});

test('a delayed tag-removal response does not clear a newer tag after switching charts', async () => {
  // Chart 1's Accept button fires a DELETE that is still in flight when the
  // user switches to chart 2, which has its own (different) legacy tag.
  fetchMock.get('glob:*/api/v1/chart/1', {
    result: { tags: [{ id: 7, name: LEGACY_AGGREGATION_TAG, type: 1 }] },
  });
  fetchMock.get('glob:*/api/v1/chart/2', {
    result: { tags: [{ id: 8, name: LEGACY_AGGREGATION_TAG, type: 1 }] },
  });
  let resolveDelete: () => void = () => {};
  const deleteResponse = new Promise(resolve => {
    resolveDelete = () => resolve({});
  });
  fetchMock.delete(
    `glob:*/api/v1/tag/2/1/${LEGACY_AGGREGATION_TAG}`,
    () => deleteResponse,
  );

  const { rerender } = render(<LegacyAggregationAlert sliceId={1} />, {
    useRedux: true,
  });

  expect(
    await screen.findByText(
      'This chart was updated to use the restored aggregation',
    ),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls(
        `glob:*/api/v1/tag/2/1/${LEGACY_AGGREGATION_TAG}`,
      ).length,
    ).toBe(1),
  );

  rerender(<LegacyAggregationAlert sliceId={2} />);
  expect(
    await screen.findByText(
      'This chart was updated to use the restored aggregation',
    ),
  ).toBeInTheDocument();

  resolveDelete();

  // Chart 2's own tag (id 8) must survive chart 1's stale DELETE response
  // (which only ever targeted tag id 7).
  await waitFor(() =>
    expect(
      screen.getByText(
        'This chart was updated to use the restored aggregation',
      ),
    ).toBeInTheDocument(),
  );
});

test('a late tag response for a previous chart does not show the notice on the current chart', async () => {
  // Tagged chart 1's GET is still pending when the user opens untagged chart
  // 2; chart 1's late response must be ignored rather than surfacing its tag.
  let resolveChart1: (value: unknown) => void = () => {};
  const chart1Response = new Promise(resolve => {
    resolveChart1 = resolve;
  });
  fetchMock.get('glob:*/api/v1/chart/1', () => chart1Response);
  fetchMock.get('glob:*/api/v1/chart/2', { result: { tags: [] } });

  const { rerender } = render(<LegacyAggregationAlert sliceId={1} />, {
    useRedux: true,
  });
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('glob:*/api/v1/chart/1').length).toBe(1),
  );

  rerender(<LegacyAggregationAlert sliceId={2} />);
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('glob:*/api/v1/chart/2').length).toBe(1),
  );

  resolveChart1({
    result: { tags: [{ id: 7, name: LEGACY_AGGREGATION_TAG, type: 1 }] },
  });
  // Let the late response settle before asserting the notice stayed absent.
  await new Promise(resolve => {
    setTimeout(resolve, 50);
  });

  expect(
    screen.queryByText(
      'This chart was updated to use the restored aggregation',
    ),
  ).not.toBeInTheDocument();
});

test('re-fetches and drops the notice after a same-slice save clears the tag server-side', async () => {
  // First fetch (initial mount) still finds the tag; second fetch (after the
  // save) reflects saveModalActions.ts's own server-side deletion on save --
  // this component never calls the delete endpoint itself in this flow.
  fetchMock.getOnce('glob:*/api/v1/chart/123', {
    result: { tags: [{ id: 7, name: LEGACY_AGGREGATION_TAG, type: 1 }] },
  });
  fetchMock.get('glob:*/api/v1/chart/123', { result: { tags: [] } });

  const store = createStore({}, reducerIndex);
  render(<LegacyAggregationAlert sliceId={123} />, { store });

  expect(
    await screen.findByText(
      'This chart was updated to use the restored aggregation',
    ),
  ).toBeInTheDocument();

  store.dispatch({ type: SAVE_SLICE_SUCCESS, data: { id: 123 } });

  await waitFor(() => expect(fetchMock.callHistory.calls().length).toBe(2));
  await waitFor(() =>
    expect(
      screen.queryByText(
        'This chart was updated to use the restored aggregation',
      ),
    ).not.toBeInTheDocument(),
  );
});
