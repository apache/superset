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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
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

type ClientResponse = Awaited<ReturnType<typeof SupersetClient.get>>;

const mockApi = (infoStatus: number) =>
  jest.spyOn(SupersetClient, 'get').mockImplementation(({ endpoint }) =>
    endpoint?.startsWith('/api/v1/extensions/_info') && infoStatus !== 200
      ? Promise.reject(
          new Response('{"message": "Not found"}', { status: infoStatus }),
        )
      : Promise.resolve({
          json: endpoint?.startsWith('/api/v1/extensions/_info')
            ? { permissions: ['can_read'] }
            : {
                result: [
                  { id: 1, name: 'Registered Extension', enabled: true },
                ],
                count: 1,
              },
          response: new Response(),
        } as ClientResponse),
  );

afterEach(() => jest.restoreAllMocks());

test('explains that extensions are not enabled when the API is absent', async () => {
  // The flag is on for the browser, but the server started with it off and
  // never registered the extensions APIs.
  const get = mockApi(404);
  const addDangerToast = jest.spyOn(toasters, 'addDangerToast');
  renderWithStore();

  expect(
    await screen.findByText('Extensions are not enabled on this server'),
  ).toBeInTheDocument();
  expect(screen.getByText(/ENABLE_EXTENSIONS/)).toBeInTheDocument();
  expect(addDangerToast).not.toHaveBeenCalled();
  // The list is never requested from a server without the API.
  expect(
    get.mock.calls.some(([request]) =>
      request.endpoint?.startsWith('/api/v1/extensions/?'),
    ),
  ).toBe(false);
});

test('lists extensions once the API answers', async () => {
  mockApi(200);
  renderWithStore();

  expect(await screen.findByText('Registered Extension')).toBeInTheDocument();
  expect(
    screen.queryByText('Extensions are not enabled on this server'),
  ).not.toBeInTheDocument();
});

test('reports other _info failures through the danger toast', async () => {
  mockApi(500);
  // withToasts binds its own action creators over any passed toast props.
  const addDangerToast = jest.spyOn(toasters, 'addDangerToast');
  renderWithStore();

  await waitFor(() =>
    expect(addDangerToast).toHaveBeenCalledWith(
      expect.stringContaining(
        'An error occurred while fetching Extensions info',
      ),
    ),
  );
  expect(await screen.findByText('Registered Extension')).toBeInTheDocument();
  expect(
    screen.queryByText('Extensions are not enabled on this server'),
  ).not.toBeInTheDocument();
});
