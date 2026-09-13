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
import { render, screen, selectOption } from 'spec/helpers/testing-library';
import { MoveDashboardFolderModal } from './MoveDashboardFolderModal';

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
    can_create: true,
    can_rename: true,
    can_delete: true,
    can_move_dashboard: true,
  },
];

test('moves to the parent when no child folder is selected', async () => {
  const onMove = jest.fn().mockResolvedValue(undefined);
  render(
    <MoveDashboardFolderModal
      dashboardTitle="Revenue"
      folders={folders}
      onHide={jest.fn()}
      onMove={onMove}
    />,
  );

  await selectOption('Finance', 'Parent folder');
  await userEvent.click(screen.getByRole('button', { name: 'Move' }));

  expect(onMove).toHaveBeenCalledWith('parent');
});

test('selects a child folder after its parent', async () => {
  const onMove = jest.fn().mockResolvedValue(undefined);
  render(
    <MoveDashboardFolderModal
      dashboardTitle="Revenue"
      folders={folders}
      onHide={jest.fn()}
      onMove={onMove}
    />,
  );

  await selectOption('Finance', 'Parent folder');
  await userEvent.click(screen.getByRole('combobox', { name: 'Child folder' }));
  await userEvent.click(
    await screen.findByRole('option', { name: 'Monthly reports' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Move' }));

  expect(onMove).toHaveBeenCalledWith('child');
});

test('uses a read-only parent to navigate to a writable child', async () => {
  const onMove = jest.fn().mockResolvedValue(undefined);
  render(
    <MoveDashboardFolderModal
      dashboardTitle="Revenue"
      folders={[{ ...folders[0], can_move_dashboard: false }, folders[1]]}
      onHide={jest.fn()}
      onMove={onMove}
    />,
  );

  await selectOption('Finance', 'Parent folder');
  expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();
  await userEvent.click(screen.getByRole('combobox', { name: 'Child folder' }));
  await userEvent.click(
    await screen.findByRole('option', { name: 'Monthly reports' }),
  );
  expect(screen.getByRole('button', { name: 'Move' })).toBeEnabled();
});

test('initializes parent and child selections and moves the dashboard', async () => {
  const onHide = jest.fn();
  const onMove = jest.fn().mockResolvedValue(undefined);
  render(
    <MoveDashboardFolderModal
      dashboardTitle="Revenue"
      currentFolderId="child"
      folders={folders}
      onHide={onHide}
      onMove={onMove}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Move' }));

  expect(onMove).toHaveBeenCalledWith('child');
  expect(onHide).toHaveBeenCalledTimes(1);
});

test('falls back to uncategorized for an unknown current folder', async () => {
  const onMove = jest.fn().mockResolvedValue(undefined);
  render(
    <MoveDashboardFolderModal
      dashboardTitle="Revenue"
      currentFolderId="missing"
      folders={folders}
      onHide={jest.fn()}
      onMove={onMove}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Move' }));
  expect(onMove).toHaveBeenCalledWith(null);
});

test('shows the full hierarchy path in child folder options', async () => {
  const grandchild = {
    ...folders[1],
    id: 'grandchild',
    name: 'August',
    parent_id: 'child',
  };
  render(
    <MoveDashboardFolderModal
      dashboardTitle="Revenue"
      folders={[...folders, grandchild]}
      onHide={jest.fn()}
      onMove={jest.fn().mockResolvedValue(undefined)}
    />,
  );

  await selectOption('Finance', 'Parent folder');
  await userEvent.click(screen.getByRole('combobox', { name: 'Child folder' }));
  expect(
    await screen.findByRole('option', { name: 'Monthly reports / August' }),
  ).toBeInTheDocument();
});
