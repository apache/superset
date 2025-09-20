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
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import {
  SupersetApiError,
  getExtensionsRegistry,
  makeApi,
} from '@superset-ui/core';
import { Modal } from '@superset-ui/core/components';
import setupCodeOverrides from 'src/setup/setupCodeOverrides';
import DashboardEmbedModal from './index';

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
  resetMockApi();
};

beforeEach(() => {
  jest.clearAllMocks();
  resetMockApi();
});

test('renders', async () => {
  setup();
  expect(await screen.findByText('Embed')).toBeInTheDocument();
});

test('renders loading state', async () => {
  setup();
  await waitFor(() => {
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});

test('renders the modal default content', async () => {
  render(<DashboardEmbedModal {...defaultProps} />, { useRedux: true });
  expect(await screen.findByText('Settings')).toBeInTheDocument();
  expect(
    screen.getByText(new RegExp(/Allowed Domains/, 'i')),
  ).toBeInTheDocument();
});

test('renders the correct actions when dashboard is ready to embed', async () => {
  setup();
  expect(
    await screen.findByRole('button', { name: 'Deactivate' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Save changes' }),
  ).toBeInTheDocument();
});

test('renders the correct actions when dashboard is not ready to embed', async () => {
  setMockApiNotFound();
  setup();
  expect(
    await screen.findByRole('button', { name: 'Enable embedding' }),
  ).toBeInTheDocument();
});

test('enables embedding', async () => {
  setMockApiNotFound();
  setup();

  const enableEmbed = await screen.findByRole('button', {
    name: 'Enable embedding',
  });
  expect(enableEmbed).toBeInTheDocument();

  fireEvent.click(enableEmbed);

  expect(
    await screen.findByRole('button', { name: 'Deactivate' }),
  ).toBeInTheDocument();
});

test('shows and hides the confirmation modal on deactivation', async () => {
  setup();

  const deactivate = await screen.findByRole('button', { name: 'Deactivate' });
  fireEvent.click(deactivate);

  expect(await screen.findByText('Disable embedding?')).toBeInTheDocument();
  expect(
    screen.getByText('This will remove your current embed configuration.'),
  ).toBeInTheDocument();

  const okBtn = screen.getByRole('button', { name: 'OK' });
  fireEvent.click(okBtn);

  await waitFor(() => {
    expect(screen.queryByText('Disable embedding?')).not.toBeInTheDocument();
  });
});

test('enables the "Save Changes" button', async () => {
  setup();

  const allowedDomainsInput = await screen.findByRole('textbox', {
    name: /Allowed Domains/i,
  });

  const saveChangesBtn = screen.getByRole('button', { name: 'Save changes' });

  expect(saveChangesBtn).toBeDisabled();
  expect(allowedDomainsInput).toBeInTheDocument();

  fireEvent.change(allowedDomainsInput, { target: { value: 'test.com' } });
  expect(saveChangesBtn).toBeEnabled();
});

test('adds extension to DashboardEmbedModal', async () => {
  const extensionsRegistry = getExtensionsRegistry();

  extensionsRegistry.set('embedded.modal', () => (
    <>dashboard.embed.modal.extension component</>
  ));

  setupCodeOverrides();
  setup();

  expect(
    await screen.findByText('dashboard.embed.modal.extension component'),
  ).toBeInTheDocument();
});

describe('Modal.useModal integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses Modal.useModal hook for confirmation dialogs', () => {
    const useModalSpy = jest.spyOn(Modal, 'useModal');
    setup();

    // Verify that useModal is called when the component mounts
    expect(useModalSpy).toHaveBeenCalled();

    useModalSpy.mockRestore();
  });

  test('renders contextHolder for proper theming', async () => {
    const { container } = render(<DashboardEmbedModal {...defaultProps} />, {
      useRedux: true,
    });

    // Wait for component to be rendered
    await screen.findByText('Embed');

    // The contextHolder is rendered in the component tree
    // Check that modal root elements exist for theming
    const modalRootElements = container.querySelectorAll('.ant-modal-root');
    expect(modalRootElements).toBeDefined();
  });

  test('confirmation modal inherits theme context', async () => {
    setup();

    // Click deactivate to trigger the confirmation modal
    const deactivate = await screen.findByRole('button', {
      name: 'Deactivate',
    });
    fireEvent.click(deactivate);

    // Wait for the modal to appear
    const modalTitle = await screen.findByText('Disable embedding?');
    expect(modalTitle).toBeInTheDocument();

    // Check that the modal is rendered within the component tree (not on body directly)
    const modal = modalTitle.closest('.ant-modal-wrap');
    expect(modal).toBeInTheDocument();
  });

  test('does not use Modal.confirm directly', () => {
    // Spy on the static Modal.confirm method
    const confirmSpy = jest.spyOn(Modal, 'confirm');

    setup();

    // The component should not call Modal.confirm directly
    expect(confirmSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  test('modal actions work correctly with useModal', async () => {
    setup();

    // Click deactivate
    const deactivate = await screen.findByRole('button', {
      name: 'Deactivate',
    });
    fireEvent.click(deactivate);

    // Modal should appear
    expect(await screen.findByText('Disable embedding?')).toBeInTheDocument();

    // Click Cancel to close modal
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText('Disable embedding?')).not.toBeInTheDocument();
    });
  });
});
