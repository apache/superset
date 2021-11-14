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
import React from 'react';
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';
import * as actions from 'src/reports/actions/reports';
import * as featureFlags from 'src/featureFlags';
import mockState from 'spec/fixtures/mockStateWithoutUser';
import { HeaderProps } from './types';
import Header from '.';

const createProps = () => ({
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  addWarningToast: jest.fn(),
  dashboardInfo: {
    id: 1,
    dash_edit_perm: false,
    dash_save_perm: false,
    dash_share_perm: false,
    userId: '1',
    metadata: {},
    common: {
      conf: {},
    },
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
  reports: {},
  dashboardTitle: 'Dashboard Title',
  charts: {},
  layout: {},
  expandedSlices: {},
  css: '',
  customCss: '',
  isStarred: false,
  isLoading: false,
  lastModifiedTime: 0,
  refreshFrequency: 0,
  shouldPersistRefreshFrequency: false,
  onSave: jest.fn(),
  onChange: jest.fn(),
  fetchFaveStar: jest.fn(),
  fetchCharts: jest.fn(),
  onRefresh: jest.fn(),
  fetchUISpecificReport: jest.fn(),
  saveFaveStar: jest.fn(),
  savePublished: jest.fn(),
  isPublished: false,
  updateDashboardTitle: jest.fn(),
  editMode: false,
  setEditMode: jest.fn(),
  showBuilderPane: jest.fn(),
  updateCss: jest.fn(),
  setColorSchemeAndUnsavedChanges: jest.fn(),
  logEvent: jest.fn(),
  setRefreshFrequency: jest.fn(),
  hasUnsavedChanges: false,
  maxUndoHistoryExceeded: false,
  onUndo: jest.fn(),
  onRedo: jest.fn(),
  undoLength: 0,
  redoLength: 0,
  setMaxUndoHistoryExceeded: jest.fn(),
  maxUndoHistoryToast: jest.fn(),
  dashboardInfoChanged: jest.fn(),
  dashboardTitleChanged: jest.fn(),
});
const props = createProps();
const editableProps = {
  ...props,
  editMode: true,
  dashboardInfo: {
    ...props.dashboardInfo,
    dash_edit_perm: true,
    dash_save_perm: true,
  },
};
const undoProps = {
  ...editableProps,
  undoLength: 1,
};
const redoProps = {
  ...editableProps,
  redoLength: 1,
};

const REPORT_ENDPOINT = 'glob:*/api/v1/report*';

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});
fetchMock.get(REPORT_ENDPOINT, {});

function setup(props: HeaderProps) {
  return (
    <div className="dashboard">
      <Header {...props} />
    </div>
  );
}

async function openActionsDropdown() {
  const btn = screen.getByRole('img', { name: 'more-horiz' });
  userEvent.click(btn);
  expect(await screen.findByRole('menu')).toBeInTheDocument();
}

test('should render', () => {
  const mockedProps = createProps();
  const { container } = render(setup(mockedProps));
  expect(container).toBeInTheDocument();
});

test('should render the title', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(screen.getByText('Dashboard Title')).toBeInTheDocument();
});

test('should render the editable title', () => {
  render(setup(editableProps));
  expect(screen.getByDisplayValue('Dashboard Title')).toBeInTheDocument();
});

test('should edit the title', () => {
  render(setup(editableProps));
  const editableTitle = screen.getByDisplayValue('Dashboard Title');
  expect(editableProps.onChange).not.toHaveBeenCalled();
  userEvent.click(editableTitle);
  userEvent.clear(editableTitle);
  userEvent.type(editableTitle, 'New Title');
  userEvent.click(document.body);
  expect(editableProps.onChange).toHaveBeenCalled();
  expect(screen.getByDisplayValue('New Title')).toBeInTheDocument();
});

test('should render the "Draft" status', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(screen.getByText('Draft')).toBeInTheDocument();
});

test('should publish', () => {
  render(setup(editableProps));
  const draft = screen.getByText('Draft');
  expect(editableProps.savePublished).not.toHaveBeenCalled();
  userEvent.click(draft);
  expect(editableProps.savePublished).toHaveBeenCalledTimes(1);
});

test('should render the "Undo" action as disabled', () => {
  render(setup(editableProps));
  expect(screen.getByTitle('Undo').parentElement).toBeDisabled();
});

test('should undo', () => {
  render(setup(undoProps));
  const undo = screen.getByTitle('Undo');
  expect(undoProps.onUndo).not.toHaveBeenCalled();
  userEvent.click(undo);
  expect(undoProps.onUndo).toHaveBeenCalledTimes(1);
});

test('should undo with key listener', () => {
  undoProps.onUndo.mockReset();
  render(setup(undoProps));
  expect(undoProps.onUndo).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', ctrlKey: true });
  expect(undoProps.onUndo).toHaveBeenCalledTimes(1);
});

test('should render the "Redo" action as disabled', () => {
  render(setup(editableProps));
  expect(screen.getByTitle('Redo').parentElement).toBeDisabled();
});

test('should redo', () => {
  render(setup(redoProps));
  const redo = screen.getByTitle('Redo');
  expect(redoProps.onRedo).not.toHaveBeenCalled();
  userEvent.click(redo);
  expect(redoProps.onRedo).toHaveBeenCalledTimes(1);
});

test('should redo with key listener', () => {
  redoProps.onRedo.mockReset();
  render(setup(redoProps));
  expect(redoProps.onRedo).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: 'y', code: 'KeyY', ctrlKey: true });
  expect(redoProps.onRedo).toHaveBeenCalledTimes(1);
});

test('should render the "Discard changes" button', () => {
  render(setup(editableProps));
  expect(screen.getByText('Discard changes')).toBeInTheDocument();
});

test('should render the "Save" button as disabled', () => {
  render(setup(editableProps));
  expect(screen.getByText('Save').parentElement).toBeDisabled();
});

test('should save', () => {
  const unsavedProps = {
    ...editableProps,
    hasUnsavedChanges: true,
  };
  render(setup(unsavedProps));
  const save = screen.getByText('Save');
  expect(unsavedProps.onSave).not.toHaveBeenCalled();
  userEvent.click(save);
  expect(unsavedProps.onSave).toHaveBeenCalledTimes(1);
});

test('should NOT render the "Draft" status', () => {
  const mockedProps = createProps();
  const publishedProps = {
    ...mockedProps,
    isPublished: true,
  };
  render(setup(publishedProps));
  expect(screen.queryByText('Draft')).not.toBeInTheDocument();
});

test('should render the unselected fave icon', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(mockedProps.fetchFaveStar).toHaveBeenCalled();
  expect(
    screen.getByRole('img', { name: 'favorite-unselected' }),
  ).toBeInTheDocument();
});

test('should render the selected fave icon', () => {
  const mockedProps = createProps();
  const favedProps = {
    ...mockedProps,
    isStarred: true,
  };
  render(setup(favedProps));
  expect(
    screen.getByRole('img', { name: 'favorite-selected' }),
  ).toBeInTheDocument();
});

test('should NOT render the fave icon on anonymous user', () => {
  const mockedProps = createProps();
  const anonymousUserProps = {
    ...mockedProps,
    user: undefined,
  };
  render(setup(anonymousUserProps));
  expect(() =>
    screen.getByRole('img', { name: 'favorite-unselected' }),
  ).toThrowError('Unable to find');
  expect(() =>
    screen.getByRole('img', { name: 'favorite-selected' }),
  ).toThrowError('Unable to find');
});

test('should fave', async () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  const fave = screen.getByRole('img', { name: 'favorite-unselected' });
  expect(mockedProps.saveFaveStar).not.toHaveBeenCalled();
  userEvent.click(fave);
  expect(mockedProps.saveFaveStar).toHaveBeenCalledTimes(1);
});

test('should toggle the edit mode', () => {
  const mockedProps = createProps();
  const canEditProps = {
    ...mockedProps,
    dashboardInfo: {
      ...mockedProps.dashboardInfo,
      dash_edit_perm: true,
    },
  };
  render(setup(canEditProps));
  const editDashboard = screen.getByTitle('Edit dashboard');
  expect(screen.queryByTitle('Edit dashboard')).toBeInTheDocument();
  userEvent.click(editDashboard);
  expect(mockedProps.logEvent).toHaveBeenCalled();
});

test('should render the dropdown icon', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(screen.getByRole('img', { name: 'more-horiz' })).toBeInTheDocument();
});

test('should refresh the charts', async () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  await openActionsDropdown();
  userEvent.click(screen.getByText('Refresh dashboard'));
  expect(mockedProps.onRefresh).toHaveBeenCalledTimes(1);
});

describe('Email Report Modal', () => {
  let isFeatureEnabledMock: any;
  let dispatch: any;

  beforeEach(async () => {
    isFeatureEnabledMock = jest
      .spyOn(featureFlags, 'isFeatureEnabled')
      .mockImplementation(() => true);
    dispatch = sinon.spy();
  });

  afterAll(() => {
    isFeatureEnabledMock.mockRestore();
  });

  it('creates a new email report', async () => {
    // ---------- Render/value setup ----------
    const mockedProps = createProps();
    render(setup(mockedProps), { useRedux: true });

    const reportValues = {
      id: 1,
      result: {
        active: true,
        creation_method: 'dashboards',
        crontab: '0 12 * * 1',
        dashboard: mockedProps.dashboardInfo.id,
        name: 'Weekly Report',
        owners: [mockedProps.user.userId],
        recipients: [
          {
            recipient_config_json: {
              target: mockedProps.user.email,
            },
            type: 'Email',
          },
        ],
        type: 'Report',
      },
    };
    // This is needed to structure the reportValues to match the fetchMock return
    const stringyReportValues = `{"id":1,"result":{"active":true,"creation_method":"dashboards","crontab":"0 12 * * 1","dashboard":${mockedProps.dashboardInfo.id},"name":"Weekly Report","owners":[${mockedProps.user.userId}],"recipients":[{"recipient_config_json":{"target":"${mockedProps.user.email}"},"type":"Email"}],"type":"Report"}}`;
    // Watch for report POST
    fetchMock.post(REPORT_ENDPOINT, reportValues);

    screen.logTestingPlaygroundURL();
    // ---------- Begin tests ----------
    // Click calendar icon to open email report modal
    const emailReportModalButton = screen.getByRole('button', {
      name: /schedule email report/i,
    });
    userEvent.click(emailReportModalButton);

    // Click "Add" button to create a new email report
    const addButton = screen.getByRole('button', { name: /add/i });
    userEvent.click(addButton);

    // Mock addReport from Redux
    const makeRequest = () => {
      const request = actions.addReport(reportValues);
      return request(dispatch);
    };

    return makeRequest().then(() => {
      // 🐞 ----- There are 2 POST calls at this point ----- 🐞

      // addReport's mocked POST return should match the mocked values
      expect(fetchMock.lastOptions()?.body).toEqual(stringyReportValues);
      // Dispatch should be called once for addReport
      expect(dispatch.callCount).toBe(2);
      const reportCalls = fetchMock.calls(REPORT_ENDPOINT);
      expect(reportCalls).toHaveLength(2);
    });
  });

  it('edits an existing email report', async () => {
    // TODO (lyndsiWilliams): This currently does not work, see TODOs below
    //  The modal does appear with the edit title, but the PUT call is not registering

    // ---------- Render/value setup ----------
    const mockedProps = createProps();
    const editedReportValues = {
      active: true,
      creation_method: 'dashboards',
      crontab: '0 12 * * 1',
      dashboard: mockedProps.dashboardInfo.id,
      name: 'Weekly Report edit',
      owners: [mockedProps.user.userId],
      recipients: [
        {
          recipient_config_json: {
            target: mockedProps.user.email,
          },
          type: 'Email',
        },
      ],
      type: 'Report',
    };

    // getMockStore({ reports: reportValues });
    render(setup(mockedProps), {
      useRedux: true,
      initialState: mockState,
    });
    // TODO (lyndsiWilliams): currently fetchMock detects this PUT
    //  address as 'glob:*/api/v1/report/undefined', is not detected
    //  on fetchMock.calls()
    fetchMock.put(`glob:*/api/v1/report*`, editedReportValues);

    // Mock fetchUISpecificReport from Redux
    // const makeFetchRequest = () => {
    //   const request = actions.fetchUISpecificReport(
    //     mockedProps.user.userId,
    //     'dashboard_id',
    //     'dashboards',
    //     mockedProps.dashboardInfo.id,
    //   );
    //   return request(dispatch);
    // };

    // makeFetchRequest();

    dispatch(actions.setReport(editedReportValues));

    // ---------- Begin tests ----------
    // Click calendar icon to open email report modal
    const emailReportModalButton = screen.getByRole('button', {
      name: /schedule email report/i,
    });
    userEvent.click(emailReportModalButton);

    const nameTextbox = screen.getByTestId('report-name-test');
    userEvent.type(nameTextbox, ' edit');

    const saveButton = screen.getByRole('button', { name: /save/i });
    userEvent.click(saveButton);

    // TODO (lyndsiWilliams): There should be a report in state at this porint,
    // which would render the HeaderReportActionsDropDown under the calendar icon
    // BLOCKER: I cannot get report to populate, as its data is handled through redux
    expect.anything();
  });

  it('Should render report header', async () => {
    const mockedProps = createProps();
    render(setup(mockedProps));
    expect(
      screen.getByRole('button', { name: 'Schedule email report' }),
    ).toBeInTheDocument();
  });

  it('Should not render report header even with menu access for anonymous user', async () => {
    const mockedProps = createProps();
    const anonymousUserProps = {
      ...mockedProps,
      user: {
        roles: {
          Public: [['menu_access', 'Manage']],
        },
        permissions: {
          datasource_access: ['[examples].[birth_names](id:2)'],
        },
      },
    };
    render(setup(anonymousUserProps));
    expect(
      screen.queryByRole('button', { name: 'Schedule email report' }),
    ).not.toBeInTheDocument();
  });
});
