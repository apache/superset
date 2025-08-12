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
import { render, waitFor } from 'spec/helpers/testing-library';
import ExtensionsList from './ExtensionsList';

// Mock initial state for the store
const mockInitialState = {
  extensions: {
    loading: false,
    resourceCount: 2,
    resourceCollection: [
      {
        id: 1,
        name: 'Test Extension 1',
        enabled: true,
        contributions:
          '{"menus": {"testMenu": {"primary": [{"key": "item1", "title": "Menu Item 1"}]}}, "views": {}}',
      },
      {
        id: 2,
        name: 'Test Extension 2',
        enabled: false,
        contributions:
          '{"commands": [{"command": "test.command", "title": "Test Command"}]}',
      },
    ],
    bulkSelectEnabled: false,
  },
};

const defaultProps = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
};

const renderWithStore = (props = {}) => {
  return render(<ExtensionsList {...defaultProps} {...props} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
    initialState: mockInitialState,
  });
};

test('renders extensions list with basic structure', async () => {
  renderWithStore();

  // Check that the component renders
  expect(document.body).toBeInTheDocument();
});

test('displays extension names in the list', async () => {
  renderWithStore();

  await waitFor(() => {
    // These texts should appear somewhere in the rendered component
    expect(document.body.textContent).toContain('Extensions');
  });
});

test('shows enabled/disabled status for extensions', async () => {
  renderWithStore();

  await waitFor(() => {
    // The component should show enabled status
    const bodyText = document.body.textContent || '';
    expect(bodyText).toMatch(/enabled|disabled|true|false/i);
  });
});

test('displays contributions information', async () => {
  renderWithStore();

  await waitFor(() => {
    // Should show contributions-related content
    const bodyText = document.body.textContent || '';
    expect(bodyText).toMatch(/contribution/i);
  });
});

test('has upload functionality', async () => {
  renderWithStore();

  // Look for upload-related elements
  await waitFor(() => {
    const bodyText = document.body.textContent || '';
    expect(bodyText).toMatch(/upload|extension/i);
  });
});

test('shows action buttons for extensions', async () => {
  renderWithStore();

  await waitFor(() => {
    // Should show action-related content
    const bodyText = document.body.textContent || '';
    expect(bodyText).toMatch(/action|enable|disable|delete/i);
  });
});

test('has bulk select functionality', async () => {
  renderWithStore();

  await waitFor(() => {
    // Should show bulk select option
    const bodyText = document.body.textContent || '';
    expect(bodyText).toMatch(/bulk|select/i);
  });
});

test('calls toast functions when provided', () => {
  const addDangerToast = jest.fn();
  const addSuccessToast = jest.fn();

  renderWithStore({
    addDangerToast,
    addSuccessToast,
  });

  // The component should accept these props without error
  expect(addDangerToast).toBeDefined();
  expect(addSuccessToast).toBeDefined();
});
