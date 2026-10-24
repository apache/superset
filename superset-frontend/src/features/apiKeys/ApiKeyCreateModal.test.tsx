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
import { SupersetClient } from '@superset-ui/core';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { ApiKeyCreateModal } from './ApiKeyCreateModal';

const SCOPES_ENDPOINT = 'glob:*/api/v1/me/api_key_scopes/';
const CREATE_ENDPOINT = 'glob:*/api/v1/security/api_keys/';

const props = {
  show: true,
  onHide: jest.fn(),
  onSuccess: jest.fn(),
};

const mockToasts = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
};

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: unknown) => Component,
  useToasts: () => mockToasts,
}));

const openScopesSelect = async () => {
  await userEvent.click(screen.getByRole('combobox', { name: 'scopes' }));
};

beforeAll(() => {
  SupersetClient.configure().init();
});

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  jest.clearAllMocks();
});

test('offers only the scopes the current user may self-issue', async () => {
  fetchMock.get(SCOPES_ENDPOINT, {
    result: ['superset:chart:read', 'superset:dashboard:read'],
  });

  render(<ApiKeyCreateModal {...props} />);
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(SCOPES_ENDPOINT)).toHaveLength(1),
  );
  await openScopesSelect();

  expect(await screen.findByText('superset:chart:read')).toBeInTheDocument();
  expect(screen.getByText('superset:dashboard:read')).toBeInTheDocument();
  expect(
    screen.queryByText('superset:dashboard:write'),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('superset:user:write')).not.toBeInTheDocument();
});

test('offers no scopes while the lookup is still in flight', async () => {
  fetchMock.get(
    SCOPES_ENDPOINT,
    { result: ['superset:chart:read'] },
    { delay: 10_000 },
  );

  render(<ApiKeyCreateModal {...props} />);
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(SCOPES_ENDPOINT)).toHaveLength(1),
  );
  await openScopesSelect();

  expect(screen.queryByText('superset:chart:read')).not.toBeInTheDocument();
  expect(screen.queryByText('superset:user:write')).not.toBeInTheDocument();
});

test('falls back to the full catalog when the scope lookup fails', async () => {
  fetchMock.get(SCOPES_ENDPOINT, 500);

  render(<ApiKeyCreateModal {...props} />);
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(SCOPES_ENDPOINT)).toHaveLength(1),
  );
  await openScopesSelect();

  // the catalog is virtualised, so assert on an early entry the restricted
  // list above would have hidden
  expect(
    await screen.findByText('superset:dashboard:write'),
  ).toBeInTheDocument();
});

test('surfaces the server reason when key creation is rejected', async () => {
  fetchMock.get(SCOPES_ENDPOINT, { result: ['superset:dashboard:write'] });
  fetchMock.post(CREATE_ENDPOINT, {
    status: 400,
    body: {
      message:
        "400 Bad Request: Requested scope 'superset:dashboard:write' exceeds the issuing user's own permissions",
    },
  });

  render(<ApiKeyCreateModal {...props} />);
  await userEvent.type(
    await screen.findByPlaceholderText(
      'e.g., CI/CD Pipeline, Analytics Script',
    ),
    'ci key',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() =>
    expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Failed to create API key: .*exceeds the issuing user's own permissions/,
      ),
    ),
  );
  expect(props.onSuccess).not.toHaveBeenCalled();
});
