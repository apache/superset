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
import {
  act,
  screen,
  selectOption,
  waitFor,
} from 'spec/helpers/testing-library';

const mockMoveActionHandlers: Array<() => void> = [];

jest.setTimeout(30000);

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('@superset-ui/core/components/ActionButton', () => ({
  ActionButton: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }) => {
    if (label === 'Move to folder' && !disabled) {
      mockMoveActionHandlers.push(onClick);
    }
    return (
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        {label}
      </button>
    );
  },
}));

jest.mock('src/utils/export', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('src/utils/getBootstrapData', () =>
  mockUserSubjectsBootstrapData([1]),
);

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: <Props extends object>(Component: React.ComponentType<Props>) =>
    Component,
}));

jest.mock('./MoveDashboardFolderModal', () => ({
  MoveDashboardFolderModal: ({
    onHide,
    onMove,
  }: {
    onHide: () => void;
    onMove: (folderId: string | null) => void;
  }) => (
    <dialog open>
      <button type="button" onClick={() => onMove('finance')}>
        Move
      </button>
      <button type="button" onClick={onHide}>
        Cancel
      </button>
    </dialog>
  ),
}));

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

function renderFolderDashboardList(props: Record<string, unknown> = {}) {
  return renderDashboardList(folderAdmin, {
    addDangerToast: jest.fn(),
    addSuccessToast: jest.fn(),
    ...props,
  });
}

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
  mockMoveActionHandlers.length = 0;
  setupMocks();
  mockFolderList();
  mockIsFeatureEnabled.mockReturnValue(false);
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  mockIsFeatureEnabled.mockReset();
});

test('synchronizes folder tree selection with the list filter', async () => {
  renderFolderDashboardList();

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

test('shows an error when dashboard folders cannot be loaded', async () => {
  const addDangerToast = jest.fn();
  fetchMock.removeRoutes({
    names: [API_ENDPOINTS.DASHBOARD_FOLDERS, API_ENDPOINTS.CATCH_ALL],
  });
  fetchMock.get(
    API_ENDPOINTS.DASHBOARD_FOLDERS,
    { status: 500, body: {} },
    { name: API_ENDPOINTS.DASHBOARD_FOLDERS },
  );

  renderFolderDashboardList({ addDangerToast });

  await waitFor(() =>
    expect(addDangerToast).toHaveBeenCalledWith(
      'Failed to load dashboard folders',
    ),
  );
});

test('moves a dashboard to a selected folder and refreshes the list', async () => {
  const addSuccessToast = jest.fn();
  fetchMock.put('glob:*/api/v1/dashboard_folder/dashboard/1', {
    message: 'ok',
  });
  renderFolderDashboardList({ addSuccessToast });

  const moveButtons = await screen.findAllByRole('button', {
    name: 'Move to folder',
  });
  expect(moveButtons[0]).toBeEnabled();
  act(() => mockMoveActionHandlers[0]());
  await userEvent.click(await screen.findByRole('button', { name: 'Move' }));

  await waitFor(() => {
    const moveCalls = fetchMock.callHistory.calls(
      /dashboard_folder\/dashboard\/1$/,
      { method: 'PUT' },
    );
    expect(moveCalls).toHaveLength(1);
    expect(JSON.parse(moveCalls[0].options.body as string)).toEqual({
      folder_id: 'finance',
    });
    expect(addSuccessToast).toHaveBeenCalledWith('Dashboard moved');
    expect(
      fetchMock.callHistory.calls(API_ENDPOINTS.DASHBOARD_FOLDERS, {
        method: 'GET',
      }),
    ).toHaveLength(2);
    expect(
      fetchMock.callHistory.calls(API_ENDPOINTS.DASHBOARDS, { method: 'GET' }),
    ).toHaveLength(2);
  });
});

test('closes the move dialog without moving the dashboard', async () => {
  renderFolderDashboardList();

  const moveButtons = await screen.findAllByRole('button', {
    name: 'Move to folder',
  });
  expect(moveButtons[0]).toBeEnabled();
  act(() => mockMoveActionHandlers[0]());
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(
    fetchMock.callHistory.calls(/dashboard_folder\/dashboard\//, {
      method: 'PUT',
    }),
  ).toHaveLength(0);
});

test('completes folder creation, rename, and deletion from the list', async () => {
  fetchMock.post('glob:*/api/v1/dashboard_folder/', { id: 'new-folder' });
  fetchMock.put('glob:*/api/v1/dashboard_folder/finance', { id: 'finance' });
  fetchMock.delete('glob:*/api/v1/dashboard_folder/finance', {
    message: 'ok',
  });
  renderFolderDashboardList();

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
