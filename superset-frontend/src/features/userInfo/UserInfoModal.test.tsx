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
import type { User } from 'src/types/bootstrapTypes';
import { UserInfoEditModal } from './UserInfoModal';

const mockToasts = { addDangerToast: jest.fn(), addSuccessToast: jest.fn() };

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: any) => Component,
  useToasts: () => mockToasts,
}));

const meEndpoint = 'glob:*/api/v1/me/';
const user = { firstName: 'John', lastName: 'Doe' } as User;
const props = { show: true, onHide: jest.fn(), onSave: jest.fn(), user };

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

test.each([
  [
    'the validation error returned by the API',
    {
      status: 400,
      body: { message: { first_name: ['Length must be between 1 and 64.'] } },
    },
    'Length must be between 1 and 64.',
  ],
  [
    'the generic toast when the response has no message',
    { status: 500, body: {} },
    'Something went wrong while saving the user info',
  ],
])('shows %s', async (_, response, expectedToast) => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  fetchMock.put(meEndpoint, response);
  render(<UserInfoEditModal {...props} />);
  fireEvent.change(screen.getByPlaceholderText("Enter the user's first name"), {
    target: { value: 'J'.repeat(65) },
  });
  await waitFor(() =>
    expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
  );
  fireEvent.click(screen.getByTestId('form-modal-save-button'));

  await waitFor(() =>
    expect(mockToasts.addDangerToast).toHaveBeenCalledWith(expectedToast),
  );
  await waitFor(() =>
    expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
  );
  expect(props.onSave).not.toHaveBeenCalled();
  expect(mockToasts.addSuccessToast).not.toHaveBeenCalled();
  expect(
    screen.getByPlaceholderText("Enter the user's first name"),
  ).toHaveValue('J'.repeat(65));
});

test('calls onSave exactly once after a successful update', async () => {
  fetchMock.put(meEndpoint, { status: 200, body: {} });
  render(<UserInfoEditModal {...props} />);
  fireEvent.change(screen.getByPlaceholderText("Enter the user's first name"), {
    target: { value: 'Jane' },
  });
  await waitFor(() =>
    expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
  );
  fireEvent.click(screen.getByTestId('form-modal-save-button'));

  await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
  expect(mockToasts.addSuccessToast).toHaveBeenCalledWith(
    'The user was updated successfully',
  );
  expect(mockToasts.addDangerToast).not.toHaveBeenCalled();
});
