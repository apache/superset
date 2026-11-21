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
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import RoleListEditModalComponent, {
  RoleListEditModalProps,
} from './RoleListEditModal';
import {
  formatPermissionLabel,
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

// RolesList mounts the editor only while its edit modal is open.
function RoleListEditModal(props: RoleListEditModalProps) {
  return props.show ? <RoleListEditModalComponent {...props} /> : null;
}

type HydrationResponse = { json: { count: number; result: object[] } };

function deferredHydration() {
  let resolve!: (response: HydrationResponse) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<HydrationResponse>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const hydrationResources = ['users', 'permissions', 'groups'] as const;
type HydrationResource = (typeof hydrationResources)[number];

const hydrationResponse = (
  resource: HydrationResource,
  id = 5,
): HydrationResponse => ({
  json: {
    count: 1,
    result:
      resource === 'users'
        ? [{ id, username: `user${id}`, first_name: `Member ${id}` }]
        : resource === 'permissions'
          ? [
              {
                id,
                permission_name: 'can_read',
                view_menu_name: `Resource ${id}`,
              },
            ]
          : [{ id, name: `Group ${id}` }],
  },
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('RoleListEditModal', () => {
  beforeEach(() => {
    (SupersetClient.get as jest.Mock).mockResolvedValue({
      json: { count: 0, result: [] },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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

  test('enables save button after hydration when role name is entered', async () => {
    render(<RoleListEditModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Updated Role' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
    );
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
    await screen.findByText('John Doe');
    await screen.findByText('Jane Smith');

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

      // updateRoleUsers is called with the hydrated user IDs
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

  test('shows decoded dots for an assigned permission and submits its ID', async () => {
    jest
      .mocked(formatPermissionLabel)
      .mockImplementation(jest.requireActual('./utils').formatPermissionLabel);
    (SupersetClient.get as jest.Mock).mockImplementation(({ endpoint }) => {
      if (endpoint === '/api/v1/security/roles/1/permissions/') {
        return Promise.resolve({
          json: {
            result: [
              {
                id: 42,
                permission_name: 'catalog_access',
                view_menu_name: '[database].[demo%2Emetrics]',
              },
            ],
          },
        });
      }
      return Promise.resolve({ json: { count: 0, result: [] } });
    });

    render(
      <RoleListEditModal
        {...mockProps}
        role={{ ...mockRole, permission_ids: [42], group_ids: [] }}
      />,
    );

    expect(
      await screen.findByText('catalog access [database].[demo.metrics]'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Updated Role' },
    });
    fireEvent.click(screen.getByTestId('form-modal-save-button'));

    await waitFor(() =>
      expect(mockUpdateRolePermissions).toHaveBeenCalledWith(1, [42]),
    );
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
      order_column: 'id',
      order_direction: 'asc',
      filters: [
        {
          col: 'roles',
          opr: 'rel_m_m',
          value: mockRole.id,
        },
      ],
    });
  });

  test('keeps an off-page role member named and searchable by email in the Users picker', async () => {
    // The member is hydrated from the role's users, not from the picker's
    // first page, so AsyncSelect rebuilds its option from the form value. That
    // value must be a full user option: the React label gives the list no
    // accessible name, and the email search relies on its filter props.
    const mockGet = SupersetClient.get as jest.Mock;
    mockGet.mockImplementation(({ endpoint }) => {
      if (endpoint?.includes('/api/v1/security/users/')) {
        return Promise.resolve({
          json: endpoint.includes('rel_m_m')
            ? {
                count: 1,
                result: [
                  {
                    id: 42,
                    username: 'amy',
                    first_name: 'Amy',
                    last_name: 'Adams',
                    email: 'aadams@example.com',
                  },
                ],
              }
            : {
                count: 50,
                result: [{ id: 1, username: 'zoe', first_name: 'Zoe' }],
              },
        });
      }
      return Promise.resolve({ json: { count: 0, result: [] } });
    });

    render(<RoleListEditModal {...mockProps} />);
    await waitFor(() => expect(screen.getByText('Amy Adams')).toBeVisible());
    const combobox = screen.getByRole('combobox', { name: /users/i });
    await waitFor(() => userEvent.click(combobox));

    expect(
      await screen.findByRole('option', { name: 'Amy Adams' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: '42' }),
    ).not.toBeInTheDocument();

    await userEvent.type(combobox, 'aadams@', { delay: 10 });
    const dropdown = within(
      document.querySelector('.ant-select-dropdown-list') as HTMLElement,
    );
    await waitFor(() =>
      expect(dropdown.queryByText('Zoe')).not.toBeInTheDocument(),
    );
    expect(dropdown.getByText('Amy Adams')).toBeInTheDocument();
  });

  test('preserves missing IDs as numeric fallbacks on partial hydration', async () => {
    const mockGet = SupersetClient.get as jest.Mock;
    mockGet.mockImplementation(({ endpoint }) => {
      if (
        endpoint?.includes(`/api/v1/security/roles/${mockRole.id}/permissions/`)
      ) {
        // Only return permission id=10, not id=20
        return Promise.resolve({
          json: {
            result: [
              {
                id: 10,
                permission_name: 'can_read',
                view_menu_name: 'Dashboard',
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
      if (
        endpoint?.includes(`/api/v1/security/roles/${mockRole.id}/permissions/`)
      ) {
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
    mockGet.mockImplementation(() =>
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

  test('does not leak state when closing and opening another role', async () => {
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
      if (
        endpoint?.includes(`/api/v1/security/roles/${roleA.id}/permissions/`)
      ) {
        return Promise.resolve({
          json: {
            result: roleA.permission_ids.map(pid => ({
              id: pid,
              permission_name: `perm_${pid}`,
              view_menu_name: `view_${pid}`,
            })),
          },
        });
      }
      if (
        endpoint?.includes(`/api/v1/security/roles/${roleB.id}/permissions/`)
      ) {
        return Promise.resolve({
          json: {
            result: roleB.permission_ids.map(pid => ({
              id: pid,
              permission_name: `perm_${pid}`,
              view_menu_name: `view_${pid}`,
            })),
          },
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
        c.endpoint.includes(`/api/v1/security/roles/${roleA.id}/permissions/`),
      );
      expect(permCall).toBeTruthy();
    });

    mockGet.mockClear();
    mockToasts.addDangerToast.mockClear();

    // Close the editor before opening Role B, as RolesList does.
    rerender(<RoleListEditModal {...mockProps} show={false} />);
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
        c.endpoint.includes(`/api/v1/security/roles/${roleB.id}/permissions/`),
      );
      expect(permCalls.length).toBeGreaterThan(0);
    });

    unmount();
    mockGet.mockReset();
  });

  test('fetches permissions via role endpoint and groups by id for hydration', async () => {
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

    // Permissions should be fetched via the role's permissions endpoint (no ID list in URL)
    const permissionCall = mockGet.mock.calls.find(([call]) =>
      call.endpoint.includes(
        `/api/v1/security/roles/${mockRole.id}/permissions/`,
      ),
    )?.[0];
    const groupsCall = mockGet.mock.calls.find(([call]) =>
      call.endpoint.includes('/api/v1/security/groups/'),
    )?.[0];

    expect(permissionCall).toBeTruthy();
    expect(groupsCall).toBeTruthy();
    if (!permissionCall || !groupsCall) {
      throw new Error('Expected hydration calls to be defined');
    }

    // Permission endpoint has no query params (role ID is in the path)
    expect(permissionCall.endpoint).toBe(
      `/api/v1/security/roles/${mockRole.id}/permissions/`,
    );

    // Groups still use the id-in filter
    const groupsQuery = groupsCall.endpoint.match(/\?q=(.+)/);
    expect(groupsQuery).toBeTruthy();
    if (!groupsQuery) {
      throw new Error('Expected groups query params to be present');
    }
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
  test.each(['users', 'permissions', 'groups'])(
    'blocks saving and editing %s until hydration finishes',
    async resource => {
      let resolve!: (value: object) => void;
      const pending = new Promise<object>(done => {
        resolve = done;
      });
      (SupersetClient.get as jest.Mock).mockImplementation(({ endpoint }) =>
        endpoint.includes(`/${resource}/`)
          ? pending
          : Promise.resolve({ json: { count: 0, result: [] } }),
      );
      render(<RoleListEditModal {...mockProps} />);
      fireEvent.change(screen.getByTestId('role-name-input'), {
        target: { value: 'Renamed' },
      });
      expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
      expect(
        screen.getByRole('combobox', { name: new RegExp(resource, 'i') }),
      ).toBeDisabled();
      fireEvent.submit(screen.getByTestId('role-name-input').closest('form')!);
      await act(async () => {});
      expect(mockUpdateRoleUsers).not.toHaveBeenCalled();
      await act(async () => resolve({ json: { count: 0, result: [] } }));
      await waitFor(() =>
        expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
      );
      fireEvent.click(screen.getByTestId('form-modal-save-button'));
      await waitFor(() =>
        expect(mockUpdateRoleUsers).toHaveBeenCalledWith(1, []),
      );
    },
  );

  test('failed user hydration keeps saving blocked', async () => {
    (SupersetClient.get as jest.Mock).mockImplementation(({ endpoint }) =>
      endpoint.includes('/users/')
        ? Promise.reject(new Error('network error'))
        : Promise.resolve({ json: { count: 0, result: [] } }),
    );
    render(<RoleListEditModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Renamed' },
    });
    await waitFor(() =>
      expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
        'There was an error loading users.',
      ),
    );
    expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
    fireEvent.submit(screen.getByTestId('role-name-input').closest('form')!);
    await act(async () => {});
    expect(mockUpdateRoleUsers).not.toHaveBeenCalled();
  });

  test('late responses from a closed role cannot overwrite the reopened editor', async () => {
    let resolve!: (value: object) => void;
    const pending = new Promise<object>(done => {
      resolve = done;
    });
    (SupersetClient.get as jest.Mock).mockReturnValue(pending);
    const { rerender } = render(<RoleListEditModal {...mockProps} />);
    (SupersetClient.get as jest.Mock).mockResolvedValue({
      json: { count: 0, result: [] },
    });
    rerender(<RoleListEditModal {...mockProps} show={false} />);
    rerender(
      <RoleListEditModal
        {...mockProps}
        role={{
          id: 2,
          name: 'Role B',
          permission_ids: [],
          user_ids: [],
          group_ids: [],
        }}
      />,
    );
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Renamed B' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
    );
    await act(async () =>
      resolve({
        json: {
          count: 1,
          result: [
            {
              id: 5,
              username: 'amy',
              first_name: 'Amy',
              last_name: 'Adams',
              name: 'Old group',
            },
          ],
        },
      }),
    );
    expect(screen.queryByText('Amy Adams')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('form-modal-save-button'));
    await waitFor(() =>
      expect(mockUpdateRoleUsers).toHaveBeenCalledWith(2, []),
    );
    expect(mockUpdateRolePermissions).toHaveBeenCalledWith(2, []);
    expect(mockUpdateRoleGroups).toHaveBeenCalledWith(2, []);
  });

  test('waits for all updates to settle before permitting a retry', async () => {
    let resolve!: () => void;
    const pending = new Promise<Awaited<ReturnType<typeof updateRoleUsers>>>(
      done => {
        resolve = () => done({} as Awaited<ReturnType<typeof updateRoleUsers>>);
      },
    );
    mockUpdateRoleUsers.mockReturnValueOnce(pending);
    mockUpdateRoleName.mockRejectedValueOnce(new Error('save failed'));
    render(<RoleListEditModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Renamed' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
    );
    fireEvent.click(screen.getByTestId('form-modal-save-button'));
    await waitFor(() => expect(mockUpdateRoleUsers).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
    expect(mockProps.onSave).not.toHaveBeenCalled();
    await act(async () => resolve());
    await waitFor(() =>
      expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
    );
    expect(mockProps.onSave).not.toHaveBeenCalled();
  });
  test('closing and reopening starts fresh hydration and ignores old errors', async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise<object>((_, fail) => {
      reject = fail;
    });
    (SupersetClient.get as jest.Mock).mockReturnValue(pending);
    const { rerender } = render(<RoleListEditModal {...mockProps} />);
    rerender(<RoleListEditModal {...mockProps} show={false} />);
    (SupersetClient.get as jest.Mock).mockResolvedValue({
      json: { count: 0, result: [] },
    });
    rerender(<RoleListEditModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Reopened' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
    );
    mockToasts.addDangerToast.mockClear();
    await act(async () => reject(new Error('old request failed')));
    expect(mockToasts.addDangerToast).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('form-modal-save-button'));
    await waitFor(() =>
      expect(mockUpdateRoleUsers).toHaveBeenCalledWith(1, []),
    );
  });

  test('a save finishing after closing still reports and refreshes the list', async () => {
    let resolve!: () => void;
    const pending = new Promise<Awaited<ReturnType<typeof updateRoleUsers>>>(
      done => {
        resolve = () => done({} as Awaited<ReturnType<typeof updateRoleUsers>>);
      },
    );
    mockUpdateRoleUsers.mockReturnValueOnce(pending);
    const { rerender } = render(<RoleListEditModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Renamed' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
    );
    fireEvent.click(screen.getByTestId('form-modal-save-button'));
    await waitFor(() => expect(mockUpdateRoleUsers).toHaveBeenCalledTimes(1));
    rerender(<RoleListEditModal {...mockProps} show={false} />);
    rerender(<RoleListEditModal {...mockProps} />);
    await act(async () => resolve());
    expect(mockProps.onSave).toHaveBeenCalledTimes(1);
    expect(mockToasts.addSuccessToast).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('role-name-input')).toHaveValue('Admin');
  });
  test('waits for every assigned-user page before enabling save', async () => {
    let resolve!: (value: object) => void;
    const pending = new Promise<object>(done => {
      resolve = done;
    });
    const user = (id: number) => ({
      id,
      username: `user${id}`,
      first_name: `User ${id}`,
    });
    (SupersetClient.get as jest.Mock).mockImplementation(({ endpoint }) => {
      if (endpoint.includes('/users/')) {
        const query = rison.decode(endpoint.match(/\?q=(.+)/)[1]) as {
          page: number;
        };
        return query.page === 0
          ? Promise.resolve({
              json: {
                count: 101,
                result: Array.from({ length: 100 }, (_, index) =>
                  user(index + 1),
                ),
              },
            })
          : pending;
      }
      return Promise.resolve({ json: { count: 0, result: [] } });
    });
    render(<RoleListEditModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Renamed' },
    });
    await waitFor(() =>
      expect(SupersetClient.get).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: expect.stringContaining('page:1'),
        }),
      ),
    );
    expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
    await act(async () =>
      resolve({ json: { count: 101, result: [user(101)] } }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
    );
    fireEvent.click(screen.getByTestId('form-modal-save-button'));
    await waitFor(() =>
      expect(mockUpdateRoleUsers).toHaveBeenCalledWith(
        1,
        Array.from({ length: 101 }, (_, index) => index + 1),
      ),
    );
  });
  // AlertReportModal's concurrent-filter tests hold each request independently:
  // one completion must not release another field or the overall Save gate.
  test.each(
    hydrationResources.flatMap(first =>
      hydrationResources
        .filter(resource => resource !== first)
        .flatMap(second =>
          ['success', 'failure'].map(outcome => ({
            first,
            second,
            last: hydrationResources.find(
              resource => resource !== first && resource !== second,
            )!,
            outcome,
          })),
        ),
    ),
  )(
    'independent hydration: $first ($outcome), then $second, then $last',
    async ({ first, second, last, outcome }) => {
      const requests = {
        users: deferredHydration(),
        permissions: deferredHydration(),
        groups: deferredHydration(),
      };
      (SupersetClient.get as jest.Mock).mockImplementation(({ endpoint }) => {
        const resource = hydrationResources.find(resource =>
          endpoint.includes(`/${resource}/`),
        )!;
        return requests[resource].promise;
      });
      render(<RoleListEditModal {...mockProps} />);
      fireEvent.change(screen.getByTestId('role-name-input'), {
        target: { value: 'Renamed' },
      });
      await act(async () => {
        if (outcome === 'success')
          requests[first].resolve(hydrationResponse(first));
        else requests[first].reject(new Error('First hydration failed'));
      });
      for (const resource of [second, last]) {
        expect(
          screen.getByRole('combobox', {
            name: new RegExp(resource, 'i'),
          }),
        ).toBeDisabled();
      }
      expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
      await act(async () =>
        requests[second].resolve(hydrationResponse(second)),
      );
      expect(
        screen.getByRole('combobox', { name: new RegExp(last, 'i') }),
      ).toBeDisabled();
      expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
      await act(async () => requests[last].resolve(hydrationResponse(last)));
      if (first === 'users' && outcome === 'failure') {
        expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
        fireEvent.submit(
          screen.getByTestId('role-name-input').closest('form')!,
        );
        await act(async () => {});
        expect(mockUpdateRoleUsers).not.toHaveBeenCalled();
      } else {
        await waitFor(() =>
          expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
        );
        fireEvent.click(screen.getByTestId('form-modal-save-button'));
        await waitFor(() =>
          expect(mockUpdateRoleUsers).toHaveBeenCalledWith(1, [5]),
        );
        expect(mockUpdateRolePermissions).toHaveBeenCalledWith(
          1,
          first === 'permissions' && outcome === 'failure'
            ? [10, 20]
            : [5, 10, 20],
        );
        expect(mockUpdateRoleGroups).toHaveBeenCalledWith(
          1,
          first === 'groups' && outcome === 'failure' ? [1, 2] : [5, 1, 2],
        );
      }
    },
  );

  // Like overlapping filter requests, exercise both completion orders and errors.
  // Reopening A after visiting B also checks separate lifetimes for the same ID.
  test.each(
    [false, true].flatMap(returnToSameRole =>
      ['older', 'latest'].flatMap(first =>
        ['success', 'failure'].map(outcome => ({
          returnToSameRole,
          first,
          outcome,
        })),
      ),
    ),
  )(
    'superseded hydration: same role=$returnToSameRole, $first first, old $outcome',
    async ({ returnToSameRole, first, outcome }) => {
      const oldRequests = {
        users: deferredHydration(),
        permissions: deferredHydration(),
        groups: deferredHydration(),
      };
      const latestRequests = {
        users: deferredHydration(),
        permissions: deferredHydration(),
        groups: deferredHydration(),
      };
      const mockGet = SupersetClient.get as jest.Mock;
      const loadFrom = (requests: typeof oldRequests) =>
        mockGet.mockImplementation(
          ({ endpoint }) =>
            requests[
              hydrationResources.find(resource =>
                endpoint.includes(`/${resource}/`),
              )!
            ].promise,
        );
      loadFrom(oldRequests);
      const { rerender } = render(<RoleListEditModal {...mockProps} />);
      mockGet.mockResolvedValue({ json: { count: 0, result: [] } });
      const roleB = {
        id: 2,
        name: 'Role B',
        permission_ids: [],
        user_ids: [],
        group_ids: [],
      };
      rerender(<RoleListEditModal {...mockProps} show={false} />);
      if (returnToSameRole) {
        rerender(<RoleListEditModal {...mockProps} role={roleB} />);
        rerender(<RoleListEditModal {...mockProps} show={false} />);
      }
      loadFrom(latestRequests);
      const currentRole = returnToSameRole
        ? mockRole
        : { ...mockRole, id: 2, name: 'Role B' };
      rerender(<RoleListEditModal {...mockProps} role={currentRole} />);
      fireEvent.change(screen.getByTestId('role-name-input'), {
        target: { value: 'Current edit' },
      });
      mockToasts.addDangerToast.mockClear();
      const finishOld = async () => {
        await act(async () => {
          for (const resource of hydrationResources) {
            if (outcome === 'success')
              oldRequests[resource].resolve(hydrationResponse(resource, 99));
            else
              oldRequests[resource].reject(
                new Error('Superseded request failed'),
              );
          }
        });
        expect(mockToasts.addDangerToast).not.toHaveBeenCalled();
        expect(screen.queryByText('Member 99')).not.toBeInTheDocument();
        expect(screen.queryByText('Group 99')).not.toBeInTheDocument();
      };
      if (first === 'older') {
        await finishOld();
        expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
        for (const resource of hydrationResources) {
          expect(
            screen.getByRole('combobox', {
              name: new RegExp(resource, 'i'),
            }),
          ).toBeDisabled();
        }
      }
      await act(async () => {
        for (const resource of hydrationResources)
          latestRequests[resource].resolve(
            hydrationResponse(
              resource,
              resource === 'users' ? 7 : resource === 'groups' ? 2 : 20,
            ),
          );
      });
      await waitFor(() =>
        expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
      );
      if (first === 'latest') {
        mockToasts.addDangerToast.mockClear();
        await finishOld();
      }
      expect(screen.getByTestId('role-name-input')).toHaveValue('Current edit');
      fireEvent.click(screen.getByTestId('form-modal-save-button'));
      await waitFor(() =>
        expect(mockUpdateRoleUsers).toHaveBeenCalledWith(currentRole.id, [7]),
      );
      expect(mockUpdateRolePermissions).toHaveBeenCalledWith(
        currentRole.id,
        [20, 10],
      );
      expect(mockUpdateRoleGroups).toHaveBeenCalledWith(currentRole.id, [2, 1]);
    },
  );

  test('failure on a later users page never submits a partial assignment list and reopening retries', async () => {
    const lastPage = deferredHydration();
    const mockGet = SupersetClient.get as jest.Mock;
    mockGet.mockImplementation(({ endpoint }) => {
      if (endpoint.includes('/users/')) {
        const query = rison.decode(endpoint.match(/\?q=(.+)/)[1]) as {
          page: number;
        };
        return query.page === 0
          ? Promise.resolve({
              json: {
                count: 101,
                result: Array.from({ length: 100 }, (_, index) => ({
                  id: index + 1,
                  username: `user${index + 1}`,
                })),
              },
            })
          : lastPage.promise;
      }
      return Promise.resolve({ json: { count: 0, result: [] } });
    });
    const { rerender } = render(<RoleListEditModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Renamed' },
    });
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: expect.stringContaining('page:1'),
        }),
      ),
    );
    await act(async () => lastPage.reject(new Error('Last page unavailable')));
    expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
    fireEvent.submit(screen.getByTestId('role-name-input').closest('form')!);
    await act(async () => {});
    expect(mockUpdateRoleUsers).not.toHaveBeenCalled();
    rerender(<RoleListEditModal {...mockProps} show={false} />);
    mockGet.mockImplementation(({ endpoint }) =>
      Promise.resolve(
        endpoint.includes('/users/')
          ? hydrationResponse('users', 7)
          : { json: { count: 0, result: [] } },
      ),
    );
    rerender(<RoleListEditModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Recovered' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
    );
    fireEvent.click(screen.getByTestId('form-modal-save-button'));
    await waitFor(() =>
      expect(mockUpdateRoleUsers).toHaveBeenCalledWith(1, [7]),
    );
  });
  test('a save failing after closing still reports the failure', async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise<Awaited<ReturnType<typeof updateRoleUsers>>>(
      (_, fail) => {
        reject = fail;
      },
    );
    mockUpdateRoleUsers.mockReturnValueOnce(pending);
    const { rerender } = render(<RoleListEditModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'Renamed' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('form-modal-save-button')).toBeEnabled(),
    );
    fireEvent.click(screen.getByTestId('form-modal-save-button'));
    await waitFor(() => expect(mockUpdateRoleUsers).toHaveBeenCalledTimes(1));
    rerender(<RoleListEditModal {...mockProps} show={false} />);
    mockToasts.addDangerToast.mockClear();
    await act(async () => reject(new Error('Save failed after closing')));
    expect(mockToasts.addDangerToast).toHaveBeenCalledTimes(1);
    expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
      'There was an error updating the role. Please, try again.',
    );
    expect(mockProps.onSave).not.toHaveBeenCalled();
    expect(mockToasts.addSuccessToast).not.toHaveBeenCalled();
  });
});
