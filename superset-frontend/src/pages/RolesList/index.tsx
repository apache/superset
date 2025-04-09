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
import { css, t, SupersetClient, useTheme } from '@superset-ui/core';
import { useListViewResource } from 'src/views/CRUD/hooks';
import RoleListAddModal from 'src/features/roles/RoleListAddModal';
import RoleListEditModal from 'src/features/roles/RoleListEditModal';
import RoleListDuplicateModal from 'src/features/roles/RoleListDuplicateModal';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import ListView, {
  ListViewProps,
  Filters,
  FilterOperator,
} from 'src/components/ListView';
import DeleteModal from 'src/components/DeleteModal';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import {
  FormattedPermission,
  PermissionResource,
  UserObject,
} from 'src/features/roles/types';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import { Icons } from 'src/components/Icons';

const PAGE_SIZE = 25;

interface RolesListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
    roles: object;
  };
}

export type RoleObject = {
  id: number;
  name: string;
  permission_ids: number[];
  users?: Array<UserObject>;
  user_ids: number[];
};

enum ModalType {
  ADD = 'add',
  EDIT = 'edit',
  DUPLICATE = 'duplicate',
}

function RolesList({ addDangerToast, addSuccessToast, user }: RolesListProps) {
  const theme = useTheme();
  const {
    state: {
      loading,
      resourceCount: rolesCount,
      resourceCollection: roles,
      bulkSelectEnabled,
    },
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<RoleObject>(
    'security/roles/search',
    t('Role'),
    addDangerToast,
    false,
  );
  const [modalState, setModalState] = useState({
    edit: false,
    add: false,
    duplicate: false,
  });
  const openModal = (type: ModalType) =>
    setModalState(prev => ({ ...prev, [type]: true }));
  const closeModal = (type: ModalType) =>
    setModalState(prev => ({ ...prev, [type]: false }));

  const [currentRole, setCurrentRole] = useState<RoleObject | null>(null);
  const [roleCurrentlyDeleting, setRoleCurrentlyDeleting] =
    useState<RoleObject | null>(null);
  const [permissions, setPermissions] = useState<FormattedPermission[]>([]);
  const [users, setUsers] = useState<UserObject[]>([]);
  const [loadingState, setLoadingState] = useState({
    permissions: true,
    users: true,
  });

  const isAdmin = useMemo(() => isUserAdmin(user), [user]);

  const fetchPermissions = useCallback(async () => {
    try {
      const pageSize = 100;

      const fetchPage = async (pageIndex: number) => {
        const response = await SupersetClient.get({
          endpoint: `api/v1/security/permissions-resources/?q=(page_size:${pageSize},page:${pageIndex})`,
        });

        return {
          count: response.json.count,
          results: response.json.result.map(
            ({ permission, view_menu, id }: PermissionResource) => ({
              label: `${permission.name.replace(/_/g, ' ')} ${view_menu.name.replace(/_/g, ' ')}`,
              value: `${permission.name}__${view_menu.name}`,
              id,
            }),
          ),
        };
      };

      const initialResponse = await fetchPage(0);
      const totalPermissions = initialResponse.count;
      const firstPageResults = initialResponse.results;

      if (firstPageResults.length >= totalPermissions) {
        setPermissions(firstPageResults);
        return;
      }

      const totalPages = Math.ceil(totalPermissions / pageSize);

      const permissionRequests = Array.from(
        { length: totalPages - 1 },
        (_, i) => fetchPage(i + 1),
      );
      const remainingResults = await Promise.all(permissionRequests);

      setPermissions([
        ...firstPageResults,
        ...remainingResults.flatMap(res => res.results),
      ]);
    } catch (err) {
      addDangerToast(t('Error while fetching permissions'));
    } finally {
      setLoadingState(prev => ({ ...prev, permissions: false }));
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const pageSize = 100;

      const fetchPage = async (pageIndex: number) => {
        const response = await SupersetClient.get({
          endpoint: `api/v1/security/users/?q=(page_size:${pageSize},page:${pageIndex})`,
        });
        return response.json;
      };

      const initialResponse = await fetchPage(0);
      const totalUsers = initialResponse.count;
      const firstPageResults = initialResponse.result;

      if (pageSize >= totalUsers) {
        setUsers(firstPageResults);
        return;
      }

      const totalPages = Math.ceil(totalUsers / pageSize);

      const userRequests = Array.from({ length: totalPages - 1 }, (_, i) =>
        fetchPage(i + 1),
      );
      const remainingResults = await Promise.all(userRequests);

      setUsers([
        ...firstPageResults,
        ...remainingResults.flatMap(res => res.result),
      ]);
    } catch (err) {
      addDangerToast(t('Error while fetching users'));
    } finally {
      setLoadingState(prev => ({ ...prev, users: false }));
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleDelete = async ({ id, name }: RoleObject) => {
    try {
      await SupersetClient.delete({
        endpoint: `/api/v1/security/roles/${id}`,
      });

      refreshData();
      setRoleCurrentlyDeleting(null);
      addSuccessToast(t('Deleted role: %s', name));
    } catch (error) {
      addDangerToast(t('There was an issue deleting %s', name));
    }
  };

  const handleBulkRolesDelete = async (rolesToDelete: RoleObject[]) => {
    const deletedRoleNames: string[] = [];

    await Promise.all(
      rolesToDelete.map(async role => {
        try {
          await SupersetClient.delete({
            endpoint: `api/v1/security/roles/${role.id}`,
          });

          deletedRoleNames.push(role.name);
        } catch (error) {
          addDangerToast(t('Error deleting %s', role.name));
        }
      }),
    );

    if (deletedRoleNames.length > 0) {
      addSuccessToast(t('Deleted roles: %s', deletedRoleNames.join(', ')));
    }

    refreshData();
  };

  const initialSort = [{ id: 'name', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        Header: t('Name'),
        Cell: ({
          row: {
            original: { name },
          },
        }: any) => <span>{name}</span>,
      },
      {
        accessor: 'user_ids',
        Header: t('Users'),
        hidden: true,
        Cell: ({ row: { original } }: any) => original.user_ids.join(', '),
      },
      {
        accessor: 'permission_ids',
        Header: t('Permissions'),
        hidden: true,
        Cell: ({ row: { original } }: any) =>
          original.permission_ids.join(', '),
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => {
            setCurrentRole(original);
            openModal(ModalType.EDIT);
          };
          const handleDelete = () => setRoleCurrentlyDeleting(original);
          const handleDuplicate = () => {
            setCurrentRole(original);
            openModal(ModalType.DUPLICATE);
          };

          const actions = isAdmin
            ? [
                {
                  label: 'role-list-edit-action',
                  tooltip: t('Edit role'),
                  placement: 'bottom',
                  icon: 'EditOutlined',
                  onClick: handleEdit,
                },
                {
                  label: 'role-list-duplicate-action',
                  tooltip: t('Duplicate role'),
                  placement: 'bottom',
                  icon: 'CopyOutlined',
                  onClick: handleDuplicate,
                },
                {
                  label: 'role-list-delete-action',
                  tooltip: t('Delete role'),
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
            {t('Role')}
          </>
        ),
        buttonStyle: 'primary',
        onClick: () => {
          openModal(ModalType.ADD);
        },
        loading: loadingState.permissions,
        'data-test': 'add-role-button',
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
        Header: t('Name'),
        key: 'name',
        id: 'name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Users'),
        key: 'user_ids',
        id: 'user_ids',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        selects: users?.map(user => ({
          label: user.username,
          value: user.id,
        })),
        loading: loadingState.users,
      },
      {
        Header: t('Permissions'),
        key: 'permission_ids',
        id: 'permission_ids',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        selects: permissions?.map(permission => ({
          label: permission.label,
          value: permission.id,
        })),
        loading: loadingState.permissions,
      },
    ],
    [permissions, users, loadingState.users, loadingState.permissions],
  );

  const emptyState = {
    title: t('No roles yet'),
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
          {t('Role')}
        </>
      ),
    }),
  };

  return (
    <>
      <SubMenu name={t('List Roles')} buttons={subMenuButtons} />
      <RoleListAddModal
        onHide={() => closeModal(ModalType.ADD)}
        show={modalState.add}
        onSave={() => {
          refreshData();
          closeModal(ModalType.ADD);
        }}
        permissions={permissions}
      />
      {modalState.edit && currentRole && (
        <RoleListEditModal
          role={currentRole}
          show={modalState.edit}
          onHide={() => closeModal(ModalType.EDIT)}
          onSave={() => {
            refreshData();
            closeModal(ModalType.EDIT);
            fetchUsers();
          }}
          permissions={permissions}
          users={users}
        />
      )}
      {modalState.duplicate && currentRole && (
        <RoleListDuplicateModal
          role={currentRole}
          show={modalState.duplicate}
          onHide={() => closeModal(ModalType.DUPLICATE)}
          onSave={() => {
            refreshData();
            closeModal(ModalType.DUPLICATE);
          }}
        />
      )}
      {roleCurrentlyDeleting && (
        <DeleteModal
          description={t('This action will permanently delete the role.')}
          onConfirm={() => {
            if (roleCurrentlyDeleting) {
              handleRoleDelete(roleCurrentlyDeleting);
            }
          }}
          onHide={() => setRoleCurrentlyDeleting(null)}
          open
          title={t('Delete Role?')}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to delete the selected roles?')}
        onConfirm={handleBulkRolesDelete}
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
            <ListView<RoleObject>
              className="role-list-view"
              columns={columns}
              count={rolesCount}
              data={roles}
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

export default withToasts(RolesList);
