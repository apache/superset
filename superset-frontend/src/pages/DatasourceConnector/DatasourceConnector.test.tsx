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
import DatasourceConnector from './index';

// Mock useHistory
const mockPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockPush,
  }),
}));

// Mock DatabaseModal
jest.mock('src/features/databases/DatabaseModal', () => ({
  __esModule: true,
  default: ({ show, onHide, onDatabaseAdd }: any) =>
    show ? (
      <div data-testid="database-modal">
        <button type="button" data-testid="modal-close" onClick={onHide}>
          Close
        </button>
        <button
          type="button"
          data-testid="modal-add-db"
          onClick={() =>
            onDatabaseAdd({
              id: 999,
              database_name: 'New DB',
              backend: 'sqlite',
            })
          }
        >
          Add Database
        </button>
      </div>
    ) : null,
}));

// Mock DatabaseSelector
jest.mock('src/components/DatabaseSelector', () => ({
  __esModule: true,
  DatabaseSelector: ({ db, schema, onDbChange, onSchemaChange }: any) => (
    <div data-testid="database-selector">
      <select
        data-testid="database-select"
        value={db?.id || ''}
        onChange={e => {
          const id = parseInt(e.target.value, 10);
          if (id) {
            onDbChange({ id, database_name: `DB ${id}`, backend: 'sqlite' });
          }
        }}
      >
        <option value="">Select database</option>
        <option value="1">DB 1</option>
        <option value="2">DB 2</option>
      </select>
      {db && (
        <select
          data-testid="schema-select"
          value={schema || ''}
          onChange={e => onSchemaChange(e.target.value || undefined)}
        >
          <option value="">Select schema</option>
          <option value="main">main</option>
          <option value="public">public</option>
        </select>
      )}
    </div>
  ),
}));

// Mock withToasts
jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: any) => Component,
  useToasts: () => ({
    addDangerToast: jest.fn(),
    addSuccessToast: jest.fn(),
  }),
}));

const renderComponent = () =>
  render(<DatasourceConnector />, {
    useRedux: true,
    useRouter: true,
    useTheme: true,
  });

beforeEach(() => {
  mockPush.mockClear();
});

test('renders step header with correct steps', async () => {
  renderComponent();

  expect(
    await screen.findByText('Create Dashboard from Template'),
  ).toBeInTheDocument();
  expect(screen.getByText('Connect Data Source')).toBeInTheDocument();
  expect(screen.getByText('Review Schema')).toBeInTheDocument();
  expect(screen.getByText('Generate Dashboard')).toBeInTheDocument();
});

test('renders centered panel with data source selection', async () => {
  renderComponent();

  expect(await screen.findByText('Select a data source')).toBeInTheDocument();
  expect(
    screen.getByText(
      'Choose an existing database connection or add a new one to connect your data.',
    ),
  ).toBeInTheDocument();
});

test('schema select is hidden until database is chosen', async () => {
  renderComponent();

  // Initially, schema select should not be visible
  expect(screen.queryByTestId('schema-select')).not.toBeInTheDocument();

  // Select a database
  const dbSelect = await screen.findByTestId('database-select');
  await userEvent.selectOptions(dbSelect, '1');

  // Now schema select should be visible
  expect(await screen.findByTestId('schema-select')).toBeInTheDocument();
});

test('continue button is disabled until schema is chosen', async () => {
  renderComponent();

  const continueButton = await screen.findByRole('button', {
    name: /continue to schema review/i,
  });
  expect(continueButton).toBeDisabled();

  // Select a database
  const dbSelect = await screen.findByTestId('database-select');
  await userEvent.selectOptions(dbSelect, '1');

  // Continue button should still be disabled (no schema selected)
  expect(continueButton).toBeDisabled();

  // Select a schema
  const schemaSelect = await screen.findByTestId('schema-select');
  await userEvent.selectOptions(schemaSelect, 'main');

  // Now continue button should be enabled
  expect(continueButton).toBeEnabled();
});

test('add connection button opens DatabaseModal', async () => {
  renderComponent();

  const addButton = await screen.findByRole('button', {
    name: /add a new database connection/i,
  });
  await userEvent.click(addButton);

  expect(await screen.findByTestId('database-modal')).toBeInTheDocument();
});

test('after modal success, modal closes', async () => {
  renderComponent();

  // Open modal
  const addButton = await screen.findByRole('button', {
    name: /add a new database connection/i,
  });
  await userEvent.click(addButton);

  expect(await screen.findByTestId('database-modal')).toBeInTheDocument();

  // Click Add Database in mock modal
  const addDbButton = screen.getByTestId('modal-add-db');
  await userEvent.click(addDbButton);

  // Modal should be closed
  await waitFor(() => {
    expect(screen.queryByTestId('database-modal')).not.toBeInTheDocument();
  });
});

test('continue navigates to review schema step', async () => {
  renderComponent();

  // Select database
  const dbSelect = await screen.findByTestId('database-select');
  await userEvent.selectOptions(dbSelect, '1');

  // Select schema
  const schemaSelect = await screen.findByTestId('schema-select');
  await userEvent.selectOptions(schemaSelect, 'main');

  // Click continue
  const continueButton = screen.getByRole('button', {
    name: /continue to schema review/i,
  });
  await userEvent.click(continueButton);

  // Wait for the Review Schema panel to appear
  await waitFor(() => {
    expect(screen.getByText('Analyzing database schema')).toBeInTheDocument();
  });
});

test('cancel button navigates to home', async () => {
  renderComponent();

  const cancelButton = await screen.findByRole('button', { name: /cancel/i });
  await userEvent.click(cancelButton);

  expect(mockPush).toHaveBeenCalledWith('/');
});
