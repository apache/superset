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
import { SupersetClient, JsonResponse } from '@superset-ui/core';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { ChangePasswordModal } from './UserInfoModal';

const mockAddDangerToast = jest.fn();
const mockAddSuccessToast = jest.fn();

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  ...jest.requireActual('src/components/MessageToasts/withToasts'),
  useToasts: () => ({
    addDangerToast: mockAddDangerToast,
    addSuccessToast: mockAddSuccessToast,
  }),
}));

const policyResult = {
  password_min_length: 12,
  password_require_uppercase: true,
  password_require_lowercase: true,
  password_require_digit: true,
  password_require_special: true,
  password_common_list_check: true,
};

const STRONG_PASSWORD = 'AnotherStr0ng!Pass';

const renderModal = (onSave = jest.fn()) => {
  render(<ChangePasswordModal show onHide={jest.fn()} onSave={onSave} />, {
    useRedux: true,
  });
  return { onSave };
};

const fillPasswords = (newPassword = STRONG_PASSWORD) => {
  fireEvent.change(screen.getByPlaceholderText('Enter your current password'), {
    target: { value: 'CurrentStr0ng!Pass' },
  });
  fireEvent.change(screen.getByPlaceholderText('Enter a new password'), {
    target: { value: newPassword },
  });
  fireEvent.change(screen.getByPlaceholderText('Confirm the new password'), {
    target: { value: newPassword },
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: policyResult },
  } as unknown as JsonResponse);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('fetches the password policy when opened', async () => {
  renderModal();
  await waitFor(() => {
    expect(SupersetClient.get).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/v1/me/password/policy' }),
    );
  });
});

test('submits a valid password change and lets FormModal trigger onSave', async () => {
  const put = jest
    .spyOn(SupersetClient, 'put')
    .mockResolvedValue({ json: {} } as unknown as JsonResponse);
  const { onSave } = renderModal();

  fillPasswords();
  const saveButton = await screen.findByTestId('form-modal-save-button');
  await waitFor(() => expect(saveButton).not.toBeDisabled());
  fireEvent.click(saveButton);

  await waitFor(() => {
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/v1/me/password' }),
    );
  });
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(mockAddSuccessToast).toHaveBeenCalled();
});

test('keeps the modal open and shows an error toast when the request fails', async () => {
  jest.spyOn(SupersetClient, 'put').mockRejectedValue({
    response: new Response(
      JSON.stringify({ message: 'Incorrect current password.' }),
      { status: 400 },
    ),
  });
  const { onSave } = renderModal();

  fillPasswords();
  const saveButton = await screen.findByTestId('form-modal-save-button');
  await waitFor(() => expect(saveButton).not.toBeDisabled());
  fireEvent.click(saveButton);

  await waitFor(() =>
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'Incorrect current password.',
    ),
  );
  expect(onSave).not.toHaveBeenCalled();
});

test('shows success and a refresh warning when password change succeeds but re-auth fails', async () => {
  jest
    .spyOn(SupersetClient, 'put')
    .mockResolvedValue({ json: {} } as unknown as JsonResponse);
  jest
    .spyOn(SupersetClient, 'reAuthenticate')
    .mockRejectedValue(new Error('network error'));
  const { onSave } = renderModal();

  fillPasswords();
  const saveButton = await screen.findByTestId('form-modal-save-button');
  await waitFor(() => expect(saveButton).not.toBeDisabled());
  fireEvent.click(saveButton);

  await waitFor(() => expect(mockAddSuccessToast).toHaveBeenCalled());
  await waitFor(() => expect(mockAddDangerToast).toHaveBeenCalled());
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
});

test('generate password populates the new and confirm fields', async () => {
  renderModal();
  await screen.findByPlaceholderText('Enter a new password');

  fireEvent.click(screen.getByLabelText('Generate password'));

  const newPasswordInput = screen.getByPlaceholderText(
    'Enter a new password',
  ) as HTMLInputElement;
  const confirmInput = screen.getByPlaceholderText(
    'Confirm the new password',
  ) as HTMLInputElement;
  await waitFor(() =>
    expect(newPasswordInput.value.length).toBeGreaterThanOrEqual(12),
  );
  expect(confirmInput.value).toBe(newPasswordInput.value);
});
