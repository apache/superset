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
import { render, screen } from 'spec/helpers/testing-library';
import {
  RoleNameField,
  PermissionsField,
  UsersField,
  GroupsField,
} from './RoleFormItems';

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
  render(
    <PermissionsField addDangerToast={addDangerToast} />,
  );
  expect(screen.getByText('Permissions')).toBeInTheDocument();
});

test('PermissionsField renders loading state', () => {
  render(
    <PermissionsField addDangerToast={addDangerToast} loading />,
  );
  expect(screen.getByText('Permissions')).toBeInTheDocument();
});

test('UsersField renders label and select', () => {
  render(
    <UsersField addDangerToast={addDangerToast} loading={false} />,
  );
  expect(screen.getAllByText('Users')[0]).toBeInTheDocument();
});

test('GroupsField renders label and select', () => {
  render(
    <GroupsField addDangerToast={addDangerToast} />,
  );
  expect(screen.getByText('Groups')).toBeInTheDocument();
});
