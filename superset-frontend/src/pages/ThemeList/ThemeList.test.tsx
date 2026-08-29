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
import * as hooks from 'src/views/CRUD/hooks';
import { useThemeContext } from 'src/theme/ThemeProvider';
import { isUserEditorOrAdmin } from 'src/dashboard/util/permissionUtils';
import ThemesList from './index';

jest.mock('src/dashboard/util/permissionUtils', () => ({
  ...jest.requireActual('src/dashboard/util/permissionUtils'),
  isUserEditorOrAdmin: jest.fn(() => false),
}));

// Mock the getBootstrapData function
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({
    common: {
      theme: {
        enableUiThemeAdministration: true,
      },
    },
    user: {
      userId: 1,
      username: 'admin',
      roles: {
        Admin: [['can_write', 'Theme']],
      },
    },
  }),
}));

// Mock theme API functions
jest.mock('src/features/themes/api', () => ({
  setSystemDefaultTheme: jest.fn(() => Promise.resolve()),
  setSystemDarkTheme: jest.fn(() => Promise.resolve()),
  unsetSystemDefaultTheme: jest.fn(() => Promise.resolve()),
  unsetSystemDarkTheme: jest.fn(() => Promise.resolve()),
}));

// Mock the CRUD hooks
jest.mock('src/views/CRUD/hooks', () => ({
  ...jest.requireActual('src/views/CRUD/hooks'),
  useListViewResource: jest.fn(),
}));

// Mock the useThemeContext hook
const mockSetTemporaryTheme = jest.fn();
const mockGetAppliedThemeId = jest.fn();
jest.mock('src/theme/ThemeProvider', () => ({
  ...jest.requireActual('src/theme/ThemeProvider'),
  useThemeContext: jest.fn(),
}));

const mockThemes = [
  {
    id: 1,
    theme_name: 'Light Theme',
    is_system_default: true,
    is_system_dark: false,
    is_system: false,
    json_data: '{"colors": {"primary": "#ffffff"}}',
    created_by: { id: 1, first_name: 'Admin', last_name: 'User' },
    changed_on_delta_humanized: '1 day ago',
    changed_by: {
      first_name: 'Admin',
      last_name: 'User',
    },
  },
  {
    id: 2,
    theme_name: 'Dark Theme',
    is_system_default: false,
    is_system_dark: true,
    is_system: true,
    json_data: '{"colors": {"primary": "#1890ff"}}',
    created_by: { id: 1, first_name: 'Admin', last_name: 'User' },
    changed_on_delta_humanized: '2 days ago',
    changed_by: {
      first_name: 'John',
      last_name: 'Doe',
    },
  },
  {
    id: 3,
    theme_name: 'Custom Theme',
    is_system_default: false,
    is_system_dark: false,
    is_system: false,
    json_data: '{"algorithm": "default", "colors": {"primary": "#52c41a"}}',
    created_by: { id: 2, first_name: 'Test', last_name: 'User' },
    changed_on_delta_humanized: '3 days ago',
    changed_by: {
      first_name: 'Test',
      last_name: 'User',
    },
  },
];

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
};

const themesInfoEndpoint = 'glob:*/api/v1/theme/_info*';
const themesEndpoint = 'glob:*/api/v1/theme/?*';
const themeEndpoint = 'glob:*/api/v1/theme/*';

const mockRefreshData = jest.fn();

beforeEach(() => {
  // Mock the useListViewResource hook
  (hooks.useListViewResource as jest.Mock).mockReturnValue({
    state: {
      loading: false,
      resourceCollection: mockThemes,
      resourceCount: 3,
      bulkSelectEnabled: false,
    },
    setResourceCollection: jest.fn(),
    hasPerm: jest.fn().mockReturnValue(true),
    refreshData: mockRefreshData,
    fetchData: jest.fn(),
    toggleBulkSelect: jest.fn(),
  });

  // Mock useThemeContext
  mockGetAppliedThemeId.mockReturnValue(null);
  (useThemeContext as jest.Mock).mockReturnValue({
    getCurrentCrudThemeId: jest.fn().mockReturnValue('1'),
    appliedTheme: { theme_name: 'Light Theme', id: 1 },
    setTemporaryTheme: mockSetTemporaryTheme,
    hasDevOverride: jest.fn().mockReturnValue(false),
    getAppliedThemeId: mockGetAppliedThemeId,
  });

  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(themesInfoEndpoint, {
    permissions: ['can_read', 'can_write', 'can_export'],
  });
  fetchMock.get(themesEndpoint, {
    ids: [1, 2, 3],
    count: 3,
    result: mockThemes,
  });
  fetchMock.delete(themeEndpoint, {});
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  jest.clearAllMocks();
});

test('renders themes list with all theme names', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await waitFor(() => {
    expect(screen.getByText('Light Theme')).toBeInTheDocument();
    expect(screen.getByText('Dark Theme')).toBeInTheDocument();
    expect(screen.getByText('Custom Theme')).toBeInTheDocument();
  });
});

test('shows system tag for system themes', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Dark Theme');

  expect(screen.getByText('System')).toBeInTheDocument();
});

test('shows default tag for system default theme', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Light Theme');

  expect(screen.getByText('Default')).toBeInTheDocument();
});

test('shows dark tag for system dark theme', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Dark Theme');

  expect(screen.getByText('Dark')).toBeInTheDocument();
});

test('shows apply action button for all themes', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Custom Theme');

  const applyButtons = await screen.findAllByTestId('apply-action');
  expect(applyButtons.length).toBe(3);
});

test('shows delete button only for non-system themes', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Custom Theme');

  const deleteButtons = await screen.findAllByTestId('delete-action');
  // Should have delete buttons for Light Theme and Custom Theme (not Dark Theme which is system)
  expect(deleteButtons.length).toBe(2);
});

test('shows set default action for non-default themes', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Custom Theme');

  const setDefaultButtons = await screen.findAllByTestId('set-default-action');
  // Should have set default buttons for Dark Theme and Custom Theme (not Light Theme which is already default)
  expect(setDefaultButtons.length).toBe(2);
});

test('shows unset default action for system default theme', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Light Theme');

  const unsetDefaultButtons = await screen.findAllByTestId(
    'unset-default-action',
  );
  expect(unsetDefaultButtons.length).toBe(1);
});

test('shows set dark action for non-dark themes', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Custom Theme');

  const setDarkButtons = await screen.findAllByTestId('set-dark-action');
  // Should have set dark buttons for Light Theme and Custom Theme (not Dark Theme which is already dark)
  expect(setDarkButtons.length).toBe(2);
});

test('warns when setting a light theme as the system dark theme', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Custom Theme');

  // Custom Theme declares the light algorithm; Light Theme declares none
  const setDarkButtons = await screen.findAllByTestId('set-dark-action');
  await userEvent.click(setDarkButtons[1]);

  expect(
    await screen.findByText(/This theme uses the light algorithm/),
  ).toBeInTheDocument();
});

test('shows unset dark action for system dark theme', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Dark Theme');

  const unsetDarkButtons = await screen.findAllByTestId('unset-dark-action');
  expect(unsetDarkButtons.length).toBe(1);
});

test('shows export action for all themes when user has permission', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Custom Theme');

  const exportButtons = await screen.findAllByTestId('export-action');
  expect(exportButtons.length).toBe(3);
});

test('shows edit action for all themes when user has permission', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Custom Theme');

  const editButtons = await screen.findAllByTestId('edit-action');
  expect(editButtons.length).toBe(3);
});

test('renders an Editors column with a subject pile for each theme', async () => {
  const themesWithEditors = mockThemes.map(theme => ({
    ...theme,
    editors: [{ id: 10, label: 'Jane Doe', type: 1 }],
  }));
  (hooks.useListViewResource as jest.Mock).mockReturnValue({
    state: {
      loading: false,
      resourceCollection: themesWithEditors,
      resourceCount: 3,
      bulkSelectEnabled: false,
    },
    setResourceCollection: jest.fn(),
    hasPerm: jest.fn().mockReturnValue(true),
    refreshData: mockRefreshData,
    fetchData: jest.fn(),
    toggleBulkSelect: jest.fn(),
  });

  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Custom Theme');

  // The Editors column header is present...
  expect(screen.getAllByText('Editors').length).toBeGreaterThan(0);
  // ...and the SubjectPile renders an avatar with the editor's initials.
  expect(await screen.findAllByText('JD')).not.toHaveLength(0);
});

test('passes extra_editors from each row to the editorship check', async () => {
  // A user may be granted editorship of a theme solely through a
  // deployment's EXTRA_EDITORS_RESOLVER (surfaced by the API as
  // `extra_editors` on each row), not just the persisted `editors` list.
  // The row action must factor that in the same way ThemeModal does, or
  // such a user sees a read-only 'View' action despite the API allowing
  // them to save.
  (isUserEditorOrAdmin as jest.Mock).mockClear();
  const themesWithExtraEditors = mockThemes.map(theme => ({
    ...theme,
    extra_editors: [42],
  }));
  (hooks.useListViewResource as jest.Mock).mockReturnValue({
    state: {
      loading: false,
      resourceCollection: themesWithExtraEditors,
      resourceCount: 3,
      bulkSelectEnabled: false,
    },
    setResourceCollection: jest.fn(),
    hasPerm: jest.fn().mockReturnValue(true),
    refreshData: mockRefreshData,
    fetchData: jest.fn(),
    toggleBulkSelect: jest.fn(),
  });

  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Custom Theme');

  await waitFor(() => {
    expect(isUserEditorOrAdmin).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      [42],
    );
  });
});

test('shows bulk select button when user has permissions', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Themes');

  expect(screen.getByText('Bulk select')).toBeInTheDocument();
});

test('shows create theme button when user has permissions', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Themes');

  const addButton = screen.getByLabelText('plus');
  expect(addButton).toBeInTheDocument();
});

test('clicking apply button calls setTemporaryTheme with parsed theme data and ID', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Custom Theme');

  const applyButtons = await screen.findAllByTestId('apply-action');

  // Click the first apply button (Light Theme)
  await userEvent.click(applyButtons[0]);

  await waitFor(() => {
    expect(mockSetTemporaryTheme).toHaveBeenCalledWith(
      {
        colors: { primary: '#ffffff' },
      },
      1, // theme ID
    );
  });
});

test('applying a local theme calls setTemporaryTheme with theme ID', async () => {
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  await screen.findByText('Custom Theme');

  // Find and click the apply button for the first theme
  const applyButtons = await screen.findAllByTestId('apply-action');
  await userEvent.click(applyButtons[0]);

  // Check that setTemporaryTheme was called with both theme config and ID
  await waitFor(() => {
    expect(mockSetTemporaryTheme).toHaveBeenCalledWith(
      { colors: { primary: '#ffffff' } },
      1, // theme ID
    );
  });
});

test('component loads successfully with applied theme ID set', async () => {
  // This test verifies that having a stored theme ID doesn't break the component
  // Mock hasDevOverride to return true since we have a dev override set
  mockGetAppliedThemeId.mockReturnValue(1);
  (useThemeContext as jest.Mock).mockReturnValue({
    getCurrentCrudThemeId: jest.fn().mockReturnValue('1'),
    appliedTheme: { theme_name: 'Light Theme', id: 1 },
    setTemporaryTheme: mockSetTemporaryTheme,
    hasDevOverride: jest.fn().mockReturnValue(true),
    getAppliedThemeId: mockGetAppliedThemeId,
  });

  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  // Wait for list to load and verify it renders successfully
  await screen.findByText('Custom Theme');

  // Verify the component called getAppliedThemeId
  expect(mockGetAppliedThemeId).toHaveBeenCalled();
});

test('component loads successfully and preserves applied theme state', async () => {
  // Mock hasDevOverride to return true and getAppliedThemeId to return a theme
  mockGetAppliedThemeId.mockReturnValue(1);
  (useThemeContext as jest.Mock).mockReturnValue({
    getCurrentCrudThemeId: jest.fn().mockReturnValue('1'),
    appliedTheme: { theme_name: 'Light Theme', id: 1 },
    setTemporaryTheme: mockSetTemporaryTheme,
    hasDevOverride: jest.fn().mockReturnValue(true),
    getAppliedThemeId: mockGetAppliedThemeId,
  });

  render(
    <ThemesList
      user={mockUser}
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

  // Wait for list to load
  await screen.findByText('Custom Theme');

  // Verify getAppliedThemeId is called during component mount
  expect(mockGetAppliedThemeId).toHaveBeenCalled();
});
