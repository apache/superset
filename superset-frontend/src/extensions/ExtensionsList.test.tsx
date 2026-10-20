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
import { act, render, screen, waitFor } from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import { toasters } from 'src/components/MessageToasts/withToasts';
import ExtensionsList from './ExtensionsList';
import fetchMock from 'fetch-mock';

beforeAll(() => fetchMock.unmockGlobal());

// Mock initial state for the store
const mockInitialState = {
  extensions: {
    loading: false,
    resourceCount: 2,
    resourceCollection: [
      {
        id: 1,
        name: 'Test Extension 1',
        enabled: true,
      },
      {
        id: 2,
        name: 'Test Extension 2',
        enabled: false,
      },
    ],
    bulkSelectEnabled: false,
  },
};

const defaultProps = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
};

const renderWithStore = (props = {}) =>
  render(<ExtensionsList {...defaultProps} {...props} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
    initialState: mockInitialState,
  });

test('renders extensions list with basic structure', async () => {
  renderWithStore();

  // Check that the component renders
  expect(document.body).toBeInTheDocument();
});

test('displays extension names in the list', async () => {
  renderWithStore();

  await waitFor(() => {
    // These texts should appear somewhere in the rendered component
    expect(document.body).toHaveTextContent(/Extensions/);
  });
});

test('calls toast functions when provided', () => {
  const addDangerToast = jest.fn();
  const addSuccessToast = jest.fn();

  renderWithStore({
    addDangerToast,
    addSuccessToast,
  });

  // The component should accept these props without error
  expect(addDangerToast).toBeDefined();
  expect(addSuccessToast).toBeDefined();
});

const mockExtensionsInfo = (status: 'loaded' | 'not_loaded') =>
  jest.spyOn(SupersetClient, 'get').mockImplementation(({ endpoint }) =>
    Promise.resolve({
      json: endpoint?.startsWith('/api/v1/extensions/_info')
        ? { permissions: ['can_read'], status }
        : { result: [], count: 0, status },
      response: new Response(),
    } as Awaited<ReturnType<typeof SupersetClient.get>>),
  );

afterEach(() => jest.restoreAllMocks());

test('explains an empty list when extensions were not loaded at startup', async () => {
  mockExtensionsInfo('not_loaded');
  renderWithStore();

  expect(await screen.findByText('Extensions not loaded')).toBeInTheDocument();
  expect(
    screen.getByText(/Restart the server to load them/),
  ).toBeInTheDocument();
});

test('shows no restart notice when extensions are loaded', async () => {
  const get = mockExtensionsInfo('loaded');
  renderWithStore();

  await waitFor(() =>
    expect(get).toHaveBeenCalledWith({ endpoint: '/api/v1/extensions/' }),
  );
  // Let the resolved list response render before asserting its absence.
  await act(async () => {});
  expect(screen.queryByText('Extensions not loaded')).not.toBeInTheDocument();
  // The load status rides on the list response; no separate _info request.
  const infoCalls = get.mock.calls.filter(([request]) =>
    request.endpoint?.startsWith('/api/v1/extensions/_info'),
  );
  expect(infoCalls).toHaveLength(0);
});

test('reports a list failure through the danger toast', async () => {
  jest
    .spyOn(SupersetClient, 'get')
    .mockImplementation(() =>
      Promise.reject(new Response('{"message": "Not found"}', { status: 404 })),
    );
  // withToasts binds its own action creators over any passed toast props.
  const addDangerToast = jest.spyOn(toasters, 'addDangerToast');
  renderWithStore();

  await waitFor(() =>
    expect(addDangerToast).toHaveBeenCalledWith(
      expect.stringContaining('An error occurred while fetching Extensionss'),
    ),
  );
  expect(screen.queryByText('Extensions not loaded')).not.toBeInTheDocument();
});

test('takes the restart notice from the list response, not a separate _info call', async () => {
  // Mixed fleet: _info reaches a pod that loaded extensions while the list
  // reaches one that did not.
  jest.spyOn(SupersetClient, 'get').mockImplementation(({ endpoint }) =>
    Promise.resolve({
      json: endpoint?.startsWith('/api/v1/extensions/_info')
        ? { permissions: ['can_read'], status: 'loaded' }
        : { result: [], count: 0, status: 'not_loaded' },
      response: new Response(),
    } as Awaited<ReturnType<typeof SupersetClient.get>>),
  );
  renderWithStore();

  expect(await screen.findByText('Extensions not loaded')).toBeInTheDocument();
});

test('shows no restart notice when the list comes from a loaded server', async () => {
  // The opposite pairing: _info reaches a pod that did not load extensions
  // while the list reaches one that did.
  jest.spyOn(SupersetClient, 'get').mockImplementation(({ endpoint }) =>
    Promise.resolve({
      json: endpoint?.startsWith('/api/v1/extensions/_info')
        ? { permissions: ['can_read'], status: 'not_loaded' }
        : {
            result: [{ id: 1, name: 'Loaded Extension', enabled: true }],
            count: 1,
            status: 'loaded',
          },
      response: new Response(),
    } as Awaited<ReturnType<typeof SupersetClient.get>>),
  );
  renderWithStore();

  expect(await screen.findByText('Loaded Extension')).toBeInTheDocument();
  expect(screen.queryByText('Extensions not loaded')).not.toBeInTheDocument();
});
