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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import AlertList from 'src/pages/AlertReportList';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const alertsEndpoint = 'glob:*/api/v1/report/?*';
const alertEndpoint = 'glob:*/api/v1/report/*';
const alertsInfoEndpoint = 'glob:*/api/v1/report/_info*';
const alertsCreatedByEndpoint = 'glob:*/api/v1/report/related/created_by*';

const mockalerts = [...new Array(3)].map((_, i) => ({
  active: true,
  changed_by: {
    first_name: `user ${i}`,
    id: i,
  },
  changed_on_delta_humanized: `${i} day(s) ago`,
  created_by: {
    first_name: `user ${i}`,
    id: i,
  },
  created_on: new Date().toISOString,
  id: i,
  last_eval_dttm: Date.now(),
  last_state: 'ok',
  name: `alert ${i}  `,
  owners: [{ id: 1 }],
  recipients: [
    {
      id: `${i}`,
      type: 'email',
    },
  ],
  type: 'alert',
}));

const mockUser = {
  userId: 1,
  firstName: 'user 1',
  lastName: 'lastname',
};

fetchMock.get(alertsEndpoint, {
  ids: [2, 0, 1],
  result: mockalerts,
  count: 3,
});
fetchMock.get(alertsInfoEndpoint, {
  permissions: ['can_write'],
});
fetchMock.get(alertsCreatedByEndpoint, { result: [] });
fetchMock.put(alertEndpoint, { ...mockalerts[0], active: false });
fetchMock.put(alertsEndpoint, { ...mockalerts[0], active: false });
fetchMock.delete(alertEndpoint, {});
fetchMock.delete(alertsEndpoint, {});

const renderAlertList = (props = {}) =>
  render(
    <MemoryRouter>
      <QueryParamProvider>
        <AlertList user={mockUser} {...props} />
      </QueryParamProvider>
    </MemoryRouter>,
    {
      useRedux: true,
      store,
    },
  );

describe('AlertList', () => {
  beforeEach(() => {
    fetchMock.resetHistory();
  });

  it('renders', async () => {
    renderAlertList();
    expect(await screen.findByText('Alerts & reports')).toBeInTheDocument();
  });

  it('renders a SubMenu', async () => {
    renderAlertList();
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
  });

  it('renders a ListView', async () => {
    renderAlertList();
    expect(await screen.findByTestId('alerts-list-view')).toBeInTheDocument();
  });

  it('renders switches', async () => {
    renderAlertList();
    // Wait for the list to load first
    await screen.findByTestId('alerts-list-view');
    const switches = await screen.findAllByRole('switch');
    expect(switches).toHaveLength(3);
  });

  it('deletes', async () => {
    renderAlertList();

    // Wait for list to load
    await screen.findByTestId('alerts-list-view');

    // Find and click first delete button
    const deleteButtons = await screen.findAllByTestId('delete-action');
    fireEvent.click(deleteButtons[0]);

    // Wait for modal to appear and find the delete input
    const deleteInput = await screen.findByTestId('delete-modal-input');
    fireEvent.change(deleteInput, { target: { value: 'DELETE' } });

    // Click confirm button
    const confirmButton = await screen.findByTestId('modal-confirm-button');
    fireEvent.click(confirmButton);

    // Wait for delete request
    await waitFor(() => {
      expect(fetchMock.calls(/report\/0/, 'DELETE')).toHaveLength(1);
    });
  }, 15000);

  it('shows/hides bulk actions when bulk actions is clicked', async () => {
    renderAlertList();

    // Wait for list to load and initial state
    await screen.findByTestId('alerts-list-view');
    expect(
      screen.queryByTestId('bulk-select-controls'),
    ).not.toBeInTheDocument();

    // Click bulk select toggle
    const bulkSelectButton = await screen.findByTestId('bulk-select-toggle');
    fireEvent.click(bulkSelectButton);

    // Verify bulk select controls appear
    expect(
      await screen.findByTestId('bulk-select-controls'),
    ).toBeInTheDocument();
  }, 15000);

  it('hides bulk actions when switch between alert and report list', async () => {
    // Start with alert list
    renderAlertList();

    // Wait for list to load
    await screen.findByTestId('alerts-list-view');

    // Click bulk select to show controls
    const bulkSelectButton = await screen.findByTestId('bulk-select-toggle');
    fireEvent.click(bulkSelectButton);

    // Verify bulk select controls appear
    expect(
      await screen.findByTestId('bulk-select-controls'),
    ).toBeInTheDocument();

    // Verify alert tab is active
    const alertTab = await screen.findByTestId('alert-list');
    expect(alertTab).toHaveClass('active');
    const reportTab = screen.getByTestId('report-list');
    expect(reportTab).not.toHaveClass('active');

    // Switch to report list
    renderAlertList({ isReportEnabled: true });

    // Wait for report list API call and tab states to update
    await waitFor(async () => {
      // Check API call
      const calls = fetchMock.calls(/report\/\?q/);
      const hasReportCall = calls.some(call =>
        call[0].includes('filters:!((col:type,opr:eq,value:Report))'),
      );

      // Check tab states
      const reportTabs = screen.getAllByTestId('report-list');
      const alertTabs = screen.getAllByTestId('alert-list');
      const hasActiveReport = reportTabs.some(tab =>
        tab.classList.contains('active'),
      );
      const hasNoActiveAlert = alertTabs.every(
        tab => !tab.classList.contains('active'),
      );

      return hasReportCall && hasActiveReport && hasNoActiveAlert;
    });

    // Click bulk select toggle again to hide controls
    const bulkSelectButtons =
      await screen.findAllByTestId('bulk-select-toggle');
    fireEvent.click(bulkSelectButtons[0]);

    // Verify final state
    await waitFor(() => {
      expect(
        screen.queryByTestId('bulk-select-controls'),
      ).not.toBeInTheDocument();
    });

    // Verify correct API call was made
    const reportCalls = fetchMock.calls(/report\/\?q/);
    const lastReportCall = reportCalls[reportCalls.length - 1][0];
    expect(lastReportCall).toContain(
      'filters:!((col:type,opr:eq,value:Report))',
    );
  }, 15000);
});
