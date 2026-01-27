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
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { UserListPasswordChangeModal } from './UserListModal';
import { updateUser } from './utils';

const mockToasts = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
};

jest.mock('./utils');
const mockUpdateUser = jest.mocked(updateUser);

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: React.ComponentType) => Component,
  useToasts: () => mockToasts,
}));

const mockUser = {
  id: 1,
  first_name: 'John',
  last_name: 'Doe',
  username: 'johndoe',
  email: 'john@example.com',
  active: true,
  changed_by: null,
  changed_on: '2024-01-01',
  created_by: null,
  created_on: '2024-01-01',
  fail_login_count: 0,
  last_login: '2024-01-01',
  login_count: 10,
  roles: [{ id: 1, name: 'Admin' }],
  groups: [{ id: 1, name: 'Group A' }],
};

const mockRoles = [
  { id: 1, name: 'Admin' },
  { id: 2, name: 'Alpha' },
];

const mockGroups = [
  { id: 1, name: 'Group A' },
  { id: 2, name: 'Group B' },
];

const defaultProps = {
  show: true,
  onHide: jest.fn(),
  onSave: jest.fn(),
  roles: mockRoles,
  groups: mockGroups,
  user: mockUser,
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders password change modal with correct title', () => {
  render(<UserListPasswordChangeModal {...defaultProps} />);
  expect(screen.getAllByText('Change password')[0]).toBeInTheDocument();
});

test('renders only password fields in password change mode', () => {
  render(<UserListPasswordChangeModal {...defaultProps} />);

  // Password fields should be visible
  expect(screen.getByText('Password')).toBeInTheDocument();
  expect(screen.getByText('Confirm Password')).toBeInTheDocument();

  // Profile fields should NOT be visible
  expect(screen.queryByText('First name')).not.toBeInTheDocument();
  expect(screen.queryByText('Last name')).not.toBeInTheDocument();
  expect(screen.queryByText('Username')).not.toBeInTheDocument();
  expect(screen.queryByText('Email')).not.toBeInTheDocument();

  // Association fields should NOT be visible
  expect(screen.queryByText('Roles')).not.toBeInTheDocument();
  expect(screen.queryByText('Groups')).not.toBeInTheDocument();
});

test('disables save button when password fields are empty', () => {
  render(<UserListPasswordChangeModal {...defaultProps} />);
  expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
});

test('shows validation error when passwords do not match', async () => {
  render(<UserListPasswordChangeModal {...defaultProps} />);

  const passwordInputs = screen.getAllByPlaceholderText(/password/i);
  const passwordInput = passwordInputs[0];
  const confirmPasswordInput = passwordInputs[1];

  fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
  fireEvent.change(confirmPasswordInput, {
    target: { value: 'differentPassword' },
  });
  fireEvent.blur(confirmPasswordInput);

  await waitFor(() => {
    expect(screen.getByText('Passwords do not match!')).toBeInTheDocument();
  });
});

test('enables save button when passwords match', async () => {
  render(<UserListPasswordChangeModal {...defaultProps} />);

  const passwordInputs = screen.getAllByPlaceholderText(/password/i);
  const passwordInput = passwordInputs[0];
  const confirmPasswordInput = passwordInputs[1];

  fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
  fireEvent.change(confirmPasswordInput, {
    target: { value: 'newPassword123' },
  });

  await waitFor(() => {
    expect(screen.getByTestId('form-modal-save-button')).toBeEnabled();
  });
});

test('calls updateUser with only password when form is submitted', async () => {
  mockUpdateUser.mockResolvedValueOnce(undefined);

  render(<UserListPasswordChangeModal {...defaultProps} />);

  const passwordInputs = screen.getAllByPlaceholderText(/password/i);
  const passwordInput = passwordInputs[0];
  const confirmPasswordInput = passwordInputs[1];

  fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
  fireEvent.change(confirmPasswordInput, {
    target: { value: 'newPassword123' },
  });

  await waitFor(() => {
    expect(screen.getByTestId('form-modal-save-button')).toBeEnabled();
  });

  fireEvent.click(screen.getByTestId('form-modal-save-button'));

  await waitFor(() => {
    expect(mockUpdateUser).toHaveBeenCalledWith(mockUser.id, {
      password: 'newPassword123',
    });
  });
});

test('shows success toast on successful password change', async () => {
  mockUpdateUser.mockResolvedValueOnce(undefined);

  render(<UserListPasswordChangeModal {...defaultProps} />);

  const passwordInputs = screen.getAllByPlaceholderText(/password/i);
  const passwordInput = passwordInputs[0];
  const confirmPasswordInput = passwordInputs[1];

  fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
  fireEvent.change(confirmPasswordInput, {
    target: { value: 'newPassword123' },
  });

  await waitFor(() => {
    expect(screen.getByTestId('form-modal-save-button')).toBeEnabled();
  });

  fireEvent.click(screen.getByTestId('form-modal-save-button'));

  await waitFor(() => {
    expect(mockToasts.addSuccessToast).toHaveBeenCalledWith(
      'The user password has been changed successfully.',
    );
  });
});

test('shows error toast on failed password change', async () => {
  mockUpdateUser.mockRejectedValueOnce(new Error('Update failed'));

  render(<UserListPasswordChangeModal {...defaultProps} />);

  const passwordInputs = screen.getAllByPlaceholderText(/password/i);
  const passwordInput = passwordInputs[0];
  const confirmPasswordInput = passwordInputs[1];

  fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
  fireEvent.change(confirmPasswordInput, {
    target: { value: 'newPassword123' },
  });

  await waitFor(() => {
    expect(screen.getByTestId('form-modal-save-button')).toBeEnabled();
  });

  fireEvent.click(screen.getByTestId('form-modal-save-button'));

  await waitFor(() => {
    expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
      'There was an error changing the user password. Please, try again.',
    );
  });
});

test('calls onHide when cancel button is clicked', () => {
  render(<UserListPasswordChangeModal {...defaultProps} />);
  fireEvent.click(screen.getByTestId('modal-cancel-button'));
  expect(defaultProps.onHide).toHaveBeenCalled();
});

test('calls onSave after successful password change', async () => {
  mockUpdateUser.mockResolvedValueOnce(undefined);

  render(<UserListPasswordChangeModal {...defaultProps} />);

  const passwordInputs = screen.getAllByPlaceholderText(/password/i);
  const passwordInput = passwordInputs[0];
  const confirmPasswordInput = passwordInputs[1];

  fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
  fireEvent.change(confirmPasswordInput, {
    target: { value: 'newPassword123' },
  });

  await waitFor(() => {
    expect(screen.getByTestId('form-modal-save-button')).toBeEnabled();
  });

  fireEvent.click(screen.getByTestId('form-modal-save-button'));

  await waitFor(() => {
    expect(defaultProps.onSave).toHaveBeenCalled();
  });
});
