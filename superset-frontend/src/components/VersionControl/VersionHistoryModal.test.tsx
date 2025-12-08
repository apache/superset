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
import { render, screen, waitFor, userEvent } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { VersionHistoryModal } from './VersionHistoryModal';

const defaultProps = {
  visible: true,
  assetType: 'dashboard' as const,
  assetId: 1,
  assetName: 'Test Dashboard',
  onCancel: jest.fn(),
};

const mockVersions = {
  result: {
    count: 2,
    versions: [
      {
        version_number: 2,
        description: 'Added new chart',
        created_by: 'admin',
        created_on: '2024-01-02T12:00:00Z',
        commit_sha: '',
      },
      {
        version_number: 1,
        description: 'Initial version',
        created_by: 'admin',
        created_on: '2024-01-01T12:00:00Z',
        commit_sha: '',
      },
    ],
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.reset();
});

afterEach(() => {
  fetchMock.restore();
});

test('renders modal with title', async () => {
  fetchMock.get('glob:*/api/v1/version/dashboard/1/list', mockVersions);

  render(<VersionHistoryModal {...defaultProps} />);

  expect(
    screen.getByText('Version History - Test Dashboard'),
  ).toBeInTheDocument();
});

test('loads and displays versions', async () => {
  fetchMock.get('glob:*/api/v1/version/dashboard/1/list', mockVersions);

  render(<VersionHistoryModal {...defaultProps} />);

  await waitFor(() => {
    expect(screen.getByText('Version 2')).toBeInTheDocument();
  });

  expect(screen.getByText('Added new chart')).toBeInTheDocument();
  expect(screen.getByText('Version 1')).toBeInTheDocument();
  expect(screen.getByText('Initial version')).toBeInTheDocument();
});

test('displays empty state when no versions exist', async () => {
  fetchMock.get('glob:*/api/v1/version/dashboard/1/list', {
    result: { count: 0, versions: [] },
  });

  render(<VersionHistoryModal {...defaultProps} />);

  await waitFor(() => {
    expect(
      screen.getByText(/No versions yet/),
    ).toBeInTheDocument();
  });
});

test('calls onCancel when close button is clicked', async () => {
  fetchMock.get('glob:*/api/v1/version/dashboard/1/list', mockVersions);
  const onCancel = jest.fn();

  render(<VersionHistoryModal {...defaultProps} onCancel={onCancel} />);

  await waitFor(() => {
    expect(screen.getByText('Version 2')).toBeInTheDocument();
  });

  // Get all Close buttons and click the one in the footer (last one)
  const closeButtons = screen.getAllByRole('button', { name: 'Close' });
  await userEvent.click(closeButtons[closeButtons.length - 1]);
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('shows save version modal when save button is clicked', async () => {
  fetchMock.get('glob:*/api/v1/version/dashboard/1/list', mockVersions);

  render(<VersionHistoryModal {...defaultProps} />);

  await waitFor(() => {
    expect(screen.getByText('Version 2')).toBeInTheDocument();
  });

  await userEvent.click(screen.getByRole('button', { name: 'Save Version' }));

  expect(screen.getByText('Save Version')).toBeInTheDocument();
  expect(screen.getByText(/Save a version of/)).toBeInTheDocument();
});

test('does not render when visible is false', () => {
  fetchMock.get('glob:*/api/v1/version/dashboard/1/list', mockVersions);

  render(<VersionHistoryModal {...defaultProps} visible={false} />);

  expect(
    screen.queryByText('Version History - Test Dashboard'),
  ).not.toBeInTheDocument();
});

test('shows restore button when a version is selected', async () => {
  fetchMock.get('glob:*/api/v1/version/dashboard/1/list', mockVersions);

  render(<VersionHistoryModal {...defaultProps} />);

  await waitFor(() => {
    expect(screen.getByText('Version 2')).toBeInTheDocument();
  });

  // Initially no restore button
  expect(
    screen.queryByRole('button', { name: 'Restore version' }),
  ).not.toBeInTheDocument();

  // Click on a version to select it
  await userEvent.click(screen.getByText('Version 1'));

  // Restore button should appear
  expect(
    screen.getByRole('button', { name: 'Restore version' }),
  ).toBeInTheDocument();
});

test('displays error when API call fails', async () => {
  fetchMock.get('glob:*/api/v1/version/dashboard/1/list', {
    status: 500,
    body: { message: 'Server error' },
  });

  render(<VersionHistoryModal {...defaultProps} />);

  await waitFor(() => {
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
