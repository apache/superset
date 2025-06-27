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
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import RoleListEditModal from './RoleListEditModal';
import {
  updateRoleName,
  updateRolePermissions,
  updateRoleUsers,
} from './utils';

const mockToasts = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
};

jest.mock('./utils');
const mockUpdateRoleName = jest.mocked(updateRoleName);
const mockUpdateRolePermissions = jest.mocked(updateRolePermissions);
const mockUpdateRoleUsers = jest.mocked(updateRoleUsers);

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: any) => Component,
  useToasts: () => mockToasts,
}));

jest.mock('@superset-ui/core', () => {
  const original = jest.requireActual('@superset-ui/core');
  return {
    ...original,
    SupersetClient: {
      get: jest.fn(),
    },
    t: (str: string) => str,
  };
});

describe('RoleListEditModal', () => {
  const mockRole = {
    id: 1,
    name: 'Admin',
    permission_ids: [10, 20],
    user_ids: [5, 7],
    group_ids: [1, 2],
  };

  const mockPermissions = [
    { id: 10, label: 'Permission A', value: 'perm_a' },
    { id: 20, label: 'Permission B', value: 'perm_b' },
  ];

  const mockUsers = [
    {
      id: 5,
      firstName: 'John',
      lastName: 'Doe',
      username: 'johndoe',
      email: 'john@example.com',
      isActive: true,
      roles: [
        {
          id: 1,
          name: 'Admin',
        },
      ],
    },
  ];

  const mockGroups = [
    {
      id: 1,
      name: 'Group A',
      label: 'Group A',
      description: 'Description A',
      roles: [],
      users: [],
    },
  ];

  const mockProps = {
    role: mockRole,
    show: true,
    onHide: jest.fn(),
    onSave: jest.fn(),
    permissions: mockPermissions,
    users: mockUsers,
    groups: mockGroups,
  };

  it('renders modal with correct title and fields', () => {
    render(<RoleListEditModal {...mockProps} />);
    expect(screen.getAllByText('Edit Role')[0]).toBeInTheDocument();
    expect(screen.getByText('Role Name')).toBeInTheDocument();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
    expect(screen.getAllByText('Users')[0]).toBeInTheDocument();
  });

  it('calls onHide when cancel button is clicked', () => {
    render(<RoleListEditModal {...mockProps} />);
    fireEvent.click(screen.getByTestId('modal-cancel-button'));
    expect(mockProps.onHide).toHaveBeenCalled();
  });

  it('disables save button when role name is empty', () => {
    render(<RoleListEditModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: '' },
    });
    expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
  });

  it('enables save button when role name is entered', () => {
    render(<RoleListEditModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Updated Role' },
    });
    expect(screen.getByTestId('form-modal-save-button')).toBeEnabled();
  });

  it('calls update functions when save button is clicked', async () => {
    (SupersetClient.get as jest.Mock).mockImplementation(({ endpoint }) => {
      if (endpoint?.includes('/api/v1/security/users/')) {
        return Promise.resolve({
          json: {
            count: 2,
            result: [
              {
                id: 5,
                first_name: 'John',
                last_name: 'Doe',
                username: 'johndoe',
                email: 'john@example.com',
                is_active: true,
              },
              {
                id: 7,
                first_name: 'Jane',
                last_name: 'Smith',
                username: 'janesmith',
                email: 'jane@example.com',
                is_active: true,
              },
            ],
          },
        });
      }

      return Promise.resolve({ json: { count: 0, result: [] } });
    });

    render(<RoleListEditModal {...mockProps} />);

    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Updated Role' },
    });

    fireEvent.click(screen.getByTestId('form-modal-save-button'));

    await waitFor(() => {
      expect(mockUpdateRoleName).toHaveBeenCalledWith(
        mockRole.id,
        'Updated Role',
      );
      expect(mockUpdateRolePermissions).toHaveBeenCalledWith(
        mockRole.id,
        mockRole.permission_ids,
      );
      expect(mockUpdateRoleUsers).toHaveBeenCalledWith(
        mockRole.id,
        mockRole.user_ids,
      );
      expect(mockProps.onSave).toHaveBeenCalled();
    });
  });

  it('switches tabs correctly', () => {
    render(<RoleListEditModal {...mockProps} />);

    const usersTab = screen.getByRole('tab', { name: 'Users' });
    fireEvent.click(usersTab);

    expect(screen.getByText('First Name')).toBeInTheDocument();
    expect(screen.getByText('Last Name')).toBeInTheDocument();
    expect(screen.getByText('User Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });
});
