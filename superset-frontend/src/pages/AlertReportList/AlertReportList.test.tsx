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
import type React from 'react';
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  createStore,
} from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import AlertListComponent from 'src/pages/AlertReportList';

jest.setTimeout(30000);

const AlertList = AlertListComponent as unknown as React.FC<
  Record<string, any>
>;

// -- Mock data (IDs start at 1 to avoid the `if (data?.id)` falsy guard) --

const mockAlerts = [
  {
    id: 1,
    name: 'Weekly Sales Alert',
    active: true,
    last_state: 'Success',
    type: 'Alert',
    owners: [{ id: 1, first_name: 'Admin', last_name: 'User' }],
    recipients: [{ id: 1, type: 'Email' }],
    changed_by: { id: 1, first_name: 'Admin', last_name: 'User' },
    changed_on_delta_humanized: '1 day ago',
    created_by: { id: 1, first_name: 'Admin', last_name: 'User' },
    created_on: new Date().toISOString(),
    last_eval_dttm: Date.now(),
    crontab: '0 9 * * 1',
    crontab_humanized: 'Every Monday at 09:00',
    timezone: 'UTC',
  },
  {
    id: 2,
    name: 'Daily Error Alert',
    active: true,
    last_state: 'Error',
    type: 'Alert',
    owners: [{ id: 2, first_name: 'Data', last_name: 'Analyst' }],
    recipients: [{ id: 2, type: 'Slack' }],
    changed_by: { id: 2, first_name: 'Data', last_name: 'Analyst' },
    changed_on_delta_humanized: '2 days ago',
    created_by: { id: 2, first_name: 'Data', last_name: 'Analyst' },
    created_on: new Date().toISOString(),
    last_eval_dttm: Date.now(),
    crontab: '0 8 * * *',
    crontab_humanized: 'Every day at 08:00',
    timezone: 'US/Pacific',
  },
  {
    id: 3,
    name: 'Monthly Revenue Alert',
    active: false,
    last_state: 'Working',
    type: 'Alert',
    owners: [{ id: 1, first_name: 'Admin', last_name: 'User' }],
    recipients: [{ id: 3, type: 'Email' }],
    changed_by: { id: 1, first_name: 'Admin', last_name: 'User' },
    changed_on_delta_humanized: '5 days ago',
    created_by: { id: 1, first_name: 'Admin', last_name: 'User' },
    created_on: new Date().toISOString(),
    last_eval_dttm: Date.now(),
    crontab: '0 0 1 * *',
    crontab_humanized: 'First day of the month',
    timezone: 'UTC',
  },
];

const mockReports = [
  {
    id: 10,
    name: 'Weekly Dashboard Report',
    active: true,
    last_state: 'Success',
    type: 'Report',
    owners: [{ id: 1, first_name: 'Admin', last_name: 'User' }],
    recipients: [{ id: 10, type: 'Email' }],
    changed_by: { id: 1, first_name: 'Admin', last_name: 'User' },
    changed_on_delta_humanized: '1 day ago',
    created_by: { id: 1, first_name: 'Admin', last_name: 'User' },
    created_on: new Date().toISOString(),
    last_eval_dttm: Date.now(),
    crontab: '0 9 * * 1',
    crontab_humanized: 'Every Monday at 09:00',
    timezone: 'UTC',
  },
  {
    id: 11,
    name: 'Monthly KPI Report',
    active: false,
    last_state: 'Not triggered',
    type: 'Report',
    owners: [{ id: 1, first_name: 'Admin', last_name: 'User' }],
    recipients: [{ id: 11, type: 'Slack' }],
    changed_by: { id: 1, first_name: 'Admin', last_name: 'User' },
    changed_on_delta_humanized: '3 days ago',
    created_by: { id: 1, first_name: 'Admin', last_name: 'User' },
    created_on: new Date().toISOString(),
    last_eval_dttm: Date.now(),
    crontab: '0 0 1 * *',
    crontab_humanized: 'First day of the month',
    timezone: 'UTC',
  },
];

const mockUser = {
  userId: 1,
  firstName: 'Admin',
  lastName: 'User',
};

// -- API endpoints (named for cleanup) --

const ENDPOINTS = {
  LIST: 'glob:*/api/v1/report/?*',
  INFO: 'glob:*/api/v1/report/_info*',
  SINGLE: 'glob:*/api/v1/report/*',
  CREATED_BY: 'glob:*/api/v1/report/related/created_by*',
  OWNERS: 'glob:*/api/v1/report/related/owners*',
  CHANGED_BY: 'glob:*/api/v1/report/related/changed_by*',
};

// -- Render helper --

const renderAlertList = (props: Record<string, any> = {}) => {
  const store = createStore();
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <QueryParamProvider adapter={ReactRouter5Adapter}>
          <AlertList user={mockUser} {...props} />
        </QueryParamProvider>
      </MemoryRouter>
    </Provider>,
  );
};

// -- Dynamic list endpoint: returns alerts or reports based on URL filter --

const setupMocks = (
  permissions: string[] = ['can_read', 'can_write'],
  listData?: typeof mockAlerts,
) => {
  fetchMock.get(ENDPOINTS.INFO, { permissions }, { name: 'info' });

  fetchMock.get(
    ENDPOINTS.LIST,
    ({ url }: any) => {
      if (listData) {
        return {
          result: listData,
          count: listData.length,
          ids: listData.map(a => a.id),
        };
      }
      const data = url.includes('value:Report') ? mockReports : mockAlerts;
      return { result: data, count: data.length, ids: data.map(a => a.id) };
    },
    { name: 'list' },
  );

  fetchMock.get(ENDPOINTS.CREATED_BY, { result: [] }, { name: 'created-by' });

  fetchMock.get(ENDPOINTS.OWNERS, { result: [], count: 0 }, { name: 'owners' });

  fetchMock.get(
    ENDPOINTS.CHANGED_BY,
    { result: [], count: 0 },
    { name: 'changed-by' },
  );

  fetchMock.put(
    ENDPOINTS.SINGLE,
    { result: { ...mockAlerts[0], active: false } },
    { name: 'put-alert' },
  );

  fetchMock.delete(ENDPOINTS.SINGLE, {}, { name: 'delete-alert' });

  fetchMock.delete(
    ENDPOINTS.LIST,
    { message: 'Deleted' },
    { name: 'delete-bulk' },
  );
};

// -- Setup / teardown --

beforeEach(() => {
  fetchMock.removeRoutes().clearHistory();
  setupMocks();
});

afterEach(() => {
  fetchMock.removeRoutes().clearHistory();
});

// -- Tests --

test('loads rows from API and renders alert names, status, and actions', async () => {
  renderAlertList();

  // All 3 alert names appear
  await screen.findByText('Weekly Sales Alert');
  expect(screen.getByText('Daily Error Alert')).toBeInTheDocument();
  expect(screen.getByText('Monthly Revenue Alert')).toBeInTheDocument();

  // Active switches rendered for each row
  const switches = screen.getAllByRole('switch');
  expect(switches).toHaveLength(3);

  // Delete actions present for owned alerts (userId=1 owns alerts 1 and 3)
  const deleteButtons = screen.getAllByTestId('delete-action');
  expect(deleteButtons.length).toBeGreaterThanOrEqual(2);

  // Column headers
  expect(screen.getByTitle('Last run')).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: /name/i }),
  ).toBeInTheDocument();
  expect(screen.getByTitle('Schedule')).toBeInTheDocument();
  expect(screen.getByTitle('Active')).toBeInTheDocument();
  expect(screen.getByTitle('Actions')).toBeInTheDocument();

  // API was called with Alert filter
  const listCalls = fetchMock.callHistory.calls('list');
  expect(listCalls.length).toBeGreaterThanOrEqual(1);
  expect(listCalls[0].url).toContain('value:Alert');
});

test('toggle active sends PUT and updates switch state', async () => {
  renderAlertList();
  await screen.findByText('Weekly Sales Alert');

  const switches = screen.getAllByRole('switch');
  // First switch is for alert id=1 (owned by user, active: true)
  expect(switches[0]).toBeChecked();

  fireEvent.click(switches[0]);

  // PUT called with active=false
  await waitFor(() => {
    const putCalls = fetchMock.callHistory.calls('put-alert');
    expect(putCalls).toHaveLength(1);
  });

  const putCalls = fetchMock.callHistory.calls('put-alert');
  const body = JSON.parse(putCalls[0].options.body as string);
  expect(body.active).toBe(false);
  expect(putCalls[0].url).toContain('/report/1');
});

test('toggle active rolls back on failed update', async () => {
  renderAlertList();
  await screen.findByText('Weekly Sales Alert');

  // Replace PUT with 500 error
  fetchMock.removeRoute('put-alert');
  fetchMock.put(ENDPOINTS.SINGLE, 500, { name: 'put-fail' });

  const switches = screen.getAllByRole('switch');
  expect(switches[0]).toBeChecked();

  fireEvent.click(switches[0]);

  // PUT was attempted
  await waitFor(() => {
    expect(fetchMock.callHistory.calls('put-fail')).toHaveLength(1);
  });

  // Switch rolls back to checked (server rejected)
  await waitFor(() => {
    expect(switches[0]).toBeChecked();
  });
});

test('switching to Reports refetches and renders only report rows', async () => {
  // Render alerts mode first
  const { unmount } = renderAlertList();
  await screen.findByText('Weekly Sales Alert');
  unmount();

  // Render reports mode
  fetchMock.clearHistory();
  renderAlertList({ isReportEnabled: true });

  await screen.findByText('Weekly Dashboard Report');
  expect(screen.getByText('Monthly KPI Report')).toBeInTheDocument();

  // Alert names should not appear
  expect(screen.queryByText('Weekly Sales Alert')).not.toBeInTheDocument();
  expect(screen.queryByText('Daily Error Alert')).not.toBeInTheDocument();

  // API called with Report filter
  const listCalls = fetchMock.callHistory.calls('list');
  expect(listCalls.length).toBeGreaterThanOrEqual(1);
  const reportCall = listCalls.find((c: any) => c.url.includes('value:Report'));
  expect(reportCall).toBeDefined();
});

test('delete removes row after confirmation', async () => {
  // Track deletions so the GET mock reflects them on refetch
  const deletedIds = new Set<number>();
  fetchMock.removeRoute('list');
  fetchMock.get(
    ENDPOINTS.LIST,
    (_callLog: any) => {
      const remaining = mockAlerts.filter(a => !deletedIds.has(a.id));
      return {
        result: remaining,
        count: remaining.length,
        ids: remaining.map(a => a.id),
      };
    },
    { name: 'list' },
  );

  // Override DELETE to mark the alert as deleted before returning
  fetchMock.removeRoute('delete-alert');
  fetchMock.delete(
    ENDPOINTS.SINGLE,
    ({ url }: any) => {
      const match = url.match(/\/report\/(\d+)/);
      if (match) deletedIds.add(Number(match[1]));
      return {};
    },
    { name: 'delete-alert' },
  );

  renderAlertList();
  await screen.findByText('Weekly Sales Alert');

  // Click delete on first owned alert
  const deleteButtons = screen.getAllByTestId('delete-action');
  fireEvent.click(deleteButtons[0]);

  // Confirm in delete modal
  const deleteInput = await screen.findByTestId('delete-modal-input');
  fireEvent.change(deleteInput, { target: { value: 'DELETE' } });
  const confirmButton = await screen.findByTestId('modal-confirm-button');
  fireEvent.click(confirmButton);

  // Row disappears after refetch
  await waitFor(() => {
    expect(screen.queryByText('Weekly Sales Alert')).not.toBeInTheDocument();
  });

  // Other alerts remain
  expect(screen.getByText('Daily Error Alert')).toBeInTheDocument();
});

test('delete failure leaves row visible', async () => {
  // Replace DELETE with 500
  fetchMock.removeRoute('delete-alert');
  fetchMock.delete(ENDPOINTS.SINGLE, 500, { name: 'delete-fail' });

  renderAlertList();
  await screen.findByText('Weekly Sales Alert');

  const deleteButtons = screen.getAllByTestId('delete-action');
  fireEvent.click(deleteButtons[0]);

  const deleteInput = await screen.findByTestId('delete-modal-input');
  fireEvent.change(deleteInput, { target: { value: 'DELETE' } });
  const confirmButton = await screen.findByTestId('modal-confirm-button');
  fireEvent.click(confirmButton);

  await waitFor(() => {
    expect(fetchMock.callHistory.calls('delete-fail')).toHaveLength(1);
  });

  // Row stays visible
  expect(screen.getByText('Weekly Sales Alert')).toBeInTheDocument();
});

test('bulk select shows selected count and enables bulk actions after row selection', async () => {
  renderAlertList();
  await screen.findByText('Weekly Sales Alert');

  // Bulk select controls not visible initially
  expect(screen.queryByTestId('bulk-select-controls')).not.toBeInTheDocument();

  // Toggle bulk select
  const bulkSelectButton = screen.getByTestId('bulk-select-toggle');
  fireEvent.click(bulkSelectButton);

  // Controls appear with "0 Selected" text
  await screen.findByTestId('bulk-select-controls');
  expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
    '0 Selected',
  );

  // Deselect-all and action button not yet visible (nothing selected)
  expect(
    screen.queryByTestId('bulk-select-deselect-all'),
  ).not.toBeInTheDocument();

  // Select all rows via checkboxes that appear in bulk mode
  const checkboxes = screen.getAllByRole('checkbox');
  // First checkbox is the header "select all" toggle
  fireEvent.click(checkboxes[0]);

  // Bulk action button and deselect-all appear after selection
  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-action')).toBeInTheDocument();
  });
  expect(screen.getByTestId('bulk-select-deselect-all')).toBeInTheDocument();
  expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
    '3 Selected',
  );
});

test('read-only users do not see delete and bulk select controls', async () => {
  fetchMock.removeRoutes().clearHistory();
  setupMocks(['can_read']); // no can_write

  const readOnlyUser = {
    userId: 99,
    firstName: 'Read',
    lastName: 'Only',
  };

  const store = createStore();

  render(
    <Provider store={store}>
      <MemoryRouter>
        <QueryParamProvider adapter={ReactRouter5Adapter}>
          <AlertList user={readOnlyUser} />
        </QueryParamProvider>
      </MemoryRouter>
    </Provider>,
  );

  await screen.findByText('Weekly Sales Alert');

  // No delete action buttons
  expect(screen.queryAllByTestId('delete-action')).toHaveLength(0);

  // No bulk select toggle
  expect(screen.queryByTestId('bulk-select-toggle')).not.toBeInTheDocument();

  // Switches are all disabled (user 99 doesn't own any alerts)
  const switches = screen.getAllByRole('switch');
  switches.forEach(sw => {
    expect(sw).toBeDisabled();
  });
});

test('empty API result shows empty state', async () => {
  fetchMock.removeRoutes().clearHistory();
  setupMocks(['can_read', 'can_write'], []);

  renderAlertList();

  expect(await screen.findByText(/no alerts yet/i)).toBeInTheDocument();
});
