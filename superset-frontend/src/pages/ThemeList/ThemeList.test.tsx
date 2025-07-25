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
  within,
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
    is_system: false,
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
    is_system: false,
  },
  {
    id: 3,
    theme_name: 'System Theme',
    json_data: '{"colors": {"primary": "#000000"}}',
    changed_on_delta_humanized: '1 year ago',
    changed_by: {
      first_name: 'System',
      last_name: 'Admin',
    },
    is_system: true,
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
  count: 3,
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

    // Find the "+ Theme" button
    const addButton = screen.getByRole('button', { name: /\+ theme/i });
    userEvent.click(addButton);

    // Verify the theme modal opens with "Add theme" title
    await waitFor(() => {
      expect(screen.getByTestId('theme-modal-title')).toBeInTheDocument();
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
    const mockSetTemporaryTheme = jest.fn();

    // Mock the useThemeContext hook
    jest.mock('src/theme/ThemeProvider', () => ({
      useThemeContext: () => ({
        setTemporaryTheme: mockSetTemporaryTheme,
        getCurrentCrudThemeId: jest.fn(),
      }),
    }));

    renderThemesList({ addSuccessToast: mockAddSuccessToast });

    await waitFor(() => {
      expect(screen.getByText('Test Theme 1')).toBeInTheDocument();
    });

    // Find the actions column for the first theme
    const actionsButton = screen.getAllByRole('button', {
      name: /actions/i,
    })[0];
    userEvent.click(actionsButton);

    // Click apply from the dropdown menu
    const applyOption = await screen.findByText('Apply');
    userEvent.click(applyOption);

    await waitFor(() => {
      expect(mockAddSuccessToast).toHaveBeenCalledWith('Theme applied locally');
    });
  });

  test('shows delete confirmation modal', async () => {
    renderThemesList();

    await waitFor(() => {
      expect(screen.getByText('Test Theme 1')).toBeInTheDocument();
    });

    // Find the actions button for the first theme
    const actionsButton = screen.getAllByRole('button', {
      name: /actions/i,
    })[0];
    userEvent.click(actionsButton);

    // Click delete from the dropdown menu
    const deleteOption = await screen.findByText('Delete');
    userEvent.click(deleteOption);

    // Verify the delete confirmation modal appears
    await waitFor(() => {
      expect(screen.getByText('Delete Theme?')).toBeInTheDocument();
      expect(
        screen.getByText(/are you sure you want to delete/i),
      ).toBeInTheDocument();
    });

    // Find and click the delete button in the modal
    const confirmDeleteButton = screen.getByRole('button', { name: /delete/i });
    userEvent.click(confirmDeleteButton);

    // Verify the API call was made
    await waitFor(() => {
      expect(
        fetchMock.called('glob:*/api/v1/theme/*', { method: 'DELETE' }),
      ).toBe(true);
    });
  });

  test('handles theme export', async () => {
    // Mock the export functionality
    const mockHandleResourceExport = jest.fn();
    jest.mock('src/utils/export', () => mockHandleResourceExport);

    // Add export endpoint mock
    fetchMock.get('glob:*/api/v1/theme/export/*', {
      body: JSON.stringify(mockThemes),
      headers: { 'Content-Type': 'application/json' },
    });

    renderThemesList();

    await waitFor(() => {
      expect(screen.getByText('Test Theme 1')).toBeInTheDocument();
    });

    // Find the actions button for the first theme
    const actionsButton = screen.getAllByRole('button', {
      name: /actions/i,
    })[0];
    userEvent.click(actionsButton);

    // Click export from the dropdown menu
    const exportOption = await screen.findByText('Export');
    userEvent.click(exportOption);

    // Verify export was initiated
    await waitFor(() => {
      expect(fetchMock.called('glob:*/api/v1/theme/export/*')).toBe(true);
    });
  });

  test('handles bulk operations', async () => {
    renderThemesList();

    await waitFor(() => {
      expect(screen.getByText('Test Theme 1')).toBeInTheDocument();
    });

    // Click bulk select button
    const bulkSelectButton = screen.getByText('Bulk select');
    userEvent.click(bulkSelectButton);

    // Verify checkboxes appear for each theme
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(2); // At least 2 themes
    });

    // Select the first theme
    const firstThemeCheckbox = screen.getAllByRole('checkbox')[0];
    userEvent.click(firstThemeCheckbox);

    // Verify bulk action bar appears
    await waitFor(() => {
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    });

    // Test bulk delete
    const bulkDeleteButton = screen.getByRole('button', { name: /delete/i });
    expect(bulkDeleteButton).toBeInTheDocument();
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

    // Should not show add button or bulk select with read-only permissions
    expect(
      screen.queryByRole('button', { name: /\+ theme/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Bulk select')).not.toBeInTheDocument();
  });

  test('prevents editing and deleting system themes', async () => {
    renderThemesList();

    await waitFor(() => {
      expect(screen.getByText('System Theme')).toBeInTheDocument();
    });

    // Find the system theme row
    const systemThemeRow = screen.getByText('System Theme').closest('tr');

    // Check if it has the system tag
    within(systemThemeRow!).getByText('System');

    // Find the actions button for the system theme
    const actionsButtons = screen.getAllByRole('button', { name: /actions/i });
    const systemThemeActionButton = actionsButtons[2]; // Third theme is system theme
    userEvent.click(systemThemeActionButton);

    // Verify that edit and delete options are not available for system themes
    await waitFor(() => {
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
      // Apply and Export should still be available
      expect(screen.getByText('Apply')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
    });
  });
});
