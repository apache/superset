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
import userEvent from '@testing-library/user-event';
import {
  render,
  screen,
  selectOption,
  waitFor,
} from 'spec/helpers/testing-library';
import { DashboardFolderPanel } from './DashboardFolderPanel';

const folders = [
  {
    id: 'parent',
    name: 'Finance',
    parent_id: null,
    dashboard_count: 2,
    can_create: true,
    can_rename: true,
    can_delete: true,
    can_move_dashboard: true,
  },
  {
    id: 'child',
    name: 'Monthly reports',
    parent_id: 'parent',
    dashboard_count: 1,
    can_create: false,
    can_rename: false,
    can_delete: false,
    can_move_dashboard: false,
  },
];

test('renders nested folders without dashboard counts', () => {
  render(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId={null}
      canCreate
      onSelect={jest.fn()}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />,
  );

  expect(screen.queryByText('All dashboards')).not.toBeInTheDocument();
  expect(screen.getByText('Finance')).toBeVisible();
  expect(screen.getByText('Monthly reports')).toBeVisible();
  expect(screen.queryByText(/^Dashboards:/)).not.toBeInTheDocument();
});

test('expands the selected folder ancestry when selection comes from a filter', async () => {
  const { rerender } = render(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId={null}
      canCreate
      onSelect={jest.fn()}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />,
  );

  const treeSwitcher = document.querySelector('.ant-tree-switcher');
  await userEvent.click(treeSwitcher as Element);
  expect(screen.queryByText('Monthly reports')).not.toBeInTheDocument();

  rerender(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId="child"
      canCreate
      onSelect={jest.fn()}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />,
  );

  expect(await screen.findByText('Monthly reports')).toBeVisible();
});

test('selects a folder and hides write actions for read-only folders', async () => {
  const onSelect = jest.fn();
  render(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId={null}
      canCreate={false}
      onSelect={onSelect}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />,
  );

  await userEvent.click(screen.getByText('Monthly reports'));
  expect(onSelect).toHaveBeenCalledWith('child');
  expect(
    screen.queryByLabelText('Create dashboard folder'),
  ).not.toBeInTheDocument();
});

test('collapses the panel and nested folders', async () => {
  const { container } = render(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId={null}
      canCreate
      onSelect={jest.fn()}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />,
  );

  const treeSwitcher = container.querySelector('.ant-tree-switcher');
  expect(treeSwitcher).not.toBeNull();
  await userEvent.click(treeSwitcher as Element);
  expect(screen.queryByText('Monthly reports')).not.toBeInTheDocument();

  await userEvent.click(screen.getByLabelText('Collapse folders'));
  expect(screen.queryByText('Finance')).not.toBeInTheDocument();
  await userEvent.click(screen.getByLabelText('Expand folders'));
  expect(screen.getByText('Finance')).toBeVisible();
});

test('expands nested folders loaded after the first render', async () => {
  const { rerender } = render(
    <DashboardFolderPanel
      folders={[folders[0]]}
      selectedFolderId={null}
      canCreate
      onSelect={jest.fn()}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />,
  );

  rerender(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId={null}
      canCreate
      onSelect={jest.fn()}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />,
  );

  expect(await screen.findByText('Monthly reports')).toBeVisible();
});

test('keeps the delete modal mounted until deletion finishes', async () => {
  let finishDelete: (() => void) | undefined;
  const onDelete = jest.fn(
    () =>
      new Promise<void>(resolve => {
        finishDelete = resolve;
      }),
  );
  render(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId={null}
      canCreate
      onSelect={jest.fn()}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={onDelete}
    />,
  );

  await userEvent.click(screen.getByLabelText('Delete folder'));
  await userEvent.type(screen.getByTestId('delete-modal-input'), 'DELETE');
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

  expect(onDelete).toHaveBeenCalledWith(folders[0]);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  finishDelete?.();
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

test('does not render an expand arrow for an empty folder', () => {
  const { container } = render(
    <DashboardFolderPanel
      folders={[folders[0]]}
      selectedFolderId={null}
      canCreate
      onSelect={jest.fn()}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />,
  );

  expect(container.querySelector('.ant-tree-switcher-noop')).not.toBeNull();
});

test('expanding a folder does not change the selected filter', async () => {
  const onSelect = jest.fn();
  const { container } = render(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId="parent"
      canCreate
      onSelect={onSelect}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />,
  );

  await userEvent.click(
    container.querySelector(
      '.ant-tree-switcher:not(.ant-tree-switcher-noop)',
    ) as Element,
  );

  expect(onSelect).not.toHaveBeenCalled();
});

test('clears the folder filter when selecting the active folder again', async () => {
  const onSelect = jest.fn();
  render(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId="parent"
      canCreate
      onSelect={onSelect}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />,
  );

  await userEvent.click(screen.getByText('Finance'));
  expect(onSelect).toHaveBeenCalledWith(null);
});

test('submits a normalized name and parent when creating a child folder', async () => {
  const onCreate = jest.fn().mockResolvedValue(undefined);
  render(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId={null}
      canCreate
      onSelect={jest.fn()}
      onCreate={onCreate}
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />,
  );

  await userEvent.click(screen.getByLabelText('Create dashboard folder'));
  await userEvent.type(screen.getByLabelText('Folder name'), '  Forecasts  ');
  await selectOption('Finance', 'Parent folder');
  await userEvent.click(screen.getByRole('button', { name: 'Create' }));

  expect(onCreate).toHaveBeenCalledWith('Forecasts', 'parent');
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

test('submits the new name when renaming a folder', async () => {
  const onRename = jest.fn().mockResolvedValue(undefined);
  render(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId={null}
      canCreate
      onSelect={jest.fn()}
      onCreate={jest.fn()}
      onRename={onRename}
      onDelete={jest.fn()}
    />,
  );

  await userEvent.click(screen.getByLabelText('Rename folder'));
  const nameInput = screen.getByLabelText('Folder name');
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, '  Planning  ');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(onRename).toHaveBeenCalledWith(folders[0], 'Planning');
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

test('closes the delete modal without deleting the folder', async () => {
  const onDelete = jest.fn();
  render(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId={null}
      canCreate
      onSelect={jest.fn()}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={onDelete}
    />,
  );

  await userEvent.click(screen.getByLabelText('Delete folder'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(onDelete).not.toHaveBeenCalled();
});

test('keeps the uncategorized entry switchable with the list filter', async () => {
  const onSelect = jest.fn();
  const { rerender } = render(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId={null}
      canCreate
      onSelect={onSelect}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />,
  );

  await userEvent.click(screen.getByText('Uncategorized'));
  expect(onSelect).toHaveBeenLastCalledWith('uncategorized');

  rerender(
    <DashboardFolderPanel
      folders={folders}
      selectedFolderId="uncategorized"
      canCreate
      onSelect={onSelect}
      onCreate={jest.fn()}
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />,
  );
  await userEvent.click(screen.getByText('Uncategorized'));
  expect(onSelect).toHaveBeenLastCalledWith(null);
});
