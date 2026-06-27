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
  screen,
  render,
  userEvent,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { isFeatureEnabled } from '@superset-ui/core';
import {
  addCspAllowlistEntry,
  fetchCspAllowlist,
} from 'src/dashboard/util/cspAllowlist';
import IframeContent from './IframeContent';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(() => true),
}));

jest.mock('src/dashboard/util/cspAllowlist', () => ({
  ...jest.requireActual('src/dashboard/util/cspAllowlist'),
  fetchCspAllowlist: jest.fn(),
  addCspAllowlistEntry: jest.fn(),
}));

const mockedFetch = fetchCspAllowlist as jest.Mock;
const mockedAdd = addCspAllowlistEntry as jest.Mock;
const mockedFeature = isFeatureEnabled as jest.Mock;

const adminState = {
  user: { roles: { Admin: [['can_write', 'CSPAllowlist']] } },
};
const gammaState = {
  user: { roles: { Gamma: [['can_read', 'Dashboard']] } },
};

const setup = (
  {
    url = 'https://example.com',
    editMode = false,
    updateMeta = jest.fn(),
  }: { url?: string; editMode?: boolean; updateMeta?: jest.Mock } = {},
  initialState: object = adminState,
) =>
  render(
    <IframeContent
      id="iframe-id"
      meta={{ url }}
      editMode={editMode}
      updateMeta={updateMeta}
    />,
    { useRedux: true, initialState },
  );

beforeEach(() => {
  mockedFeature.mockReturnValue(true);
  mockedFetch.mockResolvedValue(new Set<string>());
  mockedAdd.mockResolvedValue(undefined);
});

afterEach(() => jest.clearAllMocks());

test('renders an iframe with the configured URL', () => {
  setup();
  expect(screen.getByTitle('Embedded content')).toHaveAttribute(
    'src',
    'https://example.com',
  );
});

test('renders an empty placeholder when no URL is configured', () => {
  setup({ url: '' });
  expect(screen.queryByTitle('Embedded content')).not.toBeInTheDocument();
  expect(screen.getByText('No URL configured')).toBeInTheDocument();
});

test('saves the URL via updateMeta on blur in edit mode', async () => {
  const updateMeta = jest.fn();
  setup({ editMode: true, updateMeta });
  const input = screen.getByTestId('dashboard-iframe-url-input');
  await userEvent.clear(input);
  await userEvent.type(input, 'https://new.example.com');
  fireEvent.blur(input);
  await waitFor(() =>
    expect(updateMeta).toHaveBeenCalledWith({ url: 'https://new.example.com' }),
  );
});

test('flags a non-allowlisted domain and offers Enable for admins', async () => {
  mockedFetch.mockResolvedValue(new Set<string>());
  setup({ editMode: true });
  expect(
    await screen.findByText('This domain is not allowed to be embedded'),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByTestId('dashboard-iframe-enable-csp'));
  expect(mockedAdd).toHaveBeenCalledWith('https://example.com');
});

test('does not flag an already-allowlisted domain', async () => {
  mockedFetch.mockResolvedValue(new Set<string>(['https://example.com']));
  setup({ editMode: true });
  await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
  expect(
    screen.queryByText('This domain is not allowed to be embedded'),
  ).not.toBeInTheDocument();
});

test('hides Enable for users without the CSP permission', async () => {
  setup({ editMode: true }, gammaState);
  expect(
    await screen.findByText('This domain is not allowed to be embedded'),
  ).toBeInTheDocument();
  expect(
    screen.queryByTestId('dashboard-iframe-enable-csp'),
  ).not.toBeInTheDocument();
});

test('never flags domains when the feature flag is disabled', async () => {
  mockedFeature.mockReturnValue(false);
  setup({ editMode: true });
  await waitFor(() => expect(mockedFetch).not.toHaveBeenCalled());
  expect(
    screen.queryByText('This domain is not allowed to be embedded'),
  ).not.toBeInTheDocument();
});
