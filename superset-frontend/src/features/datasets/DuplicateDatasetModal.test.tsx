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
import { ThemeProvider, supersetTheme } from '@apache-superset/core';
import DuplicateDatasetModal from './DuplicateDatasetModal';

// Test-only fixture type that includes all fields from API responses
// Matches VirtualDataset structure from DatasetList but defined locally for tests
interface VirtualDatasetFixture {
  id: number;
  table_name: string;
  kind: string;
  schema: string;
  database: {
    id: string;
    database_name: string;
  };
  owners: Array<{ first_name: string; last_name: string; id: number }>;
  changed_by_name: string;
  changed_by: string;
  changed_on_delta_humanized: string;
  explore_url: string;
  extra: string;
  sql: string | null;
}

// Test fixture with extra/sql fields that exist in actual API responses
const mockDataset: VirtualDatasetFixture = {
  id: 1,
  table_name: 'original_dataset',
  kind: 'virtual',
  schema: 'public',
  database: {
    id: '1',
    database_name: 'PostgreSQL',
  },
  owners: [],
  changed_by_name: 'Admin',
  changed_by: 'Admin User',
  changed_on_delta_humanized: '1 day ago',
  explore_url: '/explore/?datasource=1__table',
  extra: '{}',
  sql: 'SELECT * FROM table',
};

const Wrapper = ({
  dataset,
  onHide,
  onDuplicate,
}: {
  dataset: VirtualDatasetFixture | null;
  onHide: jest.Mock;
  onDuplicate: jest.Mock;
}) => (
  <ThemeProvider theme={supersetTheme}>
    <DuplicateDatasetModal
      dataset={dataset}
      onHide={onHide}
      onDuplicate={onDuplicate}
    />
  </ThemeProvider>
);

const renderModal = (
  dataset: VirtualDatasetFixture | null,
  onHide: jest.Mock,
  onDuplicate: jest.Mock,
) =>
  render(
    <Wrapper dataset={dataset} onHide={onHide} onDuplicate={onDuplicate} />,
  );

test('modal opens when dataset is provided', async () => {
  const onHide = jest.fn();
  const onDuplicate = jest.fn();

  renderModal(mockDataset, onHide, onDuplicate);

  // Modal should be visible
  expect(await screen.findByText('Duplicate dataset')).toBeInTheDocument();

  // Input field should be present
  expect(screen.getByTestId('duplicate-modal-input')).toBeInTheDocument();

  // Duplicate button should be present
  expect(
    screen.getByRole('button', { name: /duplicate/i }),
  ).toBeInTheDocument();
});

test('modal does not open when dataset is null', () => {
  const onHide = jest.fn();
  const onDuplicate = jest.fn();

  renderModal(null, onHide, onDuplicate);

  // Modal should not be visible
  expect(screen.queryByText('Duplicate dataset')).not.toBeInTheDocument();
});

test('duplicate button disabled after clearing input', async () => {
  const onHide = jest.fn();
  const onDuplicate = jest.fn();

  renderModal(mockDataset, onHide, onDuplicate);

  const input = await screen.findByTestId('duplicate-modal-input');

  // Type some text first
  await userEvent.type(input, 'test');

  // Then clear it
  await userEvent.clear(input);

  // Duplicate button should now be disabled (empty input)
  const duplicateButton = screen.getByRole('button', { name: /duplicate/i });
  expect(duplicateButton).toBeDisabled();
});

test('duplicate button enabled when name is entered', async () => {
  const onHide = jest.fn();
  const onDuplicate = jest.fn();

  renderModal(mockDataset, onHide, onDuplicate);

  const input = await screen.findByTestId('duplicate-modal-input');

  // Type a new name
  await userEvent.type(input, 'new_dataset_copy');

  // Duplicate button should now be enabled
  const duplicateButton = await screen.findByRole('button', {
    name: /duplicate/i,
  });
  expect(duplicateButton).toBeEnabled();
});

test('clicking Duplicate calls onDuplicate with new name', async () => {
  const onHide = jest.fn();
  const onDuplicate = jest.fn();

  renderModal(mockDataset, onHide, onDuplicate);

  const input = await screen.findByTestId('duplicate-modal-input');

  // Type a new name
  await userEvent.type(input, 'new_dataset_copy');

  // Click Duplicate button
  const duplicateButton = await screen.findByRole('button', {
    name: /duplicate/i,
  });
  await userEvent.click(duplicateButton);

  // onDuplicate should be called with the new name
  await waitFor(() => {
    expect(onDuplicate).toHaveBeenCalledWith('new_dataset_copy');
  });
});

test('pressing Enter key triggers duplicate action', async () => {
  const onHide = jest.fn();
  const onDuplicate = jest.fn();

  renderModal(mockDataset, onHide, onDuplicate);

  const input = await screen.findByTestId('duplicate-modal-input');

  // Clear any existing value and type new name with Enter at end
  await userEvent.clear(input);
  await userEvent.type(input, 'new_dataset_copy{enter}');

  // onDuplicate should be called by onPressEnter handler
  await waitFor(() => {
    expect(onDuplicate).toHaveBeenCalledWith('new_dataset_copy');
  });
});

test('modal closes when onHide is called', async () => {
  const onHide = jest.fn();
  const onDuplicate = jest.fn();

  const { rerender } = renderModal(mockDataset, onHide, onDuplicate);

  expect(await screen.findByText('Duplicate dataset')).toBeInTheDocument();

  // Simulate closing the modal by setting dataset to null
  rerender(
    <Wrapper dataset={null} onHide={onHide} onDuplicate={onDuplicate} />,
  );

  // Modal should no longer be visible (Ant Design keeps it in DOM but hides it)
  await waitFor(() => {
    expect(screen.queryByText('Duplicate dataset')).not.toBeVisible();
  });
});

test('cancel button clears input and closes modal', async () => {
  const onHide = jest.fn();
  const onDuplicate = jest.fn();

  const { rerender } = renderModal(mockDataset, onHide, onDuplicate);

  const input = await screen.findByTestId('duplicate-modal-input');

  // Type some text
  await userEvent.type(input, 'test_name');

  expect(input).toHaveValue('test_name');

  // Click cancel button
  const cancelButton = await screen.findByRole('button', { name: /cancel/i });
  await userEvent.click(cancelButton);

  // onHide should be called
  expect(onHide).toHaveBeenCalled();

  // Simulate closing the modal (parent sets dataset to null)
  rerender(
    <Wrapper dataset={null} onHide={onHide} onDuplicate={onDuplicate} />,
  );

  // Modal should be hidden
  await waitFor(() => {
    expect(screen.queryByText('Duplicate dataset')).not.toBeVisible();
  });

  // Reopen with same dataset - input should be cleared
  rerender(
    <Wrapper dataset={mockDataset} onHide={onHide} onDuplicate={onDuplicate} />,
  );

  const reopenedInput = await screen.findByTestId('duplicate-modal-input');
  expect(reopenedInput).toHaveValue('');
});

test('input field clears when new dataset is provided', async () => {
  const onHide = jest.fn();
  const onDuplicate = jest.fn();

  const { rerender } = renderModal(mockDataset, onHide, onDuplicate);

  const input = await screen.findByTestId('duplicate-modal-input');

  // Type a name
  await userEvent.type(input, 'old_name');

  expect(input).toHaveValue('old_name');

  // Switch to different dataset
  const newDataset: VirtualDatasetFixture = {
    ...mockDataset,
    id: 2,
    table_name: 'different_dataset',
  };

  rerender(
    <Wrapper dataset={newDataset} onHide={onHide} onDuplicate={onDuplicate} />,
  );

  // Input should be cleared
  await waitFor(() => {
    expect(input).toHaveValue('');
  });
});
