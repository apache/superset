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
import {
  createStore,
  fireEvent,
  render,
  screen,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import {
  saveDashboardRequest,
  setCopyAdjustConfirm,
} from 'src/dashboard/actions/dashboardState';
import type { RootState } from 'src/dashboard/types';
import { SAVE_TYPE_NEWDASHBOARD_ADJUSTED } from 'src/dashboard/util/constants';
import CopyAdjustConfirm from '.';

jest.mock('src/dashboard/actions/dashboardState', () => ({
  ...jest.requireActual('src/dashboard/actions/dashboardState'),
  saveDashboardRequest: jest.fn(() => ({ type: 'MOCK_SAVE_DASHBOARD' })),
}));

const copyAdjustConfirmMetadata = {
  dashboardId: 7,
  data: { dashboard_title: 'Sales [copy]', duplicate_slices: false },
  adjustments: [
    {
      kind: 'filter_default' as const,
      dashboard: 'Sales [copy]',
      name: 'Date',
      field: 'default',
      old: null,
      new: 'DATEADD(DATETIME("today"), -14, day) : today',
      old_label: 'No filter',
      new_label: 'Last 14 days',
    },
  ],
  fingerprint: 'fingerprint-1',
  changed: false,
};

const setup = (
  changed = false,
  adjustments = copyAdjustConfirmMetadata.adjustments,
) => {
  const store = createStore(
    {
      dashboardState: {
        copyAdjustConfirmMetadata: {
          ...copyAdjustConfirmMetadata,
          changed,
          adjustments,
        },
      },
    },
    reducerIndex,
  );
  render(<CopyAdjustConfirm />, { store });
  const pending = () =>
    (store.getState() as unknown as RootState).dashboardState
      .copyAdjustConfirmMetadata;
  return { pending };
};

afterEach(() => {
  jest.clearAllMocks();
});

test('renders nothing until a copy needs the time ranges adjusted', () => {
  render(<CopyAdjustConfirm />, {
    useRedux: true,
    initialState: { dashboardState: {} },
  });
  expect(
    screen.queryByRole('button', { name: 'Adjust and copy' }),
  ).not.toBeInTheDocument();
});

test('lists the changes the copy needs', async () => {
  setup();
  expect(
    await screen.findByText(
      'Time range filter "Date": default "No filter" → "Last 14 days"',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/The original dashboard is not changed/),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/changed since you reviewed/),
  ).not.toBeInTheDocument();
});

test('says when the list changed since the last review', async () => {
  setup(true);
  expect(
    await screen.findByText(
      'The changes needed changed since you reviewed them. Review the new list.',
    ),
  ).toBeInTheDocument();
});

test('copies with the reviewed adjustments on confirm', async () => {
  const { pending } = setup();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Adjust and copy' }),
  );
  expect(saveDashboardRequest).toHaveBeenCalledWith(
    copyAdjustConfirmMetadata.data,
    7,
    SAVE_TYPE_NEWDASHBOARD_ADJUSTED,
    'fingerprint-1',
  );
  expect(pending()).toBeUndefined();
});

test('saves the copy unchanged when the reviewed changes are no longer needed', async () => {
  const { pending } = setup(true, []);
  expect(
    await screen.findByText(
      'The changes needed changed since you reviewed them. No changes are needed any more.',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(saveDashboardRequest).toHaveBeenCalledWith(
    copyAdjustConfirmMetadata.data,
    7,
    SAVE_TYPE_NEWDASHBOARD_ADJUSTED,
    'fingerprint-1',
  );
  expect(pending()).toBeUndefined();
});

test('copies nothing on cancel', async () => {
  const { pending } = setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
  expect(saveDashboardRequest).not.toHaveBeenCalled();
  expect(pending()).toBeUndefined();
});

test('clears the confirmation through its action', () => {
  expect(setCopyAdjustConfirm(undefined)).toEqual({
    type: 'SET_COPY_ADJUST_CONFIRM',
    copyAdjustConfirmMetadata: undefined,
  });
});
