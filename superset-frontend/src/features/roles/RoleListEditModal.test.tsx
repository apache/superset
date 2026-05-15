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
import rison from 'rison';
import RoleListEditModal from './RoleListEditModal';
import {
  updateRoleName,
  updateRoleGroups,
  updateRolePermissions,
  updateRoleUsers,
} from './utils';

const mockToasts = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
};

jest.mock('./utils');
const mockUpdateRoleName = jest.mocked(updateRoleName);
const mockUpdateRoleGroups = jest.mocked(updateRoleGroups);
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

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('RoleListEditModal', () => {
  const mockRole = {
    id: 1,
    name: 'Admin',
    permission_ids: [10, 20],
    user_ids: [5, 7],
    group_ids: [1, 2],
  };

  const mockProps = {
    role: mockRole,
    show: true,
    onHide: jest.fn(),
    onSave: jest.fn(),
  };

  test('renders modal with correct title and fields', () => {
    render(<RoleListEditModal {...mockProps} />);
    expect(screen.getAllByText('Edit Role')[0]).toBeInTheDocument();
    expect(screen.getByText('Role Name')).toBeInTheDocument();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
    expect(screen.getAllByText('Users')[0]).toBeInTheDocument();
  });

  test('calls onHide when cancel button is clicked', () => {
    render(<RoleListEditModal {...mockProps} />);
    fireEvent.click(screen.getByTestId('modal-cancel-button'));
    expect(mockProps.onHide).toHaveBeenCalled();
  });

  test('disables save button when role name is empty', () => {
    render(<RoleListEditModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: '' },
    });
    expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
  });

  test('enables save button when role name is entered', () => {
    render(<RoleListEditModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Updated Role' },
    });
    expect(screen.getByTestId('form-modal-save-button')).toBeEnabled();
  });

  test('submit maps {value,label} form values to numeric ID arrays', async () => {
    // initialValues sets permissions/groups as {value, label} objects
    // (e.g. [{value: 10, label: "10"}, {value: 20, label: "20"}]).
    // The submit handler must convert these to plain number arrays
    // before calling the update APIs.
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

    // Wait for user hydration to complete so setFieldsValue has populated
    // the form with the fetched users before submitting.
    await screen.findByText('johndoe');
    await screen.findByText('janesmith');

    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Updated Role' },
    });

    fireEvent.click(screen.getByTestId('form-modal-save-button'));

    await waitFor(() => {
      expect(mockUpdateRoleName).toHaveBeenCalledWith(
        mockRole.id,
        'Updated Role',
      );

      // Verify APIs receive plain number[], not {value, label}[]
      const permissionArg = mockUpdateRolePermissions.mock.calls[0][1];
      expect(permissionArg).toEqual([10, 20]);
      expect(permissionArg.every((id: unknown) => typeof id === 'number')).toBe(
        true,
      );

      const userArg = mockUpdateRoleUsers.mock.calls[0][1];
      expect(userArg).toEqual([5, 7]);
      expect(userArg.every((id: unknown) => typeof id === 'number')).toBe(true);

      const groupArg = mockUpdateRoleGroups.mock.calls[0][1];
      expect(groupArg).toEqual([1, 2]);
      expect(groupArg.every((id: unknown) => typeof id === 'number')).toBe(
        true,
      );

      expect(mockProps.onSave).toHaveBeenCalled();
    });
  });

  test('switches tabs correctly', () => {
    render(<RoleListEditModal {...mockProps} />);

    const usersTab = screen.getByRole('tab', { name: 'Users' });
    fireEvent.click(usersTab);

    expect(screen.getByTitle('First Name')).toBeInTheDocument();
    expect(screen.getByTitle('Last Name')).toBeInTheDocument();
    expect(screen.getByTitle('User Name')).toBeInTheDocument();
    expect(screen.getByTitle('Email')).toBeInTheDocument();
  });

  test('fetches users with correct role relationship filter', async () => {
    const mockGet = SupersetClient.get as jest.Mock;
    mockGet.mockResolvedValue({
      json: {
        count: 0,
        result: [],
      },
    });

    render(<RoleListEditModal {...mockProps} />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    const usersCall = mockGet.mock.calls.find(([call]) =>
      call.endpoint.includes('/api/v1/security/users/'),
    )?.[0];
    expect(usersCall).toBeTruthy();
    if (!usersCall) {
      throw new Error('Expected users call to be defined');
    }

    const urlMatch = usersCall.endpoint.match(/\?q=(.+)/);
    expect(urlMatch).toBeTruthy();

    const decodedQuery = rison.decode(urlMatch[1]);
    expect(decodedQuery).toEqual({
      page_size: 100,
      page: 0,
      filters: [
        {
          col: 'roles',
          opr: 'rel_m_m',
          value: mockRole.id,
        },
      ],
    });
  });

  test('preserves missing IDs as numeric fallbacks on partial hydration', async () => {
    const mockGet = SupersetClient.get as jest.Mock;
    mockGet.mockImplementation(({ endpoint }) => {
      if (endpoint?.includes('/api/v1/security/permissions-resources/')) {
        // Only return permission id=10, not id=20
        return Promise.resolve({
          json: {
            count: 1,
            result: [
              {
                id: 10,
                permission: { name: 'can_read' },
                view_menu: { name: 'Dashboard' },
              },
            ],
          },
        });
      }
      if (endpoint?.includes('/api/v1/security/groups/')) {
        // Only return group id=1, not id=2
        return Promise.resolve({
          json: {
            count: 1,
            result: [{ id: 1, name: 'Engineering' }],
          },
        });
      }
      return Promise.resolve({ json: { count: 0, result: [] } });
    });

    render(<RoleListEditModal {...mockProps} />);

    await waitFor(() => {
      expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
        'Some permissions could not be resolved and are shown as IDs.',
      );
      expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
        'Some groups could not be resolved and are shown as IDs.',
      );
    });
  });

  test('does not fire fallback toast when hydration fetch fails', async () => {
    mockToasts.addDangerToast.mockClear();
    const mockGet = SupersetClient.get as jest.Mock;
    mockGet.mockImplementation(({ endpoint }) => {
      if (endpoint?.includes('/api/v1/security/permissions-resources/')) {
        return Promise.reject(new Error('network error'));
      }
      if (endpoint?.includes('/api/v1/security/groups/')) {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve({ json: { count: 0, result: [] } });
    });

    render(<RoleListEditModal {...mockProps} />);

    await waitFor(() => {
      // fetchPaginatedData fires the error toasts
      expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
        'There was an error loading permissions.',
      );
      expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
        'There was an error loading groups.',
      );
    });

    // The fallback "shown as IDs" toasts should NOT have fired
    expect(mockToasts.addDangerToast).not.toHaveBeenCalledWith(
      'Some permissions could not be resolved and are shown as IDs.',
    );
    expect(mockToasts.addDangerToast).not.toHaveBeenCalledWith(
      'Some groups could not be resolved and are shown as IDs.',
    );
  });

  test('fires warning toast when hydration returns zero rows but IDs were expected', async () => {
    const mockGet = SupersetClient.get as jest.Mock;
    mockGet.mockImplementation(({ endpoint }) =>
      Promise.resolve({ json: { count: 0, result: [] } }),
    );

    render(<RoleListEditModal {...mockProps} />);

    await waitFor(() => {
      // Both warnings should fire because IDs were expected but none resolved
      expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
        'Some permissions could not be resolved and are shown as IDs.',
      );
      expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
        'Some groups could not be resolved and are shown as IDs.',
      );
    });
  });

  test('does not leak state when switching roles', async () => {
    const mockGet = SupersetClient.get as jest.Mock;

    // Role A: returns permission 10 with label
    const roleA = {
      id: 1,
      name: 'RoleA',
      permission_ids: [10],
      user_ids: [],
      group_ids: [],
    };
    // Role B: returns permission 30 with label
    const roleB = {
      id: 2,
      name: 'RoleB',
      permission_ids: [30],
      user_ids: [],
      group_ids: [],
    };

    mockGet.mockImplementation(({ endpoint }) => {
      if (endpoint?.includes('/api/v1/security/permissions-resources/')) {
        const query = rison.decode(endpoint.split('?q=')[1]) as Record<
          string,
          unknown
        >;
        const filters = query.filters as Array<{
          col: string;
          opr: string;
          value: number[];
        }>;
        const ids = filters?.[0]?.value || [];
        const result = ids.map((id: number) => ({
          id,
          permission: { name: `perm_${id}` },
          view_menu: { name: `view_${id}` },
        }));
        return Promise.resolve({
          json: { count: result.length, result },
        });
      }
      return Promise.resolve({ json: { count: 0, result: [] } });
    });

    const { rerender, unmount } = render(
      <RoleListEditModal
        role={roleA}
        show
        onHide={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    await waitFor(() => {
      const permCall = mockGet.mock.calls.find(([c]) =>
        c.endpoint.includes('/api/v1/security/permissions-resources/'),
      );
      expect(permCall).toBeTruthy();
    });

    mockGet.mockClear();
    mockToasts.addDangerToast.mockClear();

    // Switch to Role B
    rerender(
      <RoleListEditModal
        role={roleB}
        show
        onHide={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    await waitFor(() => {
      const permCalls = mockGet.mock.calls.filter(([c]) =>
        c.endpoint.includes('/api/v1/security/permissions-resources/'),
      );
      expect(permCalls.length).toBeGreaterThan(0);
      // Should request role B's IDs, not role A's
      const query = rison.decode(
        permCalls[0][0].endpoint.split('?q=')[1],
      ) as Record<string, unknown>;
      const filters = query.filters as Array<{
        col: string;
        opr: string;
        value: number[];
      }>;
      expect(filters[0].value).toEqual(roleB.permission_ids);
    });

    unmount();
    mockGet.mockReset();
  });

  test('fetches permissions and groups by id for hydration', async () => {
    const mockGet = SupersetClient.get as jest.Mock;
    mockGet.mockResolvedValue({
      json: {
        count: 0,
        result: [],
      },
    });

    render(<RoleListEditModal {...mockProps} />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    const permissionCall = mockGet.mock.calls.find(([call]) =>
      call.endpoint.includes('/api/v1/security/permissions-resources/'),
    )?.[0];
    const groupsCall = mockGet.mock.calls.find(([call]) =>
      call.endpoint.includes('/api/v1/security/groups/'),
    )?.[0];

    expect(permissionCall).toBeTruthy();
    expect(groupsCall).toBeTruthy();
    if (!permissionCall || !groupsCall) {
      throw new Error('Expected hydration calls to be defined');
    }

    const permissionQuery = permissionCall.endpoint.match(/\?q=(.+)/);
    const groupsQuery = groupsCall.endpoint.match(/\?q=(.+)/);
    expect(permissionQuery).toBeTruthy();
    expect(groupsQuery).toBeTruthy();
    if (!permissionQuery || !groupsQuery) {
      throw new Error('Expected query params to be present');
    }

    expect(rison.decode(permissionQuery[1])).toEqual({
      page_size: 100,
      page: 0,
      filters: [
        {
          col: 'id',
          opr: 'in',
          value: mockRole.permission_ids,
        },
      ],
    });

    expect(rison.decode(groupsQuery[1])).toEqual({
      page_size: 100,
      page: 0,
      filters: [
        {
          col: 'id',
          opr: 'in',
          value: mockRole.group_ids,
        },
      ],
    });
  });
});
