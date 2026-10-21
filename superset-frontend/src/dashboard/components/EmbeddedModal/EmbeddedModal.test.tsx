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
  createStore,
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
import messageToastsReducer from 'src/components/MessageToasts/reducers';
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

test('populates the allowed-domains input from the API response', async () => {
  setup();

  const allowedDomainsInput = (await screen.findByRole('textbox', {
    name: /Allowed Domains/i,
  })) as HTMLInputElement;

  await waitFor(() => {
    expect(allowedDomainsInput.value).toBe('example.com');
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

const reviewResponse = {
  id: 61,
  asset_id: 1,
  review_required: true,
  message: 'Embedding change submitted for review. Nothing has been changed.',
};
const setMockApiReviewRequired = () => {
  (makeApi as any).mockReturnValue(jest.fn().mockResolvedValue(reviewResponse));
};
const toastTexts = (store: ReturnType<typeof createStore>) =>
  (
    store.getState() as unknown as { messageToasts: { text: string }[] }
  ).messageToasts.map(toast => toast.text);

test('enabling embedding that needs review shows the server message and stays un-embedded', async () => {
  setMockApiNotFound();
  const store = createStore({}, { messageToasts: messageToastsReducer });
  render(<DashboardEmbedModal {...defaultProps} />, {
    useRedux: true,
    store,
  });
  const enableEmbed = await screen.findByRole('button', {
    name: 'Enable embedding',
  });

  setMockApiReviewRequired();
  await userEvent.click(enableEmbed);

  await waitFor(() => expect(toastTexts(store)).toHaveLength(1));
  expect(toastTexts(store)[0]).toContain(reviewResponse.message);
  expect(toastTexts(store)[0]).toContain('/approvals/submitted-by-me');
  expect(
    screen.getByRole('button', { name: 'Enable embedding' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Deactivate' }),
  ).not.toBeInTheDocument();
});

test('deactivating embedding that needs review keeps it active and the modal open', async () => {
  const store = createStore({}, { messageToasts: messageToastsReducer });
  render(<DashboardEmbedModal {...defaultProps} />, {
    useRedux: true,
    store,
  });
  await userEvent.click(
    await screen.findByRole('button', { name: 'Deactivate' }),
  );
  await screen.findByText('Disable embedding?');

  setMockApiReviewRequired();
  await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

  await waitFor(() => expect(toastTexts(store)).toHaveLength(1));
  expect(toastTexts(store)[0]).toContain(reviewResponse.message);
  expect(mockOnHide).not.toHaveBeenCalled();
  // Still embedded: the config and its Deactivate button are unchanged.
  expect(
    await screen.findByRole('button', { name: 'Deactivate' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('Embedding deactivated.')).not.toBeInTheDocument();
});
