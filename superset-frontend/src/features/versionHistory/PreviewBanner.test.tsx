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
  createStore,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import type { VersionHistoryState } from './types';
import type { VersionHistoryRootState } from './reducer';
import PreviewBanner from './PreviewBanner';

// the test-helper store is untyped; recover the slice type for assertions
const versionHistoryOf = (store: { getState: () => unknown }) =>
  (store.getState() as VersionHistoryRootState).versionHistory;

const versionHistoryState = (
  overrides: Partial<VersionHistoryState> = {},
): VersionHistoryState => ({
  isPanelOpen: true,
  entityType: 'chart',
  include: 'all',
  preview: {
    entityUuid: 'entity-uuid',
    versionUuid: 'version-uuid',
    transactionId: 7,
    headline: 'Dec 5, 2025, 12:18 PM',
    issuedAt: '2025-12-05T17:18:00',
  },
  sessionLog: [],
  restoreCount: 0,
  ...overrides,
});

const renderBanner = (
  entityType: 'chart' | 'dashboard' = 'chart',
  state: VersionHistoryState = versionHistoryState(),
) => {
  const store = createStore({ versionHistory: state }, reducerIndex);
  render(<PreviewBanner entityType={entityType} />, { store });
  return store;
};

const RESTORE_ENDPOINT =
  'glob:*/api/v1/chart/entity-uuid/versions/version-uuid/restore';

test('shows the preview headline and date while a preview is active', () => {
  renderBanner();
  expect(screen.getByTestId('version-preview-banner')).toHaveTextContent(
    'Previewing historical version · Dec 5, 2025, 12:18 PM · Dec 5, 2025, 12:18 PM',
  );
  expect(
    screen.getByRole('button', { name: 'Restore this version' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Open as new chart' }),
  ).toBeInTheDocument();
});

test('renders nothing when the preview belongs to another entity type', () => {
  renderBanner('dashboard');
  expect(
    screen.queryByTestId('version-preview-banner'),
  ).not.toBeInTheDocument();
});

test('renders nothing when no preview is active', () => {
  renderBanner('chart', versionHistoryState({ preview: null }));
  expect(
    screen.queryByTestId('version-preview-banner'),
  ).not.toBeInTheDocument();
});

test('close preview clears the preview from the store', async () => {
  const store = renderBanner();
  await userEvent.click(screen.getByRole('button', { name: 'Close preview' }));
  expect(versionHistoryOf(store).preview).toBeNull();
  expect(
    screen.queryByTestId('version-preview-banner'),
  ).not.toBeInTheDocument();
});

test('restoring from the banner confirms, posts, and exits the preview', async () => {
  fetchMock.post(
    RESTORE_ENDPOINT,
    { result: { version_uuid: 'version-uuid' } },
    { name: 'post-restore' },
  );
  const store = renderBanner();

  await userEvent.click(
    screen.getByRole('button', { name: 'Restore this version' }),
  );
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Restore this version?')).toBeInTheDocument();
  expect(within(dialog).getByText('Dec 5, 2025, 12:18 PM')).toBeInTheDocument();

  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Restore this version' }),
  );

  await waitFor(() =>
    expect(fetchMock.callHistory.calls('post-restore')).toHaveLength(1),
  );
  await waitFor(() => {
    expect(versionHistoryOf(store).restoreCount).toBe(1);
    expect(versionHistoryOf(store).preview).toBeNull();
  });
  expect(
    screen.queryByTestId('version-preview-banner'),
  ).not.toBeInTheDocument();

  fetchMock.removeRoute('post-restore');
});

test('a failed restore keeps the preview active', async () => {
  fetchMock.post(RESTORE_ENDPOINT, 500, { name: 'post-restore-fail' });
  const store = renderBanner();

  await userEvent.click(
    screen.getByRole('button', { name: 'Restore this version' }),
  );
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Restore this version' }),
  );

  await waitFor(() =>
    expect(fetchMock.callHistory.calls('post-restore-fail')).toHaveLength(1),
  );
  await waitFor(() => expect(versionHistoryOf(store).restoreCount).toBe(0));
  expect(versionHistoryOf(store).preview).not.toBeNull();

  fetchMock.removeRoute('post-restore-fail');
});
