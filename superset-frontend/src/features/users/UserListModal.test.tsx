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
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import type { UserObject } from 'src/pages/UsersList/types';
import { UserListEditModal } from './UserListModal';

const mockToasts = { addDangerToast: jest.fn(), addSuccessToast: jest.fn() };

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: <T,>(Component: T) => Component,
  useToasts: () => mockToasts,
}));

const userEndpoint = 'glob:*/api/v1/security/users/7';
const user: UserObject = {
  id: 7,
  active: true,
  changed_by: null,
  changed_on: '',
  created_by: null,
  created_on: '',
  email: 'jane@example.com',
  fail_login_count: 0,
  first_name: 'Jane',
  last_name: 'Doe',
  last_login: '',
  login_count: 0,
  roles: [{ id: 1, name: 'Admin' }],
  username: 'jane',
  groups: [],
};
const props = {
  show: true,
  onHide: jest.fn(),
  onSave: jest.fn(),
  roles: [{ id: 1, name: 'Admin' }],
  groups: [],
  user,
};

const newPasswordInput = () =>
  screen.getByPlaceholderText('Enter a new password');
const confirmPasswordInput = () =>
  screen.getByPlaceholderText('Confirm the new password');
const saveButton = () => screen.getByTestId('form-modal-save-button');

const lastPutPayload = () =>
  JSON.parse(
    fetchMock.callHistory.calls(userEndpoint)[0].options?.body as string,
  );

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  jest.clearAllMocks();
});

test('edit mode offers optional new password fields', () => {
  render(<UserListEditModal {...props} />);

  expect(newPasswordInput()).toBeInTheDocument();
  expect(confirmPasswordInput()).toBeInTheDocument();
  expect(
    screen.getByText('Leave blank to keep the current password'),
  ).toBeInTheDocument();
});

test('saving without a new password leaves the password out of the payload', async () => {
  fetchMock.put(userEndpoint, { status: 200, body: {} });
  render(<UserListEditModal {...props} />);

  fireEvent.change(screen.getByPlaceholderText("Enter the user's last name"), {
    target: { value: 'Smith' },
  });
  await waitFor(() => expect(saveButton()).toBeEnabled());
  fireEvent.click(saveButton());

  await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
  const payload = lastPutPayload();
  expect(payload.last_name).toBe('Smith');
  expect(payload).not.toHaveProperty('password');
  expect(payload).not.toHaveProperty('confirmPassword');
});

test('saving with a confirmed new password sends it without the confirmation', async () => {
  fetchMock.put(userEndpoint, { status: 200, body: {} });
  render(<UserListEditModal {...props} />);

  fireEvent.change(newPasswordInput(), {
    target: { value: 'BrandNewPassw0rd!' },
  });
  fireEvent.change(confirmPasswordInput(), {
    target: { value: 'BrandNewPassw0rd!' },
  });
  await waitFor(() => expect(saveButton()).toBeEnabled());
  fireEvent.click(saveButton());

  await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
  const payload = lastPutPayload();
  expect(payload.password).toBe('BrandNewPassw0rd!');
  expect(payload).not.toHaveProperty('confirmPassword');
  expect(mockToasts.addSuccessToast).toHaveBeenCalledWith(
    'The user has been updated successfully.',
  );
});

test('a mismatched confirmation blocks saving', async () => {
  fetchMock.put(userEndpoint, { status: 200, body: {} });
  render(<UserListEditModal {...props} />);

  fireEvent.change(newPasswordInput(), {
    target: { value: 'BrandNewPassw0rd!' },
  });
  fireEvent.change(confirmPasswordInput(), {
    target: { value: 'SomethingElse1!' },
  });

  expect(
    await screen.findByText('Passwords do not match!'),
  ).toBeInTheDocument();
  await waitFor(() => expect(saveButton()).toBeDisabled());
  expect(fetchMock.callHistory.calls(userEndpoint)).toHaveLength(0);
});

test('a new password without confirmation blocks saving', async () => {
  fetchMock.put(userEndpoint, { status: 200, body: {} });
  render(<UserListEditModal {...props} />);

  fireEvent.change(newPasswordInput(), {
    target: { value: 'BrandNewPassw0rd!' },
  });
  await waitFor(() => expect(saveButton()).toBeEnabled());
  fireEvent.click(saveButton());

  expect(
    await screen.findByText('Please confirm your password'),
  ).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(userEndpoint)).toHaveLength(0);
  expect(props.onSave).not.toHaveBeenCalled();
});
