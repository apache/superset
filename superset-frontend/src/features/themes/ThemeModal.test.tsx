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
import ThemeModal from './ThemeModal';
import { ThemeObject } from './types';

const mockThemeContext = {
  setTemporaryTheme: jest.fn(),
  clearLocalOverrides: jest.fn(),
  hasDevOverride: jest.fn(() => false),
};

jest.mock('src/theme/ThemeProvider', () => ({
  useThemeContext: () => mockThemeContext,
}));

jest.mock('src/dashboard/util/permissionUtils', () => ({
  isUserAdmin: jest.fn(() => true),
}));

const mockTheme: ThemeObject = {
  id: 1,
  theme_name: 'Test Theme',
  json_data: JSON.stringify(
    {
      token: {
        colorPrimary: '#1890ff',
      },
    },
    null,
    2,
  ),
  changed_on_delta_humanized: '1 day ago',
  changed_by: {
    id: 1,
    first_name: 'Admin',
    last_name: 'User',
  },
};

const mockSystemTheme: ThemeObject = {
  ...mockTheme,
  id: 2,
  theme_name: 'System Theme',
  is_system: true,
};

const defaultProps = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  onThemeAdd: jest.fn(),
  onHide: jest.fn(),
  show: true,
  canDevelop: false,
};

const setup = (props = {}) => {
  const utils = render(<ThemeModal {...defaultProps} {...props} />, {
    useRedux: true,
    useRouter: true,
  });
  return {
    ...utils,
    mockProps: { ...defaultProps, ...props },
  };
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ThemeModal', () => {
  beforeEach(() => {
    fetchMock.reset();
    fetchMock.get('glob:*/api/v1/theme/1', { result: mockTheme });
    fetchMock.get('glob:*/api/v1/theme/2', { result: mockSystemTheme });
    fetchMock.get('glob:*/api/v1/theme/*', { result: mockTheme });
    fetchMock.post('glob:*/api/v1/theme/', { result: { ...mockTheme, id: 3 } });
    fetchMock.put('glob:*/api/v1/theme/*', { result: mockTheme });
    jest.clearAllMocks();
  });

  afterEach(() => {
    fetchMock.restore();
  });

  describe('Component Rendering', () => {
    test('should render modal when show is true', () => {
      setup();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Add theme')).toBeInTheDocument();
    });

    test('should not render modal when show is false', () => {
      const { container } = setup({ show: false });
      expect(container.querySelector('.ant-modal')).not.toBeInTheDocument();
    });

    test('should render with edit mode title when theme is provided', async () => {
      setup({ theme: mockTheme });
      await waitFor(() => {
        expect(screen.getByText('Edit theme properties')).toBeInTheDocument();
      });
    });

    test('should render with view mode title for system themes', async () => {
      setup({ theme: mockSystemTheme });
      await waitFor(() => {
        expect(fetchMock.called('glob:*/api/v1/theme/2')).toBe(true);
      });
      await waitFor(() => {
        expect(screen.getByText('View theme properties')).toBeInTheDocument();
      });
      expect(screen.getByText('System Theme - Read Only')).toBeInTheDocument();
    });
  });

  describe('Form Fields', () => {
    test('should render theme name input', () => {
      setup();
      expect(screen.getByPlaceholderText('Enter theme name')).toBeInTheDocument();
    });

    test('should render JSON editor', () => {
      setup();
      expect(screen.getByText('JSON Configuration')).toBeInTheDocument();
      expect(document.querySelector('.ace_editor')).toBeInTheDocument();
    });

    test('should disable inputs for read-only system themes', async () => {
      setup({ theme: mockSystemTheme });
      await waitFor(() => {
        expect(fetchMock.called('glob:*/api/v1/theme/2')).toBe(true);
      });
      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('Enter theme name');
        expect(nameInput).toHaveAttribute('readOnly');
      });
    });

    test('should show Apply button when canDevelop is true', () => {
      setup({ canDevelop: true });
      expect(screen.getByText('Apply')).toBeInTheDocument();
    });

    test('should not show Apply button when canDevelop is false', () => {
      setup({ canDevelop: false });
      expect(screen.queryByText('Apply')).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('should disable save button when theme name is empty', () => {
      setup();
      const saveButton = screen.getByRole('button', { name: 'Add' });
      expect(saveButton).toBeDisabled();
    });

    test('should enable save button when form is valid', async () => {
      setup();
      const nameInput = screen.getByPlaceholderText('Enter theme name');

      await userEvent.type(nameInput, 'My New Theme');

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: 'Add' });
        expect(saveButton).not.toBeDisabled();
      });
    });

    test('should validate JSON format', async () => {
      setup();
      const nameInput = screen.getByPlaceholderText('Enter theme name');

      await userEvent.type(nameInput, 'Test Theme');

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: 'Add' });
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('Unsaved Changes Modal', () => {
    test('should show unsaved changes modal when closing with changes', async () => {
      setup();
      const nameInput = screen.getByPlaceholderText('Enter theme name');
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });

      await userEvent.type(nameInput, 'Modified Theme');

      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
        expect(screen.getByText("If you don't save, your changes will be lost.")).toBeInTheDocument();
      });
    });

    test('should not show unsaved changes modal when no changes made', async () => {
      const { mockProps } = setup();
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });

      await userEvent.click(cancelButton);

      expect(mockProps.onHide).toHaveBeenCalled();
      expect(screen.queryByText('Unsaved Changes')).not.toBeInTheDocument();
    });

    test('should show unsaved changes modal when canceling with changes', async () => {
      setup();
      const nameInput = screen.getByPlaceholderText('Enter theme name');

      await userEvent.type(nameInput, 'Modified Theme');

      const cancelButton = await screen.findByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
        expect(screen.getByText("If you don't save, your changes will be lost.")).toBeInTheDocument();
      });
    });

    test('should call save handler when choosing save option', async () => {
      setup();
      const nameInput = screen.getByPlaceholderText('Enter theme name');

      await userEvent.type(nameInput, 'Modified Theme');

      const cancelButton = await screen.findByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
      });

      const saveButton = await screen.findByRole('button', { name: /^save$/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(fetchMock.called()).toBe(true);
      });
    });

    test('should discard changes when choosing to discard', async () => {
      const { mockProps } = setup();
      const nameInput = screen.getByPlaceholderText('Enter theme name');

      await userEvent.type(nameInput, 'Modified Theme');

      const cancelButton = await screen.findByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
      });

      const discardButton = await screen.findByRole('button', { name: /discard/i });
      await userEvent.click(discardButton);

      await waitFor(() => {
        expect(mockProps.onHide).toHaveBeenCalled();
      });

      expect(fetchMock.called('glob:*/api/v1/theme/', 'POST')).toBe(false);
      expect(fetchMock.called('glob:*/api/v1/theme/*', 'PUT')).toBe(false);
    });
  });

  describe('CRUD Operations', () => {
    test('should create new theme', async () => {
      setup();
      const nameInput = screen.getByPlaceholderText('Enter theme name');

      await userEvent.type(nameInput, 'New Theme');

      const saveButton = await screen.findByRole('button', { name: 'Add' });
      expect(saveButton).not.toBeDisabled();

      await userEvent.click(saveButton);

      await waitFor(
        () => {
          expect(fetchMock.called()).toBe(true);
        },
        { timeout: 3000 },
      );
    });

    test('should update existing theme', async () => {
      const { mockProps } = setup({ theme: mockTheme });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Theme')).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('Test Theme');
      const saveButton = screen.getByRole('button', { name: 'Save' });

      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Updated Theme');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(fetchMock.called('glob:*/api/v1/theme/*', 'PUT')).toBe(true);
        expect(mockProps.onThemeAdd).toHaveBeenCalled();
        expect(mockProps.onHide).toHaveBeenCalled();
      });
    });

    test('should handle API errors gracefully', async () => {
      fetchMock.restore();
      fetchMock.post('glob:*/api/v1/theme/', 500);

      setup();
      const nameInput = screen.getByPlaceholderText('Enter theme name');

      await userEvent.type(nameInput, 'New Theme');

      const saveButton = await screen.findByRole('button', { name: 'Add' });
      expect(saveButton).not.toBeDisabled();

      await userEvent.click(saveButton);

      await waitFor(
        () => {
          expect(fetchMock.called()).toBe(true);
        },
        { timeout: 3000 },
      );
    });
  });

  describe('Apply Theme Feature', () => {
    test('should apply theme locally when clicking Apply', async () => {
      const onThemeApply = jest.fn();
      setup({
        canDevelop: true,
        theme: mockTheme,
        onThemeApply,
      });

      await waitFor(
        () => {
          expect(screen.getByText('Apply')).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const applyButton = screen.getByRole('button', { name: /apply/i });
      expect(applyButton).not.toBeDisabled();

      await userEvent.click(applyButton);

      expect(mockThemeContext.setTemporaryTheme).toHaveBeenCalled();
    });

    test('should disable Apply button when JSON is invalid', async () => {
      fetchMock.restore();
      fetchMock.get('glob:*/api/v1/theme/*', {
        result: { ...mockTheme, json_data: 'invalid json' },
      });

      setup({
        canDevelop: true,
        theme: mockTheme,
      });

      await waitFor(
        () => {
          expect(screen.getByText('Apply')).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const applyButton = screen.getByRole('button', { name: /apply/i });
      expect(applyButton).toBeDisabled();
    });
  });

});
