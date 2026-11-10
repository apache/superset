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
import RestoreConfirmModal from './RestoreConfirmModal';
import { fetchDashboardRestoreRemovalCount } from './api';

jest.mock('./api', () => ({ fetchDashboardRestoreRemovalCount: jest.fn() }));
const fetchCount = jest.mocked(fetchDashboardRestoreRemovalCount);
const target = {
  versionUuid: 'saved',
  headline: 'Earlier version',
  issuedAt: '2026-07-01T00:00:00Z',
};
const props = {
  entityType: 'dashboard' as const,
  entityUuid: 'dashboard',
  target,
  isRestoring: false,
  onCancel: jest.fn(),
  onConfirm: jest.fn(),
};
beforeEach(() => {
  jest.clearAllMocks();
});

test('warns with the number of charts removed from the dashboard, not deleted', async () => {
  fetchCount.mockResolvedValue(2);
  render(<RestoreConfirmModal {...props} />);
  expect(
    await screen.findByText(
      'Restoring will remove 2 charts added after this version from this dashboard. The charts themselves will not be deleted.',
    ),
  ).toBeInTheDocument();
  expect(fetchCount).toHaveBeenCalledWith('dashboard', 'saved');
});

test('does not warn when no current members will be removed', async () => {
  fetchCount.mockResolvedValue(0);
  render(<RestoreConfirmModal {...props} />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Restore this version' }),
    ).toBeEnabled(),
  );
  expect(screen.queryByText(/Restoring will remove/)).not.toBeInTheDocument();
});

test('does not request dashboard membership for a chart restore', () => {
  render(<RestoreConfirmModal {...props} entityType="chart" />);
  expect(fetchCount).not.toHaveBeenCalled();
  expect(screen.queryByText(/Restoring will remove/)).not.toBeInTheDocument();
});

test('waits for the count before enabling confirmation', async () => {
  let finish: (count: number) => void = () => {};
  fetchCount.mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  render(<RestoreConfirmModal {...props} />);
  expect(
    screen.getByRole('button', { name: 'Restore this version' }),
  ).toBeDisabled();
  await act(async () => {
    finish(1);
  });
  expect(
    screen.getByText(
      'Restoring will remove 1 chart added after this version from this dashboard. The chart itself will not be deleted.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Restore this version' }),
  ).toBeEnabled();
});

test('warns that removal could not be checked when the read fails', async () => {
  fetchCount.mockRejectedValue(new Error('unavailable'));
  render(<RestoreConfirmModal {...props} />);
  expect(
    await screen.findByText(
      'Could not check which charts will be removed. Restoring may remove charts added after this version.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Restore this version' }),
  ).toBeEnabled();
});

test('ignores a late response for the previous target', async () => {
  let finishOld: (count: number) => void = () => {};
  fetchCount
    .mockReturnValueOnce(
      new Promise(resolve => {
        finishOld = resolve;
      }),
    )
    .mockResolvedValueOnce(0);
  const { rerender } = render(<RestoreConfirmModal {...props} />);
  rerender(
    <RestoreConfirmModal
      {...props}
      target={{ ...target, versionUuid: 'different' }}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Restore this version' }),
    ).toBeEnabled(),
  );
  await act(async () => {
    finishOld(99);
  });
  expect(
    screen.getByRole('button', { name: 'Restore this version' }),
  ).toBeEnabled();
  expect(screen.queryByText(/Restoring will remove/)).not.toBeInTheDocument();
});

test('checks membership again when the same target is reopened', async () => {
  fetchCount.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
  const { rerender } = render(<RestoreConfirmModal {...props} />);
  expect(
    await screen.findByText(/Restoring will remove 2 chart/),
  ).toBeInTheDocument();
  rerender(<RestoreConfirmModal {...props} target={null} />);
  rerender(<RestoreConfirmModal {...props} />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Restore this version' }),
    ).toBeEnabled(),
  );
  expect(fetchCount).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/Restoring will remove/)).not.toBeInTheDocument();
});
