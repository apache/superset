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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { css, t, useTheme } from '@superset-ui/core';
import { useListViewResource } from 'src/views/CRUD/hooks';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import ListView, {
  ListViewProps,
  Filters,
  FilterOperator,
} from 'src/components/ListView';
import DeleteModal from 'src/components/DeleteModal';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import { Icons } from 'src/components/Icons';
import {
  UserListAddModal,
  UserListEditModal,
} from 'src/features/users/UserListModal';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { deleteUser } from 'src/features/users/utils';
import { fetchPaginatedData } from 'src/utils/fetchOptions';
import { Tooltip } from 'src/components/Tooltip';

const PAGE_SIZE = 25;

interface UsersListProps {
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
    roles: object;
  };
}

export type Role = {
  id: number;
  name: string;
};

export type Group = {
  id: number;
  name: string;
};

export type UserObject = {
  active: boolean;
  changed_by: string | null;
  changed_on: string;
  created_by: string | null;
  created_on: string;
  email: string;
  fail_login_count: number;
  first_name: string;
  id: number;
  last_login: string;
  last_name: string;
  login_count: number;
  roles: Role[];
  username: string;
  groups: Group[];
};

enum ModalType {
  ADD = 'add',
  EDIT = 'edit',
}

const isActiveOptions = [
  {
    label: 'Yes',
    value: true,
  },
  {
    label: 'No',
    value: false,
  },
];

function UsersList({ user }: UsersListProps) {
  const theme = useTheme();
  const { addDangerToast, addSuccessToast } = useToasts();
  const {
    state: {
      loading,
      resourceCount: usersCount,
      resourceCollection: users,
      bulkSelectEnabled,
    },
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<UserObject>(
    'security/users',
    t('User'),
    addDangerToast,
  );
  const [modalState, setModalState] = useState({
    edit: false,
    add: false,
  });
  const openModal = (type: ModalType) =>
    setModalState(prev => ({ ...prev, [type]: true }));
  const closeModal = (type: ModalType) =>
    setModalState(prev => ({ ...prev, [type]: false }));

  const [currentUser, setCurrentUser] = useState<UserObject | null>(null);
  const [userCurrentlyDeleting, setUserCurrentlyDeleting] =
    useState<UserObject | null>(null);
  const [loadingState, setLoadingState] = useState({
    roles: true,
    groups: true,
  });
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const loginCountStats = useMemo(() => {
    if (!users || users.length === 0) return { min: 0, max: 0 };

    const loginCounts = users.map(user => user.login_count);
    return {
      min: Math.min(...loginCounts),
      max: Math.max(...loginCounts),
    };
  }, [users]);
  const failLoginCountStats = useMemo(() => {
    if (!users || users.length === 0) return { min: 0, max: 0 };

    const failLoginCounts = users.map(user => user.fail_login_count);
    return {
      min: Math.min(...failLoginCounts),
      max: Math.max(...failLoginCounts),
    };
  }, [users]);

  const isAdmin = useMemo(() => isUserAdmin(user), [user]);

  const fetchRoles = useCallback(() => {
    fetchPaginatedData({
      endpoint: '/api/v1/security/roles/',
      setData: setRoles,
      setLoadingState,
      loadingKey: 'roles',
      addDangerToast,
      errorMessage: t('Error while fetching roles'),
    });
  }, [addDangerToast]);

  const fetchGroups = useCallback(() => {
    fetchPaginatedData({
      endpoint: '/api/v1/security/groups/',
      setData: setGroups,
      setLoadingState,
      loadingKey: 'groups',
      addDangerToast,
      errorMessage: t('Error while fetching groups'),
    });
  }, [addDangerToast]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleUserDelete = async ({ id, username }: UserObject) => {
    try {
      await deleteUser(id);
      refreshData();
      setUserCurrentlyDeleting(null);
      addSuccessToast(t('Deleted user: %s', username));
    } catch (error) {
      addDangerToast(t('There was an issue deleting %s', username));
    }
  };

  const handleBulkUsersDelete = (usersToDelete: UserObject[]) => {
    const deletedUserNames: string[] = [];

    Promise.all(
      usersToDelete.map(user =>
        deleteUser(user.id)
          .then(() => {
            deletedUserNames.push(user.username);
          })
          .catch(err => {
            addDangerToast(t('Error deleting %s', user.username));
          }),
      ),
    )
      .then(() => {
        if (deletedUserNames.length > 0) {
          addSuccessToast(t('Deleted users: %s', deletedUserNames.join(', ')));
        }
      })
      .finally(() => {
        refreshData();
      });
  };

  const initialSort = [{ id: 'username', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'first_name',
        Header: t('First name'),
        id: 'first_name',
        Cell: ({
          row: {
            original: { first_name },
          },
        }: any) => <span>{first_name}</span>,
      },
      {
        accessor: 'last_name',
        Header: t('Last name'),
        id: 'last_name',
        Cell: ({
          row: {
            original: { last_name },
          },
        }: any) => <span>{last_name}</span>,
      },
      {
        accessor: 'username',
        Header: t('Username'),
        id: 'username',
        Cell: ({
          row: {
            original: { username },
          },
        }: any) => <span>{username}</span>,
      },
      {
        accessor: 'email',
        Header: t('Email'),
        id: 'email',
        Cell: ({
          row: {
            original: { email },
          },
        }: any) => <span>{email}</span>,
      },
      {
        accessor: 'active',
        Header: t('Is active?'),
        id: 'active',
        Cell: ({
          row: {
            original: { active },
          },
        }: any) => <span>{active ? 'Yes' : 'No'}</span>,
      },
      {
        accessor: 'roles',
        Header: t('Roles'),
        id: 'roles',
        Cell: ({
          row: {
            original: { roles },
          },
        }: any) => (
          <Tooltip
            title={
              roles?.map((role: Role) => role.name).join(', ') || t('No roles')
            }
          >
            <span>{roles?.map((role: Role) => role.name).join(', ')}</span>
          </Tooltip>
        ),
        disableSortBy: true,
      },
      {
        accessor: 'groups',
        Header: t('Groups'),
        id: 'groups',
        Cell: ({
          row: {
            original: { groups },
          },
        }: any) => (
          <Tooltip
            title={
              groups?.map((group: Group) => group.name).join(', ') ||
              t('No groups')
            }
          >
            <span>{groups?.map((group: Group) => group.name).join(', ')}</span>
          </Tooltip>
        ),
        disableSortBy: true,
      },
      {
        accessor: 'login_count',
        Header: t('Login count'),
        id: 'login_count',
        hidden: true,
        Cell: ({ row: { original } }: any) => original.login_count,
      },
      {
        accessor: 'fail_login_count',
        Header: t('Fail login count'),
        id: 'fail_login_count',
        hidden: true,
        Cell: ({ row: { original } }: any) => original.fail_login_count,
      },
      {
        accessor: 'created_on',
        Header: t('Created on'),
        id: 'created_on',
        hidden: true,
        Cell: ({
          row: {
            original: { created_on },
          },
        }: any) => created_on,
      },
      {
        accessor: 'changed_on',
        id: 'changed_on',
        Header: t('Changed on'),
        hidden: true,
        Cell: ({
          row: {
            original: { changed_on },
          },
        }: any) => changed_on,
      },
      {
        accessor: 'last_login',
        Header: t('Last login'),
        id: 'last_login',
        hidden: true,
        Cell: ({
          row: {
            original: { last_login },
          },
        }: any) => last_login,
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => {
            setCurrentUser(original);
            openModal(ModalType.EDIT);
          };
          const handleDelete = () => setUserCurrentlyDeleting(original);
          const actions = isAdmin
            ? [
                {
                  label: 'user-list-edit-action',
                  tooltip: t('Edit user'),
                  placement: 'bottom',
                  icon: 'EditOutlined',
                  onClick: handleEdit,
                },
                {
                  label: 'role-list-delete-action',
                  tooltip: t('Delete user'),
                  placement: 'bottom',
                  icon: 'DeleteOutlined',
                  onClick: handleDelete,
                },
              ]
            : [];

          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        hidden: !isAdmin,
        size: 'xl',
      },
    ],
    [isAdmin],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (isAdmin) {
    subMenuButtons.push(
      {
        name: (
          <>
            <Icons.PlusOutlined
              iconColor={theme.colors.primary.light5}
              iconSize="m"
              css={css`
                margin: auto ${theme.gridUnit * 2}px auto 0;
                vertical-align: text-top;
              `}
            />
            {t('User')}
          </>
        ),
        buttonStyle: 'primary',
        onClick: () => {
          openModal(ModalType.ADD);
        },
        loading: loadingState.roles || loadingState.groups,
        'data-test': 'add-user-button',
      },
      {
        name: t('Bulk select'),
        onClick: toggleBulkSelect,
        buttonStyle: 'secondary',
      },
    );
  }

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('First name'),
        key: 'first_name',
        id: 'first_name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Last name'),
        key: 'last_name',
        id: 'last_name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Username'),
        key: 'username',
        id: 'username',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Email'),
        key: 'email',
        id: 'email',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Is active?'),
        key: 'active',
        id: 'active',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('All'),
        selects: isActiveOptions?.map(option => ({
          label: option.label,
          value: option.value,
        })),
      },
      {
        Header: t('Roles'),
        key: 'roles',
        id: 'roles',
        input: 'select',
        operator: FilterOperator.RelationManyMany,
        unfilteredLabel: t('All'),
        selects: roles?.map(role => ({
          label: role.name,
          value: role.id,
        })),
        loading: loadingState.roles,
      },
      {
        Header: t('Groups'),
        key: 'groups',
        id: 'groups',
        input: 'select',
        operator: FilterOperator.RelationManyMany,
        unfilteredLabel: t('All'),
        selects: groups?.map(group => ({
          label: group.name,
          value: group.id,
        })),
        loading: loadingState.groups,
      },
      {
        Header: t('Created on'),
        key: 'created_on',
        id: 'created_on',
        input: 'datetime_range',
        operator: FilterOperator.Between,
        dateFilterValueType: 'iso',
      },
      {
        Header: t('Changed on'),
        key: 'changed_on',
        id: 'changed_on',
        input: 'datetime_range',
        operator: FilterOperator.Between,
        dateFilterValueType: 'iso',
      },
      {
        Header: t('Last login'),
        key: 'last_login',
        id: 'last_login',
        input: 'datetime_range',
        operator: FilterOperator.Between,
        dateFilterValueType: 'iso',
      },
      {
        Header: t('Login count'),
        key: 'login_count',
        id: 'login_count',
        input: 'numerical_range',
        operator: FilterOperator.Between,
        min: loginCountStats.min,
        max: loginCountStats.max,
      },
      {
        Header: t('Fail login count'),
        key: 'fail_login_count',
        id: 'fail_login_count',
        input: 'numerical_range',
        operator: FilterOperator.Between,
      },
    ],
    [
      loadingState.roles,
      roles,
      groups,
      loadingState.groups,
      loginCountStats,
      failLoginCountStats,
    ],
  );

  const emptyState = {
    title: t('No users yet'),
    image: 'filter-results.svg',
    ...(isAdmin && {
      buttonAction: () => {
        openModal(ModalType.ADD);
      },
      buttonText: (
        <>
          <Icons.PlusOutlined
            iconColor={theme.colors.primary.light5}
            iconSize="m"
            css={css`
              margin: auto ${theme.gridUnit * 2}px auto 0;
              vertical-align: text-top;
            `}
          />
          {t('User')}
        </>
      ),
    }),
  };

  return (
    <>
      <SubMenu name={t('List Users')} buttons={subMenuButtons} />
      <UserListAddModal
        onHide={() => closeModal(ModalType.ADD)}
        show={modalState.add}
        onSave={() => {
          refreshData();
          closeModal(ModalType.ADD);
        }}
        roles={roles}
        groups={groups}
      />
      {modalState.edit && currentUser && (
        <UserListEditModal
          user={currentUser}
          show={modalState.edit}
          onHide={() => closeModal(ModalType.EDIT)}
          onSave={() => {
            refreshData();
            closeModal(ModalType.EDIT);
          }}
          roles={roles}
          groups={groups}
        />
      )}

      {userCurrentlyDeleting && (
        <DeleteModal
          description={t('This action will permanently delete the user.')}
          onConfirm={() => {
            if (userCurrentlyDeleting) {
              handleUserDelete(userCurrentlyDeleting);
            }
          }}
          onHide={() => setUserCurrentlyDeleting(null)}
          open
          title={t('Delete User?')}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to delete the selected users?')}
        onConfirm={handleBulkUsersDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = isAdmin
            ? [
                {
                  key: 'delete',
                  name: t('Delete'),
                  onSelect: confirmDelete,
                  type: 'danger',
                },
              ]
            : [];

          return (
            <ListView<UserObject>
              className="user-list-view"
              columns={columns}
              count={usersCount}
              data={users}
              fetchData={fetchData}
              filters={filters}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              emptyState={emptyState}
              refreshData={refreshData}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default UsersList;
