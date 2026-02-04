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
import * as redux from 'redux';
import { screen, waitFor, within } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { render } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { JsonObject } from '@superset-ui/core';
import { Modal } from '@superset-ui/core/components';
import { useUnsavedChangesPrompt } from 'src/hooks/useUnsavedChangesPrompt';
import { DashboardRestoreProvider } from 'src/dashboard/contexts/DashboardRestoreContext';
import Header from 'src/dashboard/components/Header';
import { DASHBOARD_HEADER_ID } from 'src/dashboard/util/constants';

const initialState = {
  dashboardInfo: {
    id: 1,
    dash_edit_perm: true,
    dash_save_perm: true,
    dash_share_perm: false,
    userId: '1',
    metadata: {},
    common: {
      conf: {
        DASHBOARD_AUTO_REFRESH_INTERVALS: [
          [0, "Don't refresh"],
          [10, '10 seconds'],
        ],
      },
    },
    changed_on_delta_humanized: '7 minutes ago',
    changed_by: { id: 3, first_name: 'John', last_name: 'Doe' },
    created_on_delta_humanized: '10 days ago',
    created_by: { id: 2, first_name: 'Kay', last_name: 'Mon' },
    owners: [{ first_name: 'John', last_name: 'Doe', id: 1 }],
  },
  user: {
    createdOn: '2021-04-27T18:12:38.952304',
    email: 'admin@test.com',
    firstName: 'admin',
    isActive: true,
    lastName: 'admin',
    permissions: {},
    roles: { Admin: [['menu_access', 'Manage']] },
    userId: 1,
    username: 'admin',
  },
  dashboardState: {
    sliceIds: [],
    expandedSlices: {},
    refreshFrequency: 0,
    shouldPersistRefreshFrequency: false,
    css: '',
    isStarred: false,
    isPublished: false,
    hasUnsavedChanges: false,
    maxUndoHistoryExceeded: false,
    editMode: false,
    lastModifiedTime: 0,
  },
  charts: {},
  dashboardLayout: {
    present: {
      [DASHBOARD_HEADER_ID]: { meta: { text: 'Dashboard Title' } },
    },
    past: [],
    future: [],
  },
};

const mockVersions = {
  result: [
    {
      id: 10,
      version_number: 2,
      comment: 'Restored version',
      created_at: '2024-01-02T12:00:00Z',
      created_by: 'admin',
    },
  ],
};

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});
fetchMock.get('glob:*/api/v1/dashboard/*/versions', { body: mockVersions });
fetchMock.post('glob:*/api/v1/dashboard/*/restore/*', { body: {} });

jest.mock('src/hooks/useUnsavedChangesPrompt', () => ({
  useUnsavedChangesPrompt: jest.fn(),
}));

const actionCreators = {
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  addWarningToast: jest.fn(),
  onUndo: jest.fn(),
  onRedo: jest.fn(),
  setEditMode: jest.fn(),
  setUnsavedChanges: jest.fn(),
  fetchFaveStar: jest.fn(),
  saveFaveStar: jest.fn(),
  savePublished: jest.fn(),
  fetchCharts: jest.fn(),
  updateDashboardTitle: jest.fn(),
  updateCss: jest.fn(),
  onChange: jest.fn(),
  onSave: jest.fn(),
  setMaxUndoHistoryExceeded: jest.fn(),
  maxUndoHistoryToast: jest.fn(),
  logEvent: jest.fn(),
  setRefreshFrequency: jest.fn(),
  onRefresh: jest.fn(),
  dashboardInfoChanged: jest.fn(),
  dashboardTitleChanged: jest.fn(),
  clearDashboardHistory: jest.fn(),
};

jest
  .spyOn(redux, 'bindActionCreators')
  .mockImplementation(() => actionCreators);

let capturedConfirmOnOk: (() => void | Promise<unknown>) | null = null;

beforeAll(() => {
  jest
    .spyOn(Modal, 'confirm')
    .mockImplementation((config: { onOk?: () => void | Promise<unknown> }) => {
      capturedConfirmOnOk = config.onOk ?? null;
      return { destroy: () => {}, update: () => {} };
    });
});

beforeEach(() => {
  jest.clearAllMocks();
  capturedConfirmOnOk = null;
  (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
    showModal: false,
    setShowModal: jest.fn(),
    handleConfirmNavigation: jest.fn(),
    handleSaveAndCloseModal: jest.fn(),
  });
  window.history.pushState({}, 'Test page', '/dashboard/1');
});

afterAll(() => {
  jest.restoreAllMocks();
});

function renderWithRestoreProvider(overrideState: JsonObject = {}) {
  const onDashboardRestored = jest.fn();
  render(
    <DashboardRestoreProvider onDashboardRestored={onDashboardRestored}>
      <div className="dashboard">
        <Header />
      </div>
    </DashboardRestoreProvider>,
    {
      useRedux: true,
      useTheme: true,
      initialState: { ...initialState, ...overrideState },
    },
  );
  return { onDashboardRestored };
}

test('restore from History modal calls onDashboardRestored and does not reload when provider is present', async () => {
  const reloadMock = jest.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: reloadMock },
    writable: true,
  });

  const { onDashboardRestored } = renderWithRestoreProvider();

  const historyButton = screen.getByTestId('header-history-button');
  await userEvent.click(historyButton);

  const dialog = await screen.findByRole('dialog', {
    name: /Dashboard history/i,
  });
  await waitFor(() => {
    expect(within(dialog).getByText('Version 2')).toBeInTheDocument();
  });

  const restoreButtons = within(dialog).getAllByRole('button', {
    name: /Restore/,
  });
  await userEvent.click(restoreButtons[0]);

  expect(capturedConfirmOnOk).not.toBeNull();
  await capturedConfirmOnOk!();

  await waitFor(() => {
    expect(onDashboardRestored).toHaveBeenCalledTimes(1);
  });
  expect(reloadMock).not.toHaveBeenCalled();
});
