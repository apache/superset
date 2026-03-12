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
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import {
  SupersetApiError,
  getExtensionsRegistry,
  makeApi,
} from '@superset-ui/core';
import setupCodeOverrides from 'src/setup/setupCodeOverrides';
import DashboardEmbedModal from '.';

const defaultResponse = {
  result: { uuid: 'uuid', dashboard_id: '1', allowed_domains: ['example.com'] },
};

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual<any>('@superset-ui/core'),
  makeApi: jest.fn(),
}));

const mockOnHide = jest.fn();
const defaultProps = {
  dashboardId: '1',
  show: true,
  onHide: mockOnHide,
};
const resetMockApi = () => {
  (makeApi as any).mockReturnValue(
    jest.fn().mockResolvedValue(defaultResponse),
  );
};
const setMockApiNotFound = () => {
  const notFound = new SupersetApiError({ message: 'Not found', status: 404 });
  (makeApi as any).mockReturnValue(jest.fn().mockRejectedValue(notFound));
};

const setup = () => {
  render(<DashboardEmbedModal {...defaultProps} />, { useRedux: true });
};

beforeEach(() => {
  jest.clearAllMocks();
  resetMockApi();
  getExtensionsRegistry().set('embedded.modal', undefined);
});

test('renders the embed modal', async () => {
  setup();
  expect(await screen.findByText('Embed')).toBeInTheDocument();
});

test('renders loading state', async () => {
  setup();
  await waitFor(() => {
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});

test('renders modal content with settings', async () => {
  setup();
  expect(await screen.findByText('Settings')).toBeInTheDocument();
  expect(
    screen.getByText(new RegExp(/Allowed Domains/, 'i')),
  ).toBeInTheDocument();
});

test('shows Deactivate and Save changes buttons when ready to embed', async () => {
  setup();
  expect(
    await screen.findByRole('button', { name: 'Deactivate' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Save changes' }),
  ).toBeInTheDocument();
});

test('shows Enable embedding button when not ready to embed', async () => {
  setMockApiNotFound();
  render(<DashboardEmbedModal {...defaultProps} />, { useRedux: true });
  expect(
    await screen.findByRole('button', { name: 'Enable embedding' }),
  ).toBeInTheDocument();
});

test('enables embedding when Enable embedding button is clicked', async () => {
  setMockApiNotFound();
  render(<DashboardEmbedModal {...defaultProps} />, { useRedux: true });

  const enableEmbed = await screen.findByRole('button', {
    name: 'Enable embedding',
  });
  expect(enableEmbed).toBeInTheDocument();

  resetMockApi();
  await userEvent.click(enableEmbed);

  expect(
    await screen.findByRole('button', { name: 'Deactivate' }),
  ).toBeInTheDocument();
});

test('shows and hides confirmation alert when deactivating', async () => {
  setup();

  const deactivate = await screen.findByRole('button', { name: 'Deactivate' });
  await userEvent.click(deactivate);

  expect(await screen.findByText('Disable embedding?')).toBeInTheDocument();
  expect(
    screen.getByText('This will remove your current embed configuration.'),
  ).toBeInTheDocument();

  const confirmBtn = screen.getByRole('button', { name: 'Deactivate' });
  await userEvent.click(confirmBtn);

  await waitFor(() => {
    expect(screen.queryByText('Disable embedding?')).not.toBeInTheDocument();
  });
});

test('enables Save Changes button when allowed domains are modified', async () => {
  setup();

  const allowedDomainsInput = await screen.findByRole('textbox', {
    name: /Allowed Domains/i,
  });

  const saveChangesBtn = screen.getByRole('button', { name: 'Save changes' });

  expect(saveChangesBtn).toBeDisabled();
  expect(allowedDomainsInput).toBeInTheDocument();

  await userEvent.clear(allowedDomainsInput);
  await userEvent.type(allowedDomainsInput, 'test.com');
  expect(saveChangesBtn).toBeEnabled();
});

test('renders extension component when registered', async () => {
  const extensionsRegistry = getExtensionsRegistry();

  extensionsRegistry.set('embedded.modal', () => (
    <>dashboard.embed.modal.extension component</>
  ));

  setupCodeOverrides();
  setup();

  expect(
    await screen.findByText('dashboard.embed.modal.extension component'),
  ).toBeInTheDocument();

  extensionsRegistry.set('embedded.modal', undefined);
});
