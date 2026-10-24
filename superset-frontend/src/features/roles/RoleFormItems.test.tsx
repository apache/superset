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
import { fetchUserOptions, toUserSelectOption } from '../groups/utils';
import { fetchPermissionOptions } from './utils';

jest.mock('./utils', () => ({
  fetchPermissionOptions: jest.fn(),
  fetchGroupOptions: jest.fn(),
}));

jest.mock('../groups/utils', () => ({
  ...jest.requireActual('../groups/utils'),
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

test('UsersField shows a user matched by email even though the label is their name', async () => {
  // fetchUserOptions matches email server-side, but the option label is the
  // display name. AsyncSelect's client-side re-filter must use the option's
  // plain-text name and email props, or the server-matched option is hidden.
  jest
    .mocked(fetchUserOptions)
    .mockImplementation(async (filterValue: string) =>
      filterValue === 'jane@example.com'
        ? {
            data: [
              toUserSelectOption({
                id: 7,
                username: 'jsmith',
                first_name: 'Jane',
                last_name: 'Smith',
                email: 'jane@example.com',
              }),
            ],
            totalCount: 1,
          }
        : // totalCount must exceed the empty initial page here, otherwise
          // AsyncSelect marks allValuesLoaded and short-circuits every
          // later fetch, including the search request this test depends on.
          { data: [], totalCount: 1 },
    );

  render(<UsersField addDangerToast={addDangerToast} loading={false} />);
  const combobox = screen.getByRole('combobox');
  await waitFor(() => userEvent.click(combobox));
  await userEvent.clear(combobox);
  await userEvent.type(combobox, 'jane@example.com', { delay: 10 });

  await waitFor(() =>
    expect(fetchUserOptions).toHaveBeenCalledWith(
      'jane@example.com',
      expect.anything(),
      expect.anything(),
      addDangerToast,
    ),
  );
  const dropdown = within(document.querySelector('.ant-select-dropdown-list')!);
  expect(await dropdown.findByText('Jane Smith')).toBeInTheDocument();
  expect(dropdown.getByText('jane@example.com')).toBeInTheDocument();
});

test('UsersField shows a user matched by username even though neither line shows it', async () => {
  // fetchUserOptions matches username server-side, but the option shows only
  // the display name and email. The client-side re-filter must also check the
  // username prop, or a user found by an opaque SSO username is hidden.
  jest
    .mocked(fetchUserOptions)
    .mockImplementation(async (filterValue: string) =>
      filterValue === '00f09b2e'
        ? {
            data: [
              toUserSelectOption({
                id: 8,
                username: '00f09b2e-f4fb-48a3-80fc-53ccd9528021',
                first_name: 'Bob',
                last_name: 'Jones',
                email: 'bob.jones@corp.example.org',
              }),
            ],
            totalCount: 1,
          }
        : { data: [], totalCount: 1 },
    );

  render(<UsersField addDangerToast={addDangerToast} loading={false} />);
  const combobox = screen.getByRole('combobox');
  await waitFor(() => userEvent.click(combobox));
  await userEvent.clear(combobox);
  await userEvent.type(combobox, '00f09b2e', { delay: 10 });

  await waitFor(() =>
    expect(fetchUserOptions).toHaveBeenCalledWith(
      '00f09b2e',
      expect.anything(),
      expect.anything(),
      addDangerToast,
    ),
  );
  const dropdown = within(document.querySelector('.ant-select-dropdown-list')!);
  expect(await dropdown.findByText('Bob Jones')).toBeInTheDocument();
  expect(dropdown.getByText('bob.jones@corp.example.org')).toBeInTheDocument();
  expect(dropdown.queryByText(/00f09b2e/)).not.toBeInTheDocument();
});

test('UsersField orders users by display name rather than by id', async () => {
  // Ids 1, 2, 3 are Zoe, Amy, Max. AsyncSelect's default comparator ranks only
  // string labels and falls back to the option value, so without
  // userOptionSortComparator the React-element labels render in id order.
  jest.mocked(fetchUserOptions).mockResolvedValue({
    data: [
      toUserSelectOption({ id: 1, username: 'zoe', first_name: 'Zoe' }),
      toUserSelectOption({ id: 2, username: 'amy', first_name: 'Amy' }),
      toUserSelectOption({ id: 3, username: 'max', first_name: 'Max' }),
    ],
    totalCount: 3,
  });

  render(<UsersField addDangerToast={addDangerToast} loading={false} />);
  await waitFor(() => userEvent.click(screen.getByRole('combobox')));

  const optionTitles = () =>
    Array.from(
      document.querySelectorAll('.ant-select-dropdown .ant-select-item-option'),
    ).map(option => option.getAttribute('title'));
  await waitFor(() => expect(optionTitles()).toHaveLength(3));
  expect(optionTitles()).toEqual(['Amy', 'Max', 'Zoe']);
});

test('UsersField options are announced by name rather than by user id', async () => {
  // The virtualized option list derives an aria-label only from a string
  // label, so a React-element label would leave the numeric id as the name.
  jest.mocked(fetchUserOptions).mockResolvedValue({
    data: [toUserSelectOption({ id: 42, username: 'amy', first_name: 'Amy' })],
    totalCount: 1,
  });

  render(<UsersField addDangerToast={addDangerToast} loading={false} />);
  await waitFor(() => userEvent.click(screen.getByRole('combobox')));

  expect(
    await screen.findByRole('option', { name: 'Amy' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: '42' })).not.toBeInTheDocument();
});

test('GroupsField renders label and select', () => {
  render(<GroupsField addDangerToast={addDangerToast} />);
  expect(screen.getByText('Groups')).toBeInTheDocument();
  expect(screen.getByTestId('groups-select')).toBeInTheDocument();
});
