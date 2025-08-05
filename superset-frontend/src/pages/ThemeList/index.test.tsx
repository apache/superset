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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { act } from 'react-dom/test-utils';
import { Modal } from '@superset-ui/core/components';
import SupersetClient from '@superset-ui/core/connection/SupersetClient';
import ThemesList from './index';

const mockAddDangerToast = jest.fn();
const mockAddSuccessToast = jest.fn();

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
};

const mockThemes = [
  {
    id: 1,
    theme_name: 'Theme 1',
    json_data: '{"colors": {"primary": "#1890ff"}}',
    is_system: false,
    is_system_default: false,
    is_system_dark: false,
    changed_on_delta_humanized: '1 day ago',
    changed_by: { first_name: 'John', last_name: 'Doe' },
  },
  {
    id: 2,
    theme_name: 'System Theme',
    json_data: '{"colors": {"primary": "#000000"}}',
    is_system: true,
    is_system_default: true,
    is_system_dark: false,
    changed_on_delta_humanized: '2 days ago',
    changed_by: { first_name: 'Jane', last_name: 'Doe' },
  },
  {
    id: 3,
    theme_name: 'Dark Theme',
    json_data: '{"colors": {"primary": "#ffffff"}}',
    is_system: false,
    is_system_default: false,
    is_system_dark: true,
    changed_on_delta_humanized: '3 days ago',
    changed_by: { first_name: 'Bob', last_name: 'Smith' },
  },
];

const mockBootstrapData = {
  common: {
    theme: {
      settings: {
        enableUiThemeAdministration: true,
      },
    },
  },
};

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => mockBootstrapData,
}));

jest.mock('src/theme/ThemeProvider', () => ({
  useThemeContext: () => ({
    setTemporaryTheme: jest.fn(),
    getCurrentCrudThemeId: () => null,
  }),
}));

// Mock the Modal.confirm method
jest.spyOn(Modal, 'confirm').mockImplementation((config: any) => {
  // Immediately call onOk if provided
  if (config.onOk) {
    config.onOk();
  }
  return {
    destroy: jest.fn(),
    update: jest.fn(),
  };
});

describe('ThemesList', () => {
  beforeEach(() => {
    fetchMock.reset();
    jest.clearAllMocks();

    // Mock the themes list API
    fetchMock.get('glob:*/api/v1/theme/?*', {
      count: 3,
      ids: [1, 2, 3],
      result: mockThemes,
    });

    // Mock permissions API
    fetchMock.get('glob:*/api/v1/theme/_info?*', {
      permissions: ['can_write', 'can_export'],
    });
  });

  afterEach(() => {
    fetchMock.restore();
  });

  it('renders theme list with system indicators', async () => {
    render(
      <ThemesList
        addDangerToast={mockAddDangerToast}
        addSuccessToast={mockAddSuccessToast}
        user={mockUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Theme 1')).toBeInTheDocument();
    });

    // Check for system theme indicators
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('shows system theme actions for admin users', async () => {
    mockBootstrapData.common.theme.settings.enableUiThemeAdministration = true;

    render(
      <ThemesList
        addDangerToast={mockAddDangerToast}
        addSuccessToast={mockAddSuccessToast}
        user={mockUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Theme 1')).toBeInTheDocument();
    });

    // Find action buttons for non-system theme
    const theme1Row = screen.getByText('Theme 1').closest('tr');
    expect(theme1Row).toBeInTheDocument();

    // Check for sun icon (set as default) - should exist for non-default themes
    const sunButtons = screen.getAllByLabelText('sun');
    expect(sunButtons.length).toBeGreaterThan(0);

    // Check for moon icon (set as dark) - should exist for non-dark themes
    const moonButtons = screen.getAllByLabelText('moon');
    expect(moonButtons.length).toBeGreaterThan(0);
  });

  it('handles setting a theme as system default', async () => {
    const putSpy = jest.spyOn(SupersetClient, 'put');
    putSpy.mockResolvedValue({
      json: {},
      response: new Response('{}', { status: 200 }),
    });

    render(
      <ThemesList
        addDangerToast={mockAddDangerToast}
        addSuccessToast={mockAddSuccessToast}
        user={mockUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Theme 1')).toBeInTheDocument();
    });

    // Find and click the sun icon for Theme 1
    const sunButtons = screen.getAllByLabelText('sun');
    const setDefaultButton = sunButtons[0];

    await act(async () => {
      userEvent.click(setDefaultButton);
    });

    // Verify API call
    expect(putSpy).toHaveBeenCalledWith({
      endpoint: '/api/v1/theme/1/set_system_default',
    });

    // Verify success toast
    await waitFor(() => {
      expect(mockAddSuccessToast).toHaveBeenCalledWith(
        '"Theme 1" is now the system default theme',
      );
    });

    putSpy.mockRestore();
  });

  it('handles setting a theme as system dark', async () => {
    const putSpy = jest.spyOn(SupersetClient, 'put');
    putSpy.mockResolvedValue({
      json: {},
      response: new Response('{}', { status: 200 }),
    });

    render(
      <ThemesList
        addDangerToast={mockAddDangerToast}
        addSuccessToast={mockAddSuccessToast}
        user={mockUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Theme 1')).toBeInTheDocument();
    });

    // Find and click the moon icon for Theme 1
    const moonButtons = screen.getAllByLabelText('moon');
    const setDarkButton = moonButtons[0];

    await act(async () => {
      userEvent.click(setDarkButton);
    });

    // Verify API call
    expect(putSpy).toHaveBeenCalledWith({
      endpoint: '/api/v1/theme/1/set_system_dark',
    });

    // Verify success toast
    await waitFor(() => {
      expect(mockAddSuccessToast).toHaveBeenCalledWith(
        '"Theme 1" is now the system dark theme',
      );
    });

    putSpy.mockRestore();
  });

  it('handles unsetting system default theme', async () => {
    const deleteSpy = jest.spyOn(SupersetClient, 'delete');
    deleteSpy.mockResolvedValue({
      json: {},
      response: new Response('{}', { status: 200 }),
    });

    render(
      <ThemesList
        addDangerToast={mockAddDangerToast}
        addSuccessToast={mockAddSuccessToast}
        user={mockUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('System Theme')).toBeInTheDocument();
    });

    // Find the stop icon for the system default theme
    const stopButtons = screen.getAllByLabelText('stop');
    const unsetDefaultButton = stopButtons[0];

    await act(async () => {
      userEvent.click(unsetDefaultButton);
    });

    // Verify API call
    expect(deleteSpy).toHaveBeenCalledWith({
      endpoint: '/api/v1/theme/unset_system_default',
    });

    // Verify success toast
    await waitFor(() => {
      expect(mockAddSuccessToast).toHaveBeenCalledWith(
        'System default theme removed',
      );
    });

    deleteSpy.mockRestore();
  });

  it('prevents deletion of system themes', async () => {
    render(
      <ThemesList
        addDangerToast={mockAddDangerToast}
        addSuccessToast={mockAddSuccessToast}
        user={mockUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('System Theme')).toBeInTheDocument();
    });

    // Try to find delete button for system theme - should not exist
    const systemThemeRow = screen.getByText('System Theme').closest('tr');
    const deleteButtons = systemThemeRow?.querySelectorAll(
      '[aria-label="delete"]',
    );
    expect(deleteButtons?.length).toBe(0);
  });

  it('prevents deletion of themes set as system default or dark', async () => {
    render(
      <ThemesList
        addDangerToast={mockAddDangerToast}
        addSuccessToast={mockAddSuccessToast}
        user={mockUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Dark Theme')).toBeInTheDocument();
    });

    // Find delete button for dark theme (which is set as system dark)
    const darkThemeRow = screen.getByText('Dark Theme').closest('tr');
    const deleteButton = darkThemeRow?.querySelector('[aria-label="delete"]');

    // Dark theme should not have a delete button since it's set as system dark
    expect(deleteButton).toBeNull();
  });

  it('hides system theme actions when UI administration is disabled', async () => {
    mockBootstrapData.common.theme.settings.enableUiThemeAdministration = false;

    render(
      <ThemesList
        addDangerToast={mockAddDangerToast}
        addSuccessToast={mockAddSuccessToast}
        user={mockUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Theme 1')).toBeInTheDocument();
    });

    // Should not find any sun or moon buttons for setting system themes
    expect(
      screen
        .queryAllByLabelText('sun')
        .filter(
          el =>
            el.getAttribute('aria-label') === 'sun' &&
            el.closest('[data-test="set-default-action"]'),
        ),
    ).toHaveLength(0);

    expect(
      screen
        .queryAllByLabelText('moon')
        .filter(
          el =>
            el.getAttribute('aria-label') === 'moon' &&
            el.closest('[data-test="set-dark-action"]'),
        ),
    ).toHaveLength(0);
  });

  it('handles API errors gracefully', async () => {
    const putSpy = jest.spyOn(SupersetClient, 'put');
    putSpy.mockRejectedValue(new Error('API Error'));

    render(
      <ThemesList
        addDangerToast={mockAddDangerToast}
        addSuccessToast={mockAddSuccessToast}
        user={mockUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Theme 1')).toBeInTheDocument();
    });

    // Try to set as system default
    const sunButtons = screen.getAllByLabelText('sun');
    const setDefaultButton = sunButtons[0];

    await act(async () => {
      userEvent.click(setDefaultButton);
    });

    // Verify error toast
    await waitFor(() => {
      expect(mockAddDangerToast).toHaveBeenCalledWith(
        'Failed to set system default theme: API Error',
      );
    });

    putSpy.mockRestore();
  });

  it('shows correct tooltips for system theme actions', async () => {
    render(
      <ThemesList
        addDangerToast={mockAddDangerToast}
        addSuccessToast={mockAddSuccessToast}
        user={mockUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Theme 1')).toBeInTheDocument();
    });

    // Check tooltips by hovering
    const sunButtons = screen.getAllByLabelText('sun');
    await act(async () => {
      userEvent.hover(sunButtons[0]);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Set as system default theme'),
      ).toBeInTheDocument();
    });

    const moonButtons = screen.getAllByLabelText('moon');
    await act(async () => {
      userEvent.hover(moonButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Set as system dark theme')).toBeInTheDocument();
    });
  });
});
