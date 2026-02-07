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
import { validateTheme } from 'src/theme/utils/themeStructureValidation';

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

// Mock JsonEditor to avoid direct DOM manipulation in tests
jest.mock('@superset-ui/core/components/AsyncAceEditor', () => ({
  ...jest.requireActual('@superset-ui/core/components/AsyncAceEditor'),
  JsonEditor: ({
    onChange,
    value,
    readOnly,
  }: {
    onChange: (value: string) => void;
    value: string;
    readOnly?: boolean;
  }) => (
    <textarea
      data-test="json-editor"
      value={value}
      onChange={e => onChange(e.target.value)}
      readOnly={readOnly}
    />
  ),
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

const postThemeMockName = 'postTheme';
const putThemeMockName = 'putTheme';

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get('glob:*/api/v1/theme/1', { result: mockTheme });
  fetchMock.get('glob:*/api/v1/theme/2', { result: mockSystemTheme });
  fetchMock.get('glob:*/api/v1/theme/*', { result: mockTheme });
  fetchMock.post(
    'glob:*/api/v1/theme/',
    { result: { ...mockTheme, id: 3 } },
    { name: postThemeMockName },
  );
  fetchMock.put(
    'glob:*/api/v1/theme/*',
    { result: mockTheme },
    { name: putThemeMockName },
  );
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  jest.clearAllMocks();
});

// Helper to add valid JSON data to the theme
// Uses the mocked JsonEditor textarea for testing
const addValidJsonData = async () => {
  const validJson = JSON.stringify(
    { token: { colorPrimary: '#1890ff' } },
    null,
    2,
  );
  const jsonEditor = screen.getByTestId('json-editor');
  await userEvent.clear(jsonEditor);
  await userEvent.type(jsonEditor, validJson);
};

// Helper to add JSON with unknown tokens (triggers warnings but not errors)
const addJsonWithUnknownToken = async () => {
  const jsonWithUnknown = JSON.stringify(
    { token: { colorPrimary: '#1890ff', unknownTokenName: 'value' } },
    null,
    2,
  );
  const jsonEditor = screen.getByTestId('json-editor');
  await userEvent.clear(jsonEditor);
  await userEvent.type(jsonEditor, jsonWithUnknown);
};

test('renders modal with add theme dialog when show is true', () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('Add theme')).toBeInTheDocument();
});

test('does not render modal when show is false', () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show={false}
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('renders edit mode title when theme is provided', async () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
      theme={mockTheme}
    />,
    { useRedux: true, useRouter: true },
  );

  // Wait for theme name to be loaded in the input field
  expect(await screen.findByDisplayValue('Test Theme')).toBeInTheDocument();
  expect(screen.getByText('Edit theme properties')).toBeInTheDocument();
});

test('renders view mode title for system themes', async () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
      theme={mockSystemTheme}
    />,
    { useRedux: true, useRouter: true },
  );

  // Wait for system theme indicator to appear
  expect(
    await screen.findByText('System Theme - Read Only'),
  ).toBeInTheDocument();
  expect(screen.getByText('View theme properties')).toBeInTheDocument();
});

test('renders theme name input field', () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(screen.getByPlaceholderText('Enter theme name')).toBeInTheDocument();
});

test('renders JSON configuration field', () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(screen.getByText('JSON Configuration')).toBeInTheDocument();
});

test('disables inputs for read-only system themes', async () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
      theme={mockSystemTheme}
    />,
    { useRedux: true, useRouter: true },
  );

  const nameInput = await screen.findByPlaceholderText('Enter theme name');

  expect(nameInput).toHaveAttribute('readOnly');
});

test('shows Apply button when canDevelop is true and theme exists', async () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop
      theme={mockTheme}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(
    await screen.findByRole('button', { name: /apply/i }),
  ).toBeInTheDocument();
});

test('does not show Apply button when canDevelop is false', () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(
    screen.queryByRole('button', { name: 'Apply' }),
  ).not.toBeInTheDocument();
});

test('disables save button when theme name is empty', () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  const saveButton = screen.getByRole('button', { name: 'Add' });

  expect(saveButton).toBeDisabled();
});

test('enables save button when theme name is entered', async () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  const nameInput = screen.getByPlaceholderText('Enter theme name');
  await userEvent.type(nameInput, 'My New Theme');
  await addValidJsonData();

  // Wait for validation to complete and button to become enabled
  await waitFor(
    () => {
      const saveButton = screen.getByRole('button', { name: 'Add' });
      expect(saveButton).toBeEnabled();
    },
    { timeout: 10000 },
  );
});

test('validates JSON format and enables save button', async () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  const nameInput = screen.getByPlaceholderText('Enter theme name');
  await userEvent.type(nameInput, 'Test Theme');
  await addValidJsonData();

  // Wait for validation to complete and button to become enabled
  await waitFor(
    () => {
      const saveButton = screen.getByRole('button', { name: 'Add' });
      expect(saveButton).toBeEnabled();
    },
    { timeout: 10000 },
  );
});

test('warnings do not block save - unknown tokens allow save with warnings', async () => {
  // First verify the test data actually produces warnings (not errors)
  const testTheme = {
    token: { colorPrimary: '#1890ff', unknownTokenName: 'value' },
  };
  const validationResult = validateTheme(testTheme);
  expect(validationResult.valid).toBe(true); // No errors
  expect(validationResult.warnings.length).toBeGreaterThan(0); // Has warnings
  expect(validationResult.warnings[0].tokenName).toBe('unknownTokenName');

  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  const nameInput = screen.getByPlaceholderText('Enter theme name');
  await userEvent.type(nameInput, 'Theme With Unknown Token');
  await addJsonWithUnknownToken();

  // Wait for validation to complete - button should still be enabled despite warnings
  await waitFor(
    () => {
      const saveButton = screen.getByRole('button', { name: 'Add' });
      expect(saveButton).toBeEnabled();
    },
    { timeout: 10000 },
  );
});

test('shows unsaved changes alert when closing modal with modifications', async () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  const nameInput = screen.getByPlaceholderText('Enter theme name');
  await userEvent.type(nameInput, 'Modified Theme');

  const cancelButton = screen.getByRole('button', { name: 'Cancel' });
  await userEvent.click(cancelButton);

  expect(
    await screen.findByText('You have unsaved changes'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Your changes will be lost if you leave without saving.'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Keep editing' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
});

test('does not show unsaved changes alert when closing without modifications', async () => {
  const onHide = jest.fn();
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={onHide}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  const cancelButton = screen.getByRole('button', { name: 'Cancel' });
  await userEvent.click(cancelButton);

  expect(onHide).toHaveBeenCalled();
  expect(
    screen.queryByText('You have unsaved changes'),
  ).not.toBeInTheDocument();
});

test('allows user to keep editing after triggering cancel alert', async () => {
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  const nameInput = screen.getByPlaceholderText('Enter theme name');
  await userEvent.type(nameInput, 'Modified Theme');

  const cancelButton = screen.getByRole('button', { name: 'Cancel' });
  await userEvent.click(cancelButton);

  expect(
    await screen.findByText('You have unsaved changes'),
  ).toBeInTheDocument();

  const keepEditingButton = screen.getByRole('button', {
    name: 'Keep editing',
  });
  await userEvent.click(keepEditingButton);

  expect(
    screen.queryByText('You have unsaved changes'),
  ).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText('Enter theme name')).toHaveValue(
    'Modified Theme',
  );
});

test('saves changes when clicking Save button in unsaved changes alert', async () => {
  const onHide = jest.fn();
  const onThemeAdd = jest.fn();
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={onThemeAdd}
      onHide={onHide}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  const nameInput = screen.getByPlaceholderText('Enter theme name');
  await userEvent.type(nameInput, 'Modified Theme');
  await addValidJsonData();

  // Wait for validation to complete before canceling
  await waitFor(
    () => {
      const addButton = screen.getByRole('button', { name: 'Add' });
      expect(addButton).toBeEnabled();
    },
    { timeout: 10000 },
  );

  // Give extra time for all state updates to complete
  await new Promise(resolve => setTimeout(resolve, 500));

  const cancelButton = screen.getByRole('button', { name: 'Cancel' });
  await userEvent.click(cancelButton);

  expect(
    await screen.findByText('You have unsaved changes'),
  ).toBeInTheDocument();

  // Wait for the Save button in the alert to be enabled
  const saveButton = await waitFor(
    () => {
      const button = screen.getByRole('button', { name: 'Save' });
      expect(button).toBeEnabled();
      return button;
    },
    { timeout: 10000 },
  );
  await userEvent.click(saveButton);

  // Wait for API call to complete
  await screen.findByRole('dialog');
  await waitFor(
    () => {
      expect(fetchMock.callHistory.called()).toBe(true);
    },
    { timeout: 15000 },
  );
}, 30000);

test('discards changes when clicking Discard button in unsaved changes alert', async () => {
  const onHide = jest.fn();
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={onHide}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  const nameInput = screen.getByPlaceholderText('Enter theme name');
  await userEvent.type(nameInput, 'Modified Theme');

  const cancelButton = screen.getByRole('button', { name: 'Cancel' });
  await userEvent.click(cancelButton);

  expect(
    await screen.findByText('You have unsaved changes'),
  ).toBeInTheDocument();

  const discardButton = screen.getByRole('button', { name: 'Discard' });
  await userEvent.click(discardButton);

  expect(onHide).toHaveBeenCalled();
  expect(fetchMock.callHistory.called()).toBe(false);
  expect(fetchMock.callHistory.called(putThemeMockName)).toBe(false);
});

test('creates new theme when saving', async () => {
  const onHide = jest.fn();
  const onThemeAdd = jest.fn();
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={onThemeAdd}
      onHide={onHide}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  const nameInput = screen.getByPlaceholderText('Enter theme name');
  await userEvent.type(nameInput, 'New Theme');
  await addValidJsonData();

  // Wait for validation to complete and button to become enabled
  const saveButton = await waitFor(
    () => {
      const button = screen.getByRole('button', { name: 'Add' });
      expect(button).toBeEnabled();
      return button;
    },
    { timeout: 10000 },
  );
  await userEvent.click(saveButton);

  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  await waitFor(() => {
    expect(fetchMock.callHistory.called(postThemeMockName)).toBe(true);
  });
});

test('updates existing theme when saving', async () => {
  const onHide = jest.fn();
  const onThemeAdd = jest.fn();
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={onThemeAdd}
      onHide={onHide}
      show
      canDevelop={false}
      theme={mockTheme}
    />,
    { useRedux: true, useRouter: true },
  );

  const nameInput = await screen.findByDisplayValue('Test Theme');
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, 'Updated Theme');

  const saveButton = screen.getByRole('button', { name: 'Save' });
  await userEvent.click(saveButton);

  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(fetchMock.callHistory.called(putThemeMockName)).toBe(true);
});

test('handles API errors gracefully', async () => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.post('glob:*/api/v1/theme/', 500);

  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop={false}
    />,
    { useRedux: true, useRouter: true },
  );

  const nameInput = screen.getByPlaceholderText('Enter theme name');
  await userEvent.type(nameInput, 'New Theme');
  await addValidJsonData();

  // Wait for validation to complete and button to become enabled
  const saveButton = await waitFor(
    () => {
      const button = screen.getByRole('button', { name: 'Add' });
      expect(button).toBeEnabled();
      return button;
    },
    { timeout: 10000 },
  );

  await userEvent.click(saveButton);

  await screen.findByRole('dialog');
  await waitFor(() => {
    expect(fetchMock.callHistory.called()).toBe(true);
  });
});

test('applies theme locally when clicking Apply button', async () => {
  const onThemeApply = jest.fn();
  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop
      theme={mockTheme}
      onThemeApply={onThemeApply}
    />,
    { useRedux: true, useRouter: true },
  );

  const applyButton = await screen.findByRole('button', { name: /apply/i });
  expect(applyButton).toBeEnabled();

  await userEvent.click(applyButton);

  expect(mockThemeContext.setTemporaryTheme).toHaveBeenCalled();
});

test('disables Apply button when JSON configuration is invalid', async () => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get('glob:*/api/v1/theme/*', {
    result: { ...mockTheme, json_data: 'invalid json' },
  });

  render(
    <ThemeModal
      addDangerToast={jest.fn()}
      addSuccessToast={jest.fn()}
      onThemeAdd={jest.fn()}
      onHide={jest.fn()}
      show
      canDevelop
      theme={mockTheme}
    />,
    { useRedux: true, useRouter: true },
  );

  const applyButton = await screen.findByRole('button', { name: /apply/i });
  expect(applyButton).toBeDisabled();
});
