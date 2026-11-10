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

// The toasts these handlers raise are rendered by a container this test does
// not mount, so they are observed where they are raised instead.
const mockAddInfoToast = jest.fn();
const mockAddDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/withToasts', () => ({
  ...jest.requireActual<any>('src/components/MessageToasts/withToasts'),
  useToasts: () => ({
    addInfoToast: mockAddInfoToast,
    addDangerToast: mockAddDangerToast,
    addSuccessToast: jest.fn(),
    addWarningToast: jest.fn(),
  }),
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
/**
 * Makes the mocked `makeApi` run the component's own `processResponse` against
 * a `202`, so these tests exercise the real deferral handling rather than a
 * hand-written stand-in for it.
 */
const setMockApiDeferred = (
  body: Record<string, unknown> = { message: 'Held for review.' },
) => {
  (makeApi as any).mockImplementation((options: any) =>
    jest
      .fn()
      .mockImplementation(async () =>
        options.processResponse(body, new Response(null, { status: 202 })),
      ),
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

test('a deactivation the server accepts without applying leaves the embed active', async () => {
  // This is the one wrong success message in this file that is a security
  // problem rather than a cosmetic one: saying "Embedding deactivated" while
  // the embed is still reachable tells the operator an exposure is closed
  // when it is open.
  setup();

  await userEvent.click(
    await screen.findByRole('button', { name: 'Deactivate' }),
  );
  expect(await screen.findByText('Disable embedding?')).toBeInTheDocument();

  setMockApiDeferred({ message: 'Deactivation is awaiting review.' });
  await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

  await waitFor(() =>
    expect(mockAddInfoToast.mock.calls[0]?.[0]).toContain(
      'Deactivation is awaiting review.',
    ),
  );
  expect(mockAddInfoToast.mock.calls[0]?.[0]).not.toContain(
    'Embedding deactivated.',
  );
  // The panel still shows a live embed, because there still is one.
  expect(
    await screen.findByRole('button', { name: 'Deactivate' }),
  ).toBeInTheDocument();
  expect(mockOnHide).not.toHaveBeenCalled();
});

test('an enable the server accepts without applying advertises no embed', async () => {
  setMockApiNotFound();
  render(<DashboardEmbedModal {...defaultProps} />, { useRedux: true });

  const enableEmbed = await screen.findByRole('button', {
    name: 'Enable embedding',
  });

  setMockApiDeferred({ message: 'Embedding is awaiting review.' });
  await userEvent.click(enableEmbed);

  await waitFor(() =>
    expect(mockAddInfoToast.mock.calls[0]?.[0]).toContain(
      'Embedding is awaiting review.',
    ),
  );
  expect(mockAddInfoToast.mock.calls[0]?.[0]).not.toContain(
    'Changes saved.',
  );
  // No embed exists yet, so the modal must not show its configuration.
  expect(
    screen.queryByRole('button', { name: 'Deactivate' }),
  ).not.toBeInTheDocument();
});

test('a deferral with no message of its own falls back to the extensions wording', async () => {
  setMockApiNotFound();
  render(<DashboardEmbedModal {...defaultProps} />, { useRedux: true });

  const enableEmbed = await screen.findByRole('button', {
    name: 'Enable embedding',
  });

  setMockApiDeferred({});
  await userEvent.click(enableEmbed);

  await waitFor(() =>
    expect(mockAddInfoToast.mock.calls[0]?.[0]).toContain(
      'Changes saved. Viewers still see the live version.',
    ),
  );
});
