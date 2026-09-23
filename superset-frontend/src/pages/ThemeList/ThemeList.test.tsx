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
import { setSystemDefaultTheme } from 'src/features/themes/api';
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
      permissions: {},
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

// Mock ThemeModal so we can trigger its save callback directly, without
// rendering the full editor. onThemeAdd wiring is what we assert on.
jest.mock('src/features/themes/ThemeModal', () => ({
  __esModule: true,
  default: ({
    onThemeAdd,
    show,
  }: {
    onThemeAdd: () => void;
    show: boolean;
  }) => {
    const React = jest.requireActual('react');
    return show
      ? React.createElement(
          'button',
          {
            type: 'button',
            'data-test': 'mock-modal-save',
            onClick: () => onThemeAdd(),
          },
          'save',
        )
      : null;
  },
}));

// Mock the CRUD hooks
jest.mock('src/views/CRUD/hooks', () => ({
  ...jest.requireActual('src/views/CRUD/hooks'),
  useListViewResource: jest.fn(),
}));

// Mock the useThemeContext hook
const mockSetTemporaryTheme = jest.fn();
const mockGetAppliedThemeId = jest.fn();
const mockRefreshSystemThemes = jest.fn(() => Promise.resolve());
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
    refreshSystemThemes: mockRefreshSystemThemes,
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
  (isUserEditorOrAdmin as jest.Mock).mockReturnValue(false);
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
  // The default user is an admin (and, for this assertion, also treated as
  // an editor of every row), so this test isolates the is_system exclusion
  // from the per-row editorship/admin gating covered separately below.
  (isUserEditorOrAdmin as jest.Mock).mockReturnValue(true);

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

const nonAdminUser = {
  userId: 5,
  username: 'non_admin',
  permissions: {},
  roles: { Gamma: [['can_write', 'Theme']] },
};

test('hides the delete action for a non-editor, non-admin viewing a regular theme', async () => {
  // TC-3: a non-editor, non-admin user must not see an enabled Delete
  // action on a row they cannot manage, even though they have the blanket
  // Theme:can_write permission (mocked via hasPerm above). isUserEditorOrAdmin
  // keeps its default mocked return of false (not an editor of this row).
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
      initialState: { user: nonAdminUser },
    },
  );

  await screen.findByText('Custom Theme');

  // Custom Theme is a regular (non-system, non-default, non-dark) theme,
  // so the only thing standing between this user and Delete is editorship.
  expect(screen.queryAllByTestId('delete-action')).toHaveLength(0);
  // The Edit action stays visible but read-only, matching the already-correct
  // View toggle behavior for non-editors.
  const editButtons = await screen.findAllByTestId('edit-action');
  editButtons.forEach(button => {
    expect(button).toHaveAttribute('aria-label', 'View');
  });
});

test('hides the edit and delete actions for a non-admin editor on a system default/dark theme', async () => {
  // TC-5: even a user who IS an editor of a system default/dark theme may
  // not edit or delete it while it holds that slot — only an admin can,
  // matching UpdateThemeCommand/DeleteThemeCommand server-side. Simulate
  // "editor of this row" via the mocked isUserEditorOrAdmin, while the
  // current user is not an admin.
  (isUserEditorOrAdmin as jest.Mock).mockReturnValue(true);

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
      initialState: { user: nonAdminUser },
    },
  );

  await screen.findByText('Custom Theme');

  const editButtons = await screen.findAllByTestId('edit-action');
  // Light Theme (row 0) is the system default theme.
  expect(editButtons[0]).toHaveAttribute('aria-label', 'View');

  // Only Custom Theme (a regular theme this user edits) should offer Delete;
  // the system default theme (Light Theme) must not, despite this user
  // being an editor of it.
  const deleteButtons = await screen.findAllByTestId('delete-action');
  expect(deleteButtons.length).toBe(1);
});

test('keeps delete and edit actions enabled for an editor on a regular theme', async () => {
  // Positive case: an editor (non-admin) of a regular theme should still see
  // fully enabled Edit and Delete actions for it, so the editorship fix
  // above does not over-hide.
  (isUserEditorOrAdmin as jest.Mock).mockReturnValue(true);

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
      initialState: { user: nonAdminUser },
    },
  );

  await screen.findByText('Custom Theme');

  const editButtons = await screen.findAllByTestId('edit-action');
  // Custom Theme is the third row.
  expect(editButtons[2]).toHaveAttribute('aria-label', 'Edit');

  const deleteButtons = await screen.findAllByTestId('delete-action');
  expect(deleteButtons).toHaveLength(1);
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
    refreshSystemThemes: mockRefreshSystemThemes,
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
    refreshSystemThemes: mockRefreshSystemThemes,
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

test('setting a system default theme applies it live and refreshes the list', async () => {
  // NOTE: the default export is withToasts(ThemesList), so react-redux connect
  // overrides the addSuccessToast/addDangerToast props with its own dispatch-
  // bound versions. Assert on the controllable mocks instead of the toast props.
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

  const setDefaultButtons = await screen.findAllByTestId('set-default-action');
  await userEvent.click(setDefaultButtons[0]);

  const confirmButton = await screen.findByRole('button', { name: 'Confirm' });
  await userEvent.click(confirmButton);

  await waitFor(() => {
    expect(setSystemDefaultTheme as jest.Mock).toHaveBeenCalled();
  });
  // The live re-apply and the CRUD list refresh both run on success.
  await waitFor(() => {
    expect(mockRefreshSystemThemes).toHaveBeenCalled();
  });
  expect(mockRefreshData).toHaveBeenCalled();
});

test('a failed system default mutation skips the live refresh', async () => {
  (setSystemDefaultTheme as jest.Mock).mockRejectedValueOnce(new Error('nope'));

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

  const setDefaultButtons = await screen.findAllByTestId('set-default-action');
  await userEvent.click(setDefaultButtons[0]);

  const confirmButton = await screen.findByRole('button', { name: 'Confirm' });
  await userEvent.click(confirmButton);

  await waitFor(() => {
    expect(setSystemDefaultTheme as jest.Mock).toHaveBeenCalled();
  });
  // A failed mutation must not attempt the live re-apply.
  expect(mockRefreshSystemThemes).not.toHaveBeenCalled();
});

test('editing the current system default theme re-applies it live on save', async () => {
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

  // The first row (Light Theme) is the current system default.
  const editButtons = await screen.findAllByTestId('edit-action');
  await userEvent.click(editButtons[0]);

  const save = await screen.findByTestId('mock-modal-save');
  await userEvent.click(save);

  await waitFor(() => {
    expect(mockRefreshSystemThemes).toHaveBeenCalled();
  });
  expect(mockRefreshData).toHaveBeenCalled();
});

test('editing a non-system theme does not re-apply live on save', async () => {
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

  // The third row (Custom Theme) is neither system default nor system dark.
  const editButtons = await screen.findAllByTestId('edit-action');
  await userEvent.click(editButtons[2]);

  const save = await screen.findByTestId('mock-modal-save');
  await userEvent.click(save);

  await waitFor(() => {
    expect(mockRefreshData).toHaveBeenCalled();
  });
  expect(mockRefreshSystemThemes).not.toHaveBeenCalled();
});

test('editing the current system dark theme re-applies it live on save', async () => {
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

  // The second row (Dark Theme) is the current system dark theme.
  const editButtons = await screen.findAllByTestId('edit-action');
  await userEvent.click(editButtons[1]);

  const save = await screen.findByTestId('mock-modal-save');
  await userEvent.click(save);

  await waitFor(() => {
    expect(mockRefreshSystemThemes).toHaveBeenCalled();
  });
  expect(mockRefreshData).toHaveBeenCalled();
});

test('a slow live re-apply does not block the confirm modal, list refresh, or toast', async () => {
  // Make the live re-apply hang to simulate a slow /system request.
  let resolveRefresh: () => void = () => {};
  mockRefreshSystemThemes.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        resolveRefresh = resolve;
      }),
  );

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

  const setDefaultButtons = await screen.findAllByTestId('set-default-action');
  await userEvent.click(setDefaultButtons[0]);

  const confirmButton = await screen.findByRole('button', { name: 'Confirm' });
  await userEvent.click(confirmButton);

  // The mutation ran and the list refreshed without waiting on the re-apply.
  await waitFor(() => {
    expect(setSystemDefaultTheme as jest.Mock).toHaveBeenCalled();
  });
  expect(mockRefreshData).toHaveBeenCalled();
  expect(mockRefreshSystemThemes).toHaveBeenCalled();

  // The confirm dialog closes even though the re-apply is still pending
  // (it would stay open if the handler awaited refreshSystemThemes).
  await waitFor(() => {
    expect(
      screen.queryByRole('button', { name: 'Confirm' }),
    ).not.toBeInTheDocument();
  });

  resolveRefresh();
});
