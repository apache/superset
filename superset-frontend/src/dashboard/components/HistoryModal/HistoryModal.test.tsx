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
import { screen, waitFor, within } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { render } from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import { Modal } from '@superset-ui/core/components';
import HistoryModal from '.';

const addSuccessToast = jest.fn();
const addDangerToast = jest.fn();
const onHide = jest.fn();
const onRestore = jest.fn();

const defaultProps = {
  dashboardId: 1,
  show: true,
  onHide,
  onRestore,
  addSuccessToast,
  addDangerToast,
};

const mockVersions = {
  result: [
    {
      id: 10,
      version_number: 2,
      comment: 'Second version',
      created_at: '2024-01-02T12:00:00Z',
      created_by: 'admin',
    },
    {
      id: 9,
      version_number: 1,
      comment:
        'A long description that exceeds the truncation limit of one hundred fifty characters so we can test the show more and show less behavior for the version history modal display.',
      created_at: '2024-01-01T12:00:00Z',
      created_by: null,
    },
  ],
};

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockGet = SupersetClient.get as jest.Mock;
const mockPost = SupersetClient.post as jest.Mock;

let capturedConfirmConfig: { onOk?: () => void | Promise<unknown> } | null =
  null;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({ json: { result: [] } });
  capturedConfirmConfig = null;
  jest.spyOn(Modal, 'confirm').mockImplementation((config: object) => {
    capturedConfirmConfig = config as {
      onOk?: () => void | Promise<unknown>;
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders empty state when no versions', async () => {
  render(<HistoryModal {...defaultProps} />, { useTheme: true });

  await waitFor(() => {
    expect(mockGet).toHaveBeenCalledWith({
      endpoint: '/api/v1/dashboard/1/versions',
      signal: expect.any(AbortSignal),
    });
  });

  expect(
    screen.getByText(
      /No version history yet. Versions are created when you save/,
    ),
  ).toBeInTheDocument();
});

test('renders version list with metadata', async () => {
  mockGet.mockResolvedValue({ json: mockVersions });

  render(<HistoryModal {...defaultProps} />, { useTheme: true });

  await waitFor(() => {
    expect(screen.getByText('Version 2')).toBeInTheDocument();
  });

  expect(screen.getByText('Version 1')).toBeInTheDocument();
  expect(screen.getByText('Second version')).toBeInTheDocument();
  expect(screen.getByText(/admin/)).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /Restore/ })).toHaveLength(2);
});

test('show more and show less toggle long description', async () => {
  mockGet.mockResolvedValue({ json: mockVersions });

  render(<HistoryModal {...defaultProps} />, { useTheme: true });

  await waitFor(() => {
    expect(screen.getByText('Version 1')).toBeInTheDocument();
  });

  const dialog = screen.getByRole('dialog', { name: /Dashboard history/i });
  const showMore = within(dialog).getByRole('button', { name: /Show more/i });
  expect(showMore).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(showMore);

  const showLess = within(dialog).getByRole('button', { name: /Show less/i });
  expect(showLess).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(showLess);

  expect(
    within(dialog).getByRole('button', { name: /Show more/i }),
  ).toBeInTheDocument();
});

test('shows loading state then content', async () => {
  let resolveGet: (value: { json: { result: unknown[] } }) => void;
  mockGet.mockImplementation(
    () =>
      new Promise(resolve => {
        resolveGet = resolve;
      }),
  );

  render(<HistoryModal {...defaultProps} />, { useTheme: true });

  expect(screen.getByLabelText('Loading')).toBeInTheDocument();

  resolveGet!({ json: { result: [] } });
  await waitFor(() => {
    expect(screen.getByText(/No version history yet/)).toBeInTheDocument();
  });
});

test('fetch error calls addDangerToast', async () => {
  mockGet.mockRejectedValue(new Error('Network error'));

  render(<HistoryModal {...defaultProps} />, { useTheme: true });

  await waitFor(() => {
    expect(addDangerToast).toHaveBeenCalled();
  });
});

test('restore calls POST and onHide and onRestore on success without reload when onRestore provided', async () => {
  mockGet.mockResolvedValue({ json: mockVersions });
  mockPost.mockResolvedValue({});
  const reloadMock = jest.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: reloadMock },
    writable: true,
  });

  render(<HistoryModal {...defaultProps} />, { useTheme: true });

  await waitFor(() => {
    expect(screen.getByText('Version 2')).toBeInTheDocument();
  });

  const historyDialog = screen.getByRole('dialog', {
    name: /Dashboard history/i,
  });
  const restoreButtons = within(historyDialog).getAllByRole('button', {
    name: /Restore/,
  });
  await userEvent.click(restoreButtons[0]);

  expect(capturedConfirmConfig).not.toBeNull();
  await capturedConfirmConfig!.onOk!();

  expect(mockPost).toHaveBeenCalledWith({
    endpoint: '/api/v1/dashboard/1/restore/10',
  });
  expect(addSuccessToast).toHaveBeenCalledWith('Dashboard restored');
  expect(onHide).toHaveBeenCalled();
  expect(onRestore).toHaveBeenCalled();
  expect(reloadMock).not.toHaveBeenCalled();
});

test('restore calls window.location.reload when onRestore is not provided', async () => {
  mockGet.mockResolvedValue({ json: mockVersions });
  mockPost.mockResolvedValue({});
  const reloadMock = jest.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: reloadMock },
    writable: true,
  });

  render(<HistoryModal {...defaultProps} onRestore={undefined} />, {
    useTheme: true,
  });

  await waitFor(() => {
    expect(screen.getByText('Version 2')).toBeInTheDocument();
  });

  const historyDialog = screen.getByRole('dialog', {
    name: /Dashboard history/i,
  });
  const restoreButtons = within(historyDialog).getAllByRole('button', {
    name: /Restore/,
  });
  await userEvent.click(restoreButtons[0]);

  expect(capturedConfirmConfig).not.toBeNull();
  await capturedConfirmConfig!.onOk!();

  expect(onHide).toHaveBeenCalled();
  expect(reloadMock).toHaveBeenCalled();
});

test('restore failure calls addDangerToast and re-enables restore button', async () => {
  mockGet.mockResolvedValue({ json: mockVersions });
  mockPost.mockRejectedValue(new Error('Restore failed'));

  render(<HistoryModal {...defaultProps} />, { useTheme: true });

  await waitFor(() => {
    expect(screen.getByText('Version 2')).toBeInTheDocument();
  });

  const historyDialog = screen.getByRole('dialog', {
    name: /Dashboard history/i,
  });
  const restoreButtons = within(historyDialog).getAllByRole('button', {
    name: /Restore/,
  });
  await userEvent.click(restoreButtons[0]);

  expect(capturedConfirmConfig).not.toBeNull();
  await capturedConfirmConfig!.onOk!().catch(() => {});

  await waitFor(() => {
    expect(addDangerToast).toHaveBeenCalled();
  });

  const restoreBtn = within(historyDialog).getAllByRole('button', {
    name: /Restore/,
  })[0];
  expect(restoreBtn).not.toBeDisabled();
});

test('Close button calls onHide', async () => {
  mockGet.mockResolvedValue({ json: { result: [] } });

  render(<HistoryModal {...defaultProps} />, { useTheme: true });

  await waitFor(() => {
    expect(screen.getByText(/No version history yet/)).toBeInTheDocument();
  });

  const dialog = screen.getByRole('dialog');
  const closeButtons = within(dialog).getAllByRole('button', { name: /Close/ });
  await userEvent.click(
    closeButtons.find(b => b.className.includes('superset-button')) ??
      closeButtons[0],
  );
  expect(onHide).toHaveBeenCalled();
});
