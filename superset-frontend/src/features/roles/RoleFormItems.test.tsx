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
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import {
  RoleNameField,
  PermissionsField,
  UsersField,
  GroupsField,
} from './RoleFormItems';
import { fetchPermissionOptions } from './utils';

jest.mock('./utils', () => ({
  fetchPermissionOptions: jest.fn(),
  fetchGroupOptions: jest.fn(),
}));

jest.mock('../groups/utils', () => ({
  fetchUserOptions: jest.fn(),
}));

const addDangerToast = jest.fn();

test('RoleNameField renders label and input', () => {
  render(<RoleNameField />);
  expect(screen.getByText('Role Name')).toBeInTheDocument();
  expect(screen.getByTestId('role-name-input')).toBeInTheDocument();
});

test('PermissionsField renders label and select', () => {
  render(<PermissionsField addDangerToast={addDangerToast} />);
  expect(screen.getByText('Permissions')).toBeInTheDocument();
  expect(screen.getByTestId('permissions-select')).toBeInTheDocument();
});

test('PermissionsField renders loading state', () => {
  render(<PermissionsField addDangerToast={addDangerToast} loading />);
  expect(screen.getByText('Permissions')).toBeInTheDocument();
  expect(screen.getByTestId('permissions-select')).toBeInTheDocument();
});

test('PermissionsField shows a permission matched by its raw name even though the label uses spaces (regression for #42041)', async () => {
  // fetchPermissionOptions matches the raw, underscore-containing name
  // server-side; the returned label has already gone through
  // formatPermissionLabel (underscores replaced with spaces for display).
  // PermissionsField's normalizing filterOption must match the raw search
  // term against that space-formatted label, or the option the server
  // legitimately returned gets hidden by client-side re-filtering.
  jest
    .mocked(fetchPermissionOptions)
    .mockImplementation(async (filterValue: string) =>
      filterValue === 'stg_silver'
        ? { data: [{ value: 1, label: 'stg silver' }], totalCount: 1 }
        : // totalCount must exceed the empty initial page here, otherwise
          // AsyncSelect marks allValuesLoaded and short-circuits every
          // later fetch, including the search request this test depends on.
          { data: [], totalCount: 1 },
    );

  render(<PermissionsField addDangerToast={addDangerToast} />);
  const combobox = screen.getByRole('combobox');
  await waitFor(() => userEvent.click(combobox));
  await userEvent.clear(combobox);
  await userEvent.type(combobox, 'stg_silver', { delay: 10 });

  await waitFor(() =>
    expect(fetchPermissionOptions).toHaveBeenCalledWith(
      'stg_silver',
      expect.anything(),
      expect.anything(),
      addDangerToast,
    ),
  );
  expect(
    await within(
      document.querySelector('.ant-select-dropdown-list')!,
    ).findByText('stg silver'),
  ).toBeInTheDocument();
});

test('UsersField renders label and select', () => {
  render(<UsersField addDangerToast={addDangerToast} loading={false} />);
  expect(screen.getByText('Users')).toBeInTheDocument();
  expect(screen.getByTestId('roles-select')).toBeInTheDocument();
});

test('GroupsField renders label and select', () => {
  render(<GroupsField addDangerToast={addDangerToast} />);
  expect(screen.getByText('Groups')).toBeInTheDocument();
  expect(screen.getByTestId('groups-select')).toBeInTheDocument();
});
