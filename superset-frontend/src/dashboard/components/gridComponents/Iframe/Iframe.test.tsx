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
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import {
  IFRAME_TYPE,
  DASHBOARD_GRID_TYPE,
} from 'src/dashboard/util/componentTypes';
import {
  addCspAllowlistEntry,
  fetchCspAllowlist,
} from 'src/dashboard/util/cspAllowlist';
import Iframe, { IframeProps } from './Iframe';

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
  user: {
    roles: { Admin: [['can_write', 'CSPAllowlist']] },
  },
};
const gammaState = {
  user: {
    roles: { Gamma: [['can_read', 'Dashboard']] },
  },
};

const makeComponent = (url = '') => {
  const component = newComponentFactory(IFRAME_TYPE);
  component.meta.url = url;
  return component;
};

const baseProps = (overrides: Partial<IframeProps> = {}): IframeProps => ({
  id: 'iframe-id',
  parentId: 'parentId',
  component: makeComponent('https://example.com'),
  parentComponent: newComponentFactory(DASHBOARD_GRID_TYPE),
  index: 0,
  depth: 1,
  editMode: false,
  availableColumnCount: 12,
  columnWidth: 50,
  onResizeStart: jest.fn(),
  onResize: jest.fn(),
  onResizeStop: jest.fn(),
  deleteComponent: jest.fn(),
  handleComponentDrop: jest.fn(),
  updateComponents: jest.fn(),
  ...overrides,
});

const setup = (
  props: Partial<IframeProps> = {},
  initialState: object = adminState,
) =>
  render(<Iframe {...baseProps(props)} />, {
    useRedux: true,
    useDnd: true,
    initialState,
  });

beforeEach(() => {
  mockedFeature.mockReturnValue(true);
  mockedFetch.mockResolvedValue(new Set<string>());
  mockedAdd.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
});

test('renders an iframe with the configured URL', () => {
  setup();
  const frame = screen.getByTitle('Embedded content');
  expect(frame).toHaveAttribute('src', 'https://example.com');
});

test('renders an empty placeholder when no URL is configured', () => {
  setup({ component: makeComponent('') });
  expect(screen.queryByTitle('Embedded content')).not.toBeInTheDocument();
  expect(screen.getByText('No URL configured')).toBeInTheDocument();
});

test('shows a URL input in edit mode and saves on blur', async () => {
  const updateComponents = jest.fn();
  setup({ editMode: true, updateComponents });
  const input = screen.getByTestId('dashboard-iframe-url-input');
  await userEvent.clear(input);
  await userEvent.type(input, 'https://new.example.com');
  fireEvent.blur(input);
  // The update is keyed by the component's own generated id, so assert on the
  // payload's single value rather than the key.
  await waitFor(() => expect(updateComponents).toHaveBeenCalledTimes(1));
  const updated = Object.values(updateComponents.mock.calls[0][0])[0] as {
    meta: { url: string };
  };
  expect(updated.meta.url).toBe('https://new.example.com');
});

test('flags a non-allowlisted domain and offers an Enable button for admins', async () => {
  mockedFetch.mockResolvedValue(new Set<string>());
  setup({ editMode: true });
  expect(
    await screen.findByText('This domain is not allowed to be embedded'),
  ).toBeInTheDocument();
  const enableButton = screen.getByTestId('dashboard-iframe-enable-csp');
  await userEvent.click(enableButton);
  expect(mockedAdd).toHaveBeenCalledWith('https://example.com');
});

test('does not flag a domain that is already allowlisted', async () => {
  mockedFetch.mockResolvedValue(new Set<string>(['https://example.com']));
  setup({ editMode: true });
  await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
  expect(
    screen.queryByText('This domain is not allowed to be embedded'),
  ).not.toBeInTheDocument();
});

test('hides the Enable button for users without the CSP permission', async () => {
  mockedFetch.mockResolvedValue(new Set<string>());
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
  // give any async effects a chance to run
  await waitFor(() => expect(mockedFetch).not.toHaveBeenCalled());
  expect(
    screen.queryByText('This domain is not allowed to be embedded'),
  ).not.toBeInTheDocument();
});
