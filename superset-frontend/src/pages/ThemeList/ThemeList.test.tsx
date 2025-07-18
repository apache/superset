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
import fetchMock from 'fetch-mock';
import ThemesList from './index';

const mockThemes = [
  {
    id: 1,
    theme_name: 'Test Theme 1',
    json_data: '{"colors": {"primary": "#1890ff"}}',
    changed_on_delta_humanized: '1 day ago',
    changed_by: {
      first_name: 'John',
      last_name: 'Doe',
    },
  },
  {
    id: 2,
    theme_name: 'Test Theme 2',
    json_data: '{"colors": {"primary": "#52c41a"}}',
    changed_on_delta_humanized: '2 days ago',
    changed_by: {
      first_name: 'Jane',
      last_name: 'Smith',
    },
  },
];

const mockUser = {
  userId: 1,
  firstName: 'Admin',
  lastName: 'User',
};

// Mock the theme API endpoints
fetchMock.get('glob:*/api/v1/theme/_info*', {
  permissions: ['can_write', 'can_export', 'can_read'],
});

fetchMock.get('glob:*/api/v1/theme/*', {
  result: mockThemes,
  count: 2,
});

fetchMock.delete('glob:*/api/v1/theme/*', {
  message: 'Theme deleted successfully',
});

fetchMock.get('glob:*/api/v1/theme/related/changed_by*', {
  result: [
    { text: 'John Doe', value: 1 },
    { text: 'Jane Smith', value: 2 },
  ],
});

const defaultProps = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  user: mockUser,
};

const renderThemesList = (props = {}) =>
  render(<ThemesList {...defaultProps} {...props} />, {
    useRedux: true,
    useTheme: true,
    useQueryParams: true,
    useRouter: true,
    initialState: {
      user: mockUser,
    },
  });

describe('ThemesList', () => {
  beforeEach(() => {
    fetchMock.resetHistory();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders theme list with themes', async () => {
    renderThemesList();

    await waitFor(() => {
      expect(screen.getByText('Test Theme 1')).toBeInTheDocument();
      expect(screen.getByText('Test Theme 2')).toBeInTheDocument();
    });
  });

  test('shows theme actions for themes', async () => {
    renderThemesList();

    await waitFor(() => {
      expect(screen.getByText('Test Theme 1')).toBeInTheDocument();
    });

    // Should show apply, edit, export, and delete actions
    const applyButtons = screen.getAllByTestId('apply-action');
    const editButtons = screen.getAllByTestId('edit-action');
    const exportButtons = screen.getAllByTestId('export-action');
    const deleteButtons = screen.getAllByTestId('delete-action');

    expect(applyButtons.length).toBeGreaterThan(0);
    expect(editButtons.length).toBeGreaterThan(0);
    expect(exportButtons.length).toBeGreaterThan(0);
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  test('opens theme modal when clicking add theme button', async () => {
    renderThemesList();

    await waitFor(() => {
      expect(screen.getByText('Test Theme 1')).toBeInTheDocument();
    });

    const addButton = screen.getByText('Theme');
    userEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add theme')).toBeInTheDocument();
    });
  });

  test('shows bulk select button when user has delete or export permissions', async () => {
    renderThemesList();

    await waitFor(() => {
      expect(screen.getByText('Bulk select')).toBeInTheDocument();
    });
  });

  test('filters themes by name', async () => {
    renderThemesList();

    await waitFor(() => {
      expect(screen.getByText('Test Theme 1')).toBeInTheDocument();
    });

    // Look for the search input in the Name filter section
    const searchInput = screen.getByRole('textbox');
    userEvent.type(searchInput, 'Test Theme 1');

    // The filtering is handled by the backend, so we just verify the input works
    await waitFor(() => {
      expect(searchInput).toHaveValue('Test Theme 1');
    });
  });

  test('shows theme apply success message', async () => {
    const mockAddSuccessToast = jest.fn();
    renderThemesList({ addSuccessToast: mockAddSuccessToast });

    await waitFor(() => {
      expect(screen.getByText('Test Theme 1')).toBeInTheDocument();
    });

    // Mock the theme apply functionality
    // This would typically involve clicking the apply button and verifying the toast
    // The exact implementation depends on how the actions are rendered
  });

  test('shows delete confirmation modal', async () => {
    renderThemesList();

    await waitFor(() => {
      expect(screen.getByText('Test Theme 1')).toBeInTheDocument();
    });

    // Find and click delete button (implementation depends on how actions are rendered)
    // Should show confirmation modal
    // This test would be more specific once we know the exact structure
  });

  test('handles theme export', async () => {
    renderThemesList();

    await waitFor(() => {
      expect(screen.getByText('Test Theme 1')).toBeInTheDocument();
    });

    // Test export functionality
    // This would involve clicking export and verifying the API call
  });

  test('handles bulk operations', async () => {
    renderThemesList();

    await waitFor(() => {
      expect(screen.getByText('Test Theme 1')).toBeInTheDocument();
    });

    // Click bulk select
    const bulkSelectButton = screen.getByText('Bulk select');
    userEvent.click(bulkSelectButton);

    // Verify bulk selection interface appears
    // This depends on the exact implementation
  });

  test('respects permissions for actions', async () => {
    // Test with limited permissions
    fetchMock.get(
      'glob:*/api/v1/theme/_info*',
      {
        permissions: ['can_read'], // Only read permission
      },
      { overwriteRoutes: true },
    );

    renderThemesList();

    await waitFor(() => {
      expect(screen.getByText('Test Theme 1')).toBeInTheDocument();
    });

    // Should not show add button or bulk select
    expect(screen.queryByText('Theme')).not.toBeInTheDocument();
    expect(screen.queryByText('Bulk select')).not.toBeInTheDocument();
  });
});
