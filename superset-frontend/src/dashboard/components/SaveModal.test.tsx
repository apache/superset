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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import SaveModal from 'src/dashboard/components/SaveModal';
import {
  SAVE_TYPE_OVERWRITE,
  SAVE_TYPE_NEWDASHBOARD,
} from 'src/dashboard/util/constants';

const dashboardTitle = 'Sales Dashboard';

const defaultProps = {
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  dashboardId: 1,
  dashboardTitle,
  dashboardInfo: {
    certified_by: '',
    certification_details: '',
    editors: [],
    metadata: { refresh_frequency: 0 },
  },
  expandedSlices: {},
  layout: { ROOT_ID: {} },
  // SaveModal does not export its SaveType union; the inline cast (rather
  // than a `const` alias, which TS would narrow back to the literal type at
  // every use) keeps this assignable to both save types in prop overrides.
  saveType: SAVE_TYPE_OVERWRITE as
    | typeof SAVE_TYPE_OVERWRITE
    | typeof SAVE_TYPE_NEWDASHBOARD,
  triggerNode: <span>Open save modal</span>,
  customCss: '',
  onSave: jest.fn(),
  canOverwrite: true,
  shouldPersistRefreshFrequency: false,
  refreshFrequency: 30,
  lastModifiedTime: 1700000000,
};

const setup = (props: Partial<typeof defaultProps> = {}) =>
  render(<SaveModal {...defaultProps} {...props} />);

const openModal = async (props: Partial<typeof defaultProps> = {}) => {
  setup(props);
  await userEvent.click(screen.getByText('Open save modal'));
  return screen.findByRole('dialog');
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('saving in overwrite mode calls onSave with the overwrite save type', async () => {
  await openModal();

  await userEvent.click(screen.getByTestId('modal-save-dashboard-button'));

  expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
  const [data, id, saveType] = defaultProps.onSave.mock.calls[0];
  expect(saveType).toBe(SAVE_TYPE_OVERWRITE);
  expect(id).toBe(defaultProps.dashboardId);
  expect(data.dashboard_title).toBe(dashboardTitle);
});

test('defaults the new dashboard name to "<title> [copy]"', async () => {
  await openModal();

  expect(screen.getByPlaceholderText('[dashboard name]')).toHaveValue(
    `${dashboardTitle} [copy]`,
  );
});

test('saving in save-as mode without editing the name uses the default copy name', async () => {
  await openModal({ saveType: SAVE_TYPE_NEWDASHBOARD });

  await userEvent.click(screen.getByTestId('modal-save-dashboard-button'));

  expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
  const [data, , saveType] = defaultProps.onSave.mock.calls[0];
  expect(saveType).toBe(SAVE_TYPE_NEWDASHBOARD);
  expect(data.dashboard_title).toMatch(/\[copy\]$/);
});

test('editing the new dashboard name switches to save-as and is used in the payload', async () => {
  await openModal();

  const nameInput = screen.getByPlaceholderText('[dashboard name]');
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, 'Copied Dashboard');

  await userEvent.click(screen.getByTestId('modal-save-dashboard-button'));

  expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
  const [data, , saveType] = defaultProps.onSave.mock.calls[0];
  expect(saveType).toBe(SAVE_TYPE_NEWDASHBOARD);
  expect(data.dashboard_title).toBe('Copied Dashboard');
});

test('save-as payload includes duplicate_slices when the checkbox is checked', async () => {
  await openModal();

  await userEvent.click(screen.getByRole('radio', { name: /Save as:/ }));
  await userEvent.click(
    screen.getByRole('checkbox', { name: /also copy \(duplicate\) charts/ }),
  );

  await userEvent.click(screen.getByTestId('modal-save-dashboard-button'));

  const [data] = defaultProps.onSave.mock.calls[0];
  expect(data.duplicate_slices).toBe(true);
});

test('overwrite payload does not duplicate slices by default', async () => {
  await openModal();

  await userEvent.click(screen.getByTestId('modal-save-dashboard-button'));

  const [data] = defaultProps.onSave.mock.calls[0];
  expect(data.duplicate_slices).toBe(false);
});

test('blocks save and warns when the new dashboard name is empty', async () => {
  await openModal();

  const nameInput = screen.getByPlaceholderText('[dashboard name]');
  await userEvent.clear(nameInput);

  await userEvent.click(screen.getByTestId('modal-save-dashboard-button'));

  expect(defaultProps.addDangerToast).toHaveBeenCalledWith(
    'You must pick a name for the new dashboard',
  );
  expect(defaultProps.onSave).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('disables overwrite and saves as a new dashboard when the user cannot overwrite', async () => {
  await openModal({
    canOverwrite: false,
    saveType: SAVE_TYPE_NEWDASHBOARD,
  });

  expect(
    screen.getByRole('radio', {
      name: new RegExp(`Overwrite Dashboard`),
    }),
  ).toBeDisabled();

  await userEvent.click(screen.getByTestId('modal-save-dashboard-button'));

  const [, , saveType] = defaultProps.onSave.mock.calls[0];
  expect(saveType).toBe(SAVE_TYPE_NEWDASHBOARD);
});

test('cancel closes the modal without calling onSave', async () => {
  await openModal();

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(defaultProps.onSave).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
