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
// Imported first so the antd mock is defined before anything requires 'antd'.
import { mockAntdWithDesktopBreakpoint } from 'spec/helpers/mobileTestUtils';
import fetchMock from 'fetch-mock';
import { SupersetClient } from '@superset-ui/core';
import {
  act,
  createStore,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import Welcome from 'src/pages/Home';
import { LocalStorageKeys, setItem } from 'src/utils/localStorageHelpers';

const chartsEndpoint = 'glob:*/api/v1/chart/?*';
const dashboardsEndpoint = 'glob:*/api/v1/dashboard/?*';
const savedQueryEndpoint = 'glob:*/api/v1/saved_query/?*';
const recentActivityEndpoint = 'glob:*/api/v1/log/recent_activity/*';

jest.mock('antd', () => mockAntdWithDesktopBreakpoint());

// The delete flow lives in the tables; Home only receives `onActivityRefresh`.
// Stub the tables with a button that simulates a completed delete.
jest.mock('src/features/home/DashboardTable', () => ({
  __esModule: true,
  default: ({
    onActivityRefresh,
    mine,
  }: {
    onActivityRefresh?: () => void;
    mine?: { id: number; dashboard_title: string }[];
  }) => (
    <>
      <button type="button" onClick={onActivityRefresh}>
        simulate delete
      </button>
      {mine?.map(d => (
        <span key={d.id}>{`mine: ${d.dashboard_title}`}</span>
      ))}
    </>
  ),
}));
jest.mock('src/features/home/ChartTable', () => ({
  __esModule: true,
  default: () => <div />,
}));

const user = {
  username: 'alpha',
  firstName: 'alpha',
  lastName: 'alpha',
  createdOn: '2016-11-11T12:34:17',
  userId: 5,
  email: 'alpha@alpha.com',
  isActive: true,
  isAnonymous: false,
  permissions: {},
  roles: { sql_lab: [['can_read', 'SavedQuery']] },
};

const recentItem = (title: string, id: number) => ({
  action: 'dashboard',
  item_title: title,
  item_type: 'dashboard',
  item_url: `/superset/dashboard/${id}/`,
  time: 1741644942130 + id,
  time_delta_humanized: 'a day ago',
});

const editedDashboard = (title: string, id: number) => ({
  id,
  dashboard_title: title,
  url: `/superset/dashboard/${id}/`,
  changed_on_delta_humanized: 'a day ago',
});

type Deferred = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

// Returns a response promise that the test settles by hand, so requests can
// resolve (or fail) out of order.
const deferResponse = (pending: Deferred[]) =>
  new Promise<unknown>((resolve, reject) => {
    pending.push({ resolve, reject });
  });

// Waits for the requests a just-settled response kicked off (the chained
// chart/dashboard fetches) and for the resulting React updates to finish.
const drainPendingWork = async () => {
  await act(async () => {
    await fetchMock.callHistory.flush(true);
  });
  await act(async () => {
    await fetchMock.callHistory.flush(true);
  });
};

let recentResponder: () => unknown;
let editableDashboardsResponder: () => unknown;
let editedDashboards: ReturnType<typeof editedDashboard>[] = [];

beforeAll(() => {
  SupersetClient.configure().init();
});

beforeEach(() => {
  localStorage.clear();
  // Start with the Recents and Dashboards panels expanded.
  setItem(LocalStorageKeys.HomepageCollapseState, ['recents', 'dashboards']);
  fetchMock.get(chartsEndpoint, { result: [] });
  editedDashboards = [];
  editableDashboardsResponder = () => ({ result: [] });
  fetchMock.get(dashboardsEndpoint, ({ url }) => {
    if (url.includes('is_editable')) {
      return editableDashboardsResponder();
    }
    return url.includes('changed_by')
      ? { result: editedDashboards }
      : { result: [] };
  });
  fetchMock.get(savedQueryEndpoint, { result: [] });
  fetchMock.get(recentActivityEndpoint, () => recentResponder());
});

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

const renderHome = async () => {
  const store = createStore({}, reducerIndex);
  render(<Welcome user={user} />, { store, useRouter: true });
  const deleteButton = await screen.findByRole('button', {
    name: 'simulate delete',
  });
  return { deleteButton, store };
};

test('delete refetches recents without resetting the selected tab', async () => {
  recentResponder = () => ({ result: [recentItem('Viewed dash', 1)] });
  const { deleteButton } = await renderHome();
  expect(await screen.findByText('Viewed dash')).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(recentActivityEndpoint)).toHaveLength(1);
  const dashboardCallsBefore =
    fetchMock.callHistory.calls(dashboardsEndpoint).length;

  // Switch away from the default (Viewed) tab; a refresh must not undo this.
  await userEvent.click(screen.getByText('Created'));
  await waitFor(() =>
    expect(screen.queryByText('Viewed dash')).not.toBeInTheDocument(),
  );

  // Drop the persisted tab so only the in-memory selection survives; a
  // refresh that re-ran the first-load tab restore would flip back to Viewed.
  localStorage.removeItem(LocalStorageKeys.HomepageActivityFilter);

  recentResponder = () => ({ result: [recentItem('Fresh dash', 2)] });
  await userEvent.click(deleteButton);

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(recentActivityEndpoint)).toHaveLength(2),
  );
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls(dashboardsEndpoint).length,
    ).toBeGreaterThan(dashboardCallsBefore),
  );
  // Still on the Created tab: neither the old nor the refreshed Viewed items
  // are shown, and the collapse panels were not reset.
  expect(screen.queryByText('Viewed dash')).not.toBeInTheDocument();
  expect(screen.queryByText('Fresh dash')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'simulate delete' }),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByText('Viewed'));
  expect(await screen.findByText('Fresh dash')).toBeInTheDocument();
});

test('an older in-flight refresh cannot repopulate a deleted item', async () => {
  recentResponder = () => ({
    result: [recentItem('Doomed dash', 1), recentItem('Kept dash', 2)],
  });
  const { deleteButton } = await renderHome();
  expect(await screen.findByText('Doomed dash')).toBeInTheDocument();

  // Defer the next two recents responses so they can resolve out of order.
  const pending: Deferred[] = [];
  recentResponder = () => deferResponse(pending);

  await userEvent.click(deleteButton);
  await waitFor(() => expect(pending).toHaveLength(1));
  await userEvent.click(deleteButton);
  await waitFor(() => expect(pending).toHaveLength(2));

  // The newer refresh (post-delete data) resolves first...
  pending[1].resolve({ result: [recentItem('Kept dash', 2)] });
  await waitFor(() =>
    expect(screen.queryByText('Doomed dash')).not.toBeInTheDocument(),
  );
  expect(screen.getByText('Kept dash')).toBeInTheDocument();
  await drainPendingWork();

  // ...then the older, stale response arrives and must be discarded. Wait for
  // the chart/dashboard requests it chains, then let React settle.
  const chainedCallsBefore =
    fetchMock.callHistory.calls(chartsEndpoint).length;
  pending[0].resolve({
    result: [recentItem('Doomed dash', 1), recentItem('Kept dash', 2)],
  });
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(chartsEndpoint).length).toBeGreaterThan(
      chainedCallsBefore,
    ),
  );
  await drainPendingWork();
  expect(screen.queryByText('Doomed dash')).not.toBeInTheDocument();
  expect(screen.getByText('Kept dash')).toBeInTheDocument();
});

test('a stale refresh that fails cannot blank current items or toast', async () => {
  recentResponder = () => ({ result: [recentItem('Kept dash', 2)] });
  const { deleteButton, store } = await renderHome();
  expect(await screen.findByText('Kept dash')).toBeInTheDocument();

  const recents: Deferred[] = [];
  const editable: Deferred[] = [];
  recentResponder = () => deferResponse(recents);
  editableDashboardsResponder = () => deferResponse(editable);

  // Refresh A starts, then refresh B supersedes it.
  await userEvent.click(deleteButton);
  await waitFor(() => expect(recents).toHaveLength(1));
  await userEvent.click(deleteButton);
  await waitFor(() => expect(recents).toHaveLength(2));
  await waitFor(() => expect(editable).toHaveLength(2));

  // B succeeds and renders the current items.
  recents[1].resolve({ result: [recentItem('Kept dash', 2)] });
  editable[1].resolve({ result: [editedDashboard('Current dash', 2)] });
  expect(await screen.findByText('mine: Current dash')).toBeInTheDocument();
  await drainPendingWork();

  // A then fails: its guards must keep B's data and suppress the toast.
  recents[0].reject(new Error('stale recents failure'));
  editable[0].reject(new Error('stale editable failure'));
  await drainPendingWork();

  expect(screen.getByText('Kept dash')).toBeInTheDocument();
  expect(screen.getByText('mine: Current dash')).toBeInTheDocument();
  expect(
    (store.getState() as { messageToasts: unknown[] }).messageToasts,
  ).toEqual([]);
});

test('out-of-order editable-object responses keep the newest data', async () => {
  recentResponder = () => ({ result: [recentItem('Viewed dash', 1)] });
  editableDashboardsResponder = () => ({
    result: [editedDashboard('Doomed dash', 1)],
  });
  const { deleteButton } = await renderHome();
  expect(await screen.findByText('mine: Doomed dash')).toBeInTheDocument();

  const editable: Deferred[] = [];
  editableDashboardsResponder = () => deferResponse(editable);

  await userEvent.click(deleteButton);
  await waitFor(() => expect(editable).toHaveLength(1));
  await userEvent.click(deleteButton);
  await waitFor(() => expect(editable).toHaveLength(2));

  // The newer refresh resolves first with post-delete data...
  editable[1].resolve({ result: [editedDashboard('Kept dash', 2)] });
  expect(await screen.findByText('mine: Kept dash')).toBeInTheDocument();
  await drainPendingWork();

  // ...then the older one resolves with pre-delete data and must be dropped.
  editable[0].resolve({ result: [editedDashboard('Doomed dash', 1)] });
  await drainPendingWork();
  expect(screen.queryByText('mine: Doomed dash')).not.toBeInTheDocument();
  expect(screen.getByText('mine: Kept dash')).toBeInTheDocument();
});

test('delete refetches the Edited tab so a removed item disappears', async () => {
  recentResponder = () => ({ result: [recentItem('Viewed dash', 1)] });
  editedDashboards = [
    editedDashboard('Doomed edited dash', 1),
    editedDashboard('Kept edited dash', 2),
  ];
  const { deleteButton } = await renderHome();
  expect(await screen.findByText('Viewed dash')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Edited'));
  expect(await screen.findByText('Doomed edited dash')).toBeInTheDocument();
  expect(screen.getByText('Kept edited dash')).toBeInTheDocument();

  // The deleted dashboard no longer comes back from the edited-objects query.
  editedDashboards = [editedDashboard('Kept edited dash', 2)];
  await userEvent.click(deleteButton);

  await waitFor(() =>
    expect(screen.queryByText('Doomed edited dash')).not.toBeInTheDocument(),
  );
  expect(screen.getByText('Kept edited dash')).toBeInTheDocument();
});

test('delete refresh keeps a collapsed Dashboards panel collapsed', async () => {
  recentResponder = () => ({ result: [recentItem('Viewed dash', 1)] });
  const { deleteButton } = await renderHome();
  expect(await screen.findByText('Viewed dash')).toBeInTheDocument();

  // Collapse Dashboards while keeping Recents open.
  const dashboardsHeader = screen.getByRole('button', { name: /Dashboards/ });
  expect(dashboardsHeader).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(dashboardsHeader);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Dashboards/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    ),
  );

  // Drop the persisted collapse state so only the in-memory selection
  // survives; re-running the first-load restore would fall back to the
  // defaults and re-expand Dashboards.
  localStorage.removeItem(LocalStorageKeys.HomepageCollapseState);

  await userEvent.click(deleteButton);
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(recentActivityEndpoint)).toHaveLength(2),
  );
  await new Promise(resolve => {
    setTimeout(resolve, 50);
  });

  expect(screen.getByRole('button', { name: /Dashboards/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  expect(screen.getByRole('button', { name: /Recents/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  expect(screen.getByText('Viewed dash')).toBeInTheDocument();
});
