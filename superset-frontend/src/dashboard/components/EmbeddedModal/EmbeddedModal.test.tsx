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

import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react';
import { render, screen } from 'spec/helpers/testing-library';
import '@testing-library/jest-dom';
import {
  SupersetApiError,
  getExtensionsRegistry,
  makeApi,
} from '@superset-ui/core';
import setupExtensions from 'src/setup/setupExtensions';
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

it('renders', async () => {
  setup();
  await waitFor(() => {
    expect(screen.getByText('Embed')).toBeInTheDocument();
  });
});

it('displays loading state', async () => {
  setup();
  await waitFor(() => {
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});

it('renders the modal default content', async () => {
  render(<DashboardEmbedModal {...defaultProps} />, { useRedux: true });
  await waitFor(() => {
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(/Allowed Domains/, 'i')),
    ).toBeInTheDocument();
  });
});

it('renders the correct actions when dashboard is ready to embed', async () => {
  setup();
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Deactivate' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save changes' }),
    ).toBeInTheDocument();
  });
});

it('renders the correct actions when dashboard is not ready to embed', async () => {
  setMockApiNotFound();
  setup();
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Enable embedding' }),
    ).toBeInTheDocument();
  });
});

it('enables embedding', async () => {
  setMockApiNotFound();
  setup();

  await waitFor(() => {
    const enableEmbed = screen.getByRole('button', {
      name: 'Enable embedding',
    });
    expect(enableEmbed).toBeInTheDocument();
    fireEvent.click(enableEmbed);
  });

  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Deactivate' }),
    ).toBeInTheDocument();
  });
});

it('shows and hides the confirmation modal on deactivation', async () => {
  setup();

  await waitFor(() => {
    const deactivate = screen.getByRole('button', { name: 'Deactivate' });
    fireEvent.click(deactivate);
  });

  await waitFor(() => {
    expect(screen.getByText('Disable embedding?')).toBeInTheDocument();
    expect(
      screen.getByText('This will remove your current embed configuration.'),
    ).toBeInTheDocument();
  });

  const okBtn = screen.getByRole('button', { name: 'OK' });
  fireEvent.click(okBtn);

  await waitFor(() => {
    expect(screen.queryByText('Disable embedding?')).not.toBeInTheDocument();
  });
});

it('enables the "Save Changes" button', async () => {
  setup();

  await waitFor(() => {
    const allowedDomainsInput = screen.getByLabelText(
      new RegExp(/Allowed Domains/, 'i'),
    );
    const saveChangesBtn = screen.getByRole('button', { name: 'Save changes' });

    expect(saveChangesBtn).toBeDisabled();
    expect(allowedDomainsInput).toBeInTheDocument();

    fireEvent.change(allowedDomainsInput, { target: { value: 'test.com' } });
    expect(saveChangesBtn).toBeEnabled();
  });
});

it('adds extension to DashboardEmbedModal', async () => {
  const extensionsRegistry = getExtensionsRegistry();

  extensionsRegistry.set('embedded.modal', () => (
    <>dashboard.embed.modal.extension component</>
  ));

  setupExtensions();
  setup();

  await waitFor(() => {
    expect(
      screen.getByText('dashboard.embed.modal.extension component'),
    ).toBeInTheDocument();
  });
});
