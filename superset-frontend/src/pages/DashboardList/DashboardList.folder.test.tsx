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
import userEvent from '@testing-library/user-event';
import { isFeatureEnabled } from '@superset-ui/core';
import { mockUserSubjectsBootstrapData } from 'spec/helpers/mockBootstrapData';
import {
  renderDashboardList,
  setupMocks,
  API_ENDPOINTS,
  mockAdminUser,
  getLatestDashboardApiCall,
} from 'src/pages/DashboardList/DashboardList.testHelpers';
import { screen, selectOption, waitFor } from 'spec/helpers/testing-library';

jest.setTimeout(30000);

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('src/utils/export', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('src/utils/getBootstrapData', () =>
  mockUserSubjectsBootstrapData([1]),
);

const mockIsFeatureEnabled = isFeatureEnabled as jest.MockedFunction<
  typeof isFeatureEnabled
>;

const folder = {
  id: 'finance',
  name: 'Finance',
  parent_id: null,
  dashboard_count: 1,
  can_create: true,
  can_rename: true,
  can_delete: true,
  can_move_dashboard: true,
};

const folderAdmin = {
  ...mockAdminUser,
  roles: {
    Admin: [
      ...mockAdminUser.roles.Admin,
      ['can_create', 'DashboardFolder'],
      ['can_move_dashboard', 'DashboardFolder'],
    ],
  },
};

function mockFolderList() {
  fetchMock.removeRoutes({
    names: [API_ENDPOINTS.DASHBOARD_FOLDERS, API_ENDPOINTS.CATCH_ALL],
  });
  fetchMock.get(
    API_ENDPOINTS.DASHBOARD_FOLDERS,
    { result: [folder], count: 1 },
    { name: API_ENDPOINTS.DASHBOARD_FOLDERS },
  );
  fetchMock.get(
    API_ENDPOINTS.CATCH_ALL,
    (callLog: any) => {
      const requestUrl =
        typeof callLog === 'string' ? callLog : callLog?.url || callLog;
      throw new Error(`[fetchMock catch-all] Unmatched GET: ${requestUrl}`);
    },
    { name: API_ENDPOINTS.CATCH_ALL },
  );
}

beforeEach(() => {
  setupMocks();
  mockFolderList();
  mockIsFeatureEnabled.mockReturnValue(false);
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  mockIsFeatureEnabled.mockReset();
});

test('synchronizes folder tree selection with the list filter', async () => {
  renderDashboardList(folderAdmin);

  await userEvent.click(await screen.findByText('Finance'));

  await waitFor(() => {
    const query = getLatestDashboardApiCall()?.query;
    expect(query?.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 'folder_id', value: 'finance' }),
      ]),
    );
  });
});

test('completes folder creation, rename, and deletion from the list', async () => {
  fetchMock.post('glob:*/api/v1/dashboard_folder/', { id: 'new-folder' });
  fetchMock.put('glob:*/api/v1/dashboard_folder/finance', { id: 'finance' });
  fetchMock.delete('glob:*/api/v1/dashboard_folder/finance', {
    message: 'ok',
  });
  renderDashboardList(folderAdmin);

  await screen.findByText('Finance');
  await userEvent.click(screen.getByLabelText('Create dashboard folder'));
  await userEvent.type(screen.getByLabelText('Folder name'), ' Forecasts ');
  await selectOption('Finance', 'Parent folder');
  await userEvent.click(screen.getByRole('button', { name: 'Create' }));
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls(/dashboard_folder\/$/, { method: 'POST' }),
    ).toHaveLength(1),
  );

  await userEvent.click(screen.getByLabelText('Rename folder'));
  const nameInput = screen.getByLabelText('Folder name');
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, 'Planning');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls(/dashboard_folder\/finance$/, {
        method: 'PUT',
      }),
    ).toHaveLength(1),
  );

  await userEvent.click(screen.getByText('Finance'));
  await userEvent.click(screen.getByLabelText('Delete folder'));
  await userEvent.type(screen.getByTestId('delete-modal-input'), 'DELETE');
  await userEvent.click(screen.getByTestId('modal-confirm-button'));
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls(/dashboard_folder\/finance$/, {
        method: 'DELETE',
      }),
    ).toHaveLength(1),
  );
});
