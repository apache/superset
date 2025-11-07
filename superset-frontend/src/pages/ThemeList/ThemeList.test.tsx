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
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import ThemesList from './index';

const themesInfoEndpoint = 'glob:*/api/v1/theme/_info*';
const themesEndpoint = 'glob:*/api/v1/theme/?*';
const themeEndpoint = 'glob:*/api/v1/theme/*';

const mockThemes = [
  {
    id: 1,
    theme_name: 'Dark Theme',
    json_data: '{"colors": {"primary": "#1890ff"}}',
    is_system: false,
    changed_on_delta_humanized: '2 days ago',
    changed_by: {
      first_name: 'John',
      last_name: 'Doe',
    },
  },
  {
    id: 2,
    theme_name: 'Light Theme',
    json_data: '{"colors": {"primary": "#ffffff"}}',
    is_system: true,
    changed_on_delta_humanized: '1 week ago',
    changed_by: {
      first_name: 'Jane',
      last_name: 'Smith',
    },
  },
  {
    id: 3,
    theme_name: 'Custom Theme',
    json_data: '{"colors": {"primary": "#52c41a"}}',
    is_system: false,
    changed_on_delta_humanized: '1 day ago',
    changed_by: {
      first_name: 'Admin',
      last_name: 'User',
    },
  },
];

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
};

fetchMock.get(themesInfoEndpoint, {
  permissions: ['can_read', 'can_write', 'can_export'],
});

fetchMock.get(themesEndpoint, {
  ids: [1, 2, 3],
  result: mockThemes,
  count: mockThemes.length,
});

fetchMock.delete(themeEndpoint, {});

const renderThemesList = (props = {}) =>
  render(
    <ThemesList
      user={mockUser}
      addDangerToast={() => {}}
      addSuccessToast={() => {}}
      {...props}
    />,
    {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      useTheme: true,
    },
  );

describe('ThemesList', () => {
  beforeEach(() => {
    fetchMock.resetHistory();
  });

  it('renders', async () => {
    renderThemesList();
    expect(await screen.findByText('Themes')).toBeInTheDocument();
  });

  it('renders a ListView', async () => {
    renderThemesList();
    expect(await screen.findByTestId('themes-list-view')).toBeInTheDocument();
  });

  it('renders theme information', async () => {
    renderThemesList();

    // Wait for list to load
    await screen.findByTestId('themes-list-view');

    // Wait for data to load
    await waitFor(() => {
      mockThemes.forEach(theme => {
        expect(screen.getByText(theme.theme_name)).toBeInTheDocument();
      });
    });
  });

  it('shows system theme tags correctly', async () => {
    renderThemesList();

    // Wait for list to load
    await screen.findByTestId('themes-list-view');

    // System theme should have a "System" tag
    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });

  it('handles theme deletion for non-system themes', async () => {
    renderThemesList();

    // Wait for list to load
    await screen.findByTestId('themes-list-view');

    // Find delete buttons (should only exist for non-system themes)
    const deleteButtons = await screen.findAllByTestId('delete-action');
    expect(deleteButtons.length).toBeGreaterThan(0);

    fireEvent.click(deleteButtons[0]);

    // Confirm deletion modal should appear
    await waitFor(() => {
      expect(screen.getByText('Delete Theme?')).toBeInTheDocument();
    });
  });

  it('shows apply action for themes', async () => {
    renderThemesList();

    // Wait for list to load
    await screen.findByTestId('themes-list-view');

    // Find apply buttons
    const applyButtons = await screen.findAllByTestId('apply-action');
    expect(applyButtons.length).toBe(mockThemes.length);
  });

  it('fetches themes data on load', async () => {
    renderThemesList();

    await waitFor(() => {
      const calls = fetchMock.calls(/api\/v1\/theme\/\?/);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  it('shows bulk select when user has permissions', async () => {
    renderThemesList();

    // Wait for list to load
    await screen.findByText('Themes');

    // Should show bulk select button
    expect(screen.getByText('Bulk select')).toBeInTheDocument();
  });

  it('shows create theme button when user has permissions', async () => {
    renderThemesList();

    // Wait for list to load
    await screen.findByText('Themes');

    // Should show theme creation button
    const addButton = screen.getByLabelText('plus');
    expect(addButton).toBeInTheDocument();
  });
});
