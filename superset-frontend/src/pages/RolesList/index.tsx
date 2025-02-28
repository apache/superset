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
import { t, SupersetClient } from '@superset-ui/core';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler } from 'src/views/CRUD/utils';
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
import { ModifiedInfo } from 'src/components/AuditInfo';
import {
  FormattedPermission,
  PermissionResource,
  UserObject,
} from 'src/features/roles/types';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';

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
  created_on?: string;
  changed_on?: string;
  user_ids: number[];
};

function RolesList({ addDangerToast, addSuccessToast, user }: RolesListProps) {
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
  );
  const [roleModalOpen, setRoleModalOpen] = useState<boolean>(false);
  const [currentRole, setCurrentRole] = useState<RoleObject | null>(null);
  const [roleModalAddOpen, setRoleModalAddOpen] = useState<boolean>(false);
  const [roleDuplicateModalOpen, setRoleDuplicateModalOpen] =
    useState<boolean>(false);
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
      const permissionsResponse = await SupersetClient.get({
        endpoint: 'api/v1/security/permissions-resources/?q={"page_size":-1}',
      });

      const formattedPermissions = permissionsResponse.json.result.map(
        ({ permission, view_menu, id }: PermissionResource) => ({
          label: `${permission.name.replace(/_/g, ' ')} ${view_menu.name.replace(/_/g, ' ')}`,
          value: `${permission.name}__${view_menu.name}`,
          id,
        }),
      );
      setPermissions(formattedPermissions);
    } catch (err) {
      addDangerToast(t('Error while fetching permissions'));
    } finally {
      setLoadingState(prev => ({ ...prev, permissions: false }));
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const usersResponse = await SupersetClient.get({
        endpoint: 'api/v1/security/users/?q={"page_size":-1}',
      });
      setUsers(usersResponse.json.result);
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

  const handleRoleDelete = ({ id, name }: RoleObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/security/roles/${id}`,
    }).then(
      () => {
        refreshData();
        setRoleCurrentlyDeleting(null);
        addSuccessToast(t('Deleted: %s', name));
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting %s:', name)),
      ),
    );
  };

  const handleBulkRolesDelete = (rolesToDelete: RoleObject[]) => {
    const deletedRoleNames: string[] = [];

    Promise.all(
      rolesToDelete.map(role =>
        SupersetClient.delete({ endpoint: `api/v1/security/roles/${role.id}` })
          .then(() => {
            deletedRoleNames.push(role.name);
          })
          .catch(err => {
            addDangerToast(t('Error deleting %s: %s', role.name, err.message));
          }),
      ),
    )
      .then(() => {
        if (deletedRoleNames.length > 0) {
          addSuccessToast(t('Deleted roles: %s', deletedRoleNames.join(', ')));
        }
      })
      .finally(() => {
        refreshData();
      });
  };

  function handleRoleEdit(role: RoleObject | null) {
    setCurrentRole(role);
    setRoleModalOpen(true);
  }

  function handleRoleDuplicate(role: RoleObject | null) {
    setCurrentRole(role);
    setRoleDuplicateModalOpen(true);
  }

  function handleRoleAdd() {
    setRoleModalAddOpen(true);
  }

  function handleRoleModalAddSave() {
    refreshData();
    setRoleModalAddOpen(false);
  }

  function handleRoleModalEditSave() {
    refreshData();
    setRoleModalOpen(false);
    fetchUsers();
  }

  function handleRoleModalDuplicateSave() {
    refreshData();
    setRoleDuplicateModalOpen(false);
  }

  const initialSort = [{ id: 'name', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        Header: t('Name'),
        Cell: ({
          row: {
            original: { id, name },
          },
        }: any) => <span>{name}</span>,
      },
      {
        Cell: ({
          row: {
            original: {
              changed_on_delta_humanized: changedOn,
              changed_by: changedBy,
            },
          },
        }: any) => <ModifiedInfo date={changedOn} user={changedBy} />,
        Header: t('Last modified'),
        accessor: 'changed_on',
        size: 'xl',
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
          const handleEdit = () => handleRoleEdit(original);
          const handleDelete = () => setRoleCurrentlyDeleting(original);
          const handleDuplicate = () => handleRoleDuplicate(original);

          const actions = isAdmin
            ? [
                {
                  label: 'edit-action',
                  tooltip: t('Edit role'),
                  placement: 'bottom',
                  icon: 'Edit',
                  onClick: handleEdit,
                },
                {
                  label: 'duplicate-action',
                  tooltip: t('Duplicate role'),
                  placement: 'bottom',
                  icon: 'Copy',
                  onClick: handleDuplicate,
                },
                {
                  label: 'delete-action',
                  tooltip: t('Delete role'),
                  placement: 'bottom',
                  icon: 'Trash',
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
            <i className="fa fa-plus" /> {t('Role')}
          </>
        ),
        buttonStyle: 'primary',
        onClick: handleRoleAdd,
        disabled: loadingState.permissions,
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
      },
    ],
    [permissions, users],
  );

  const emptyState = {
    title: t('No roles yet'),
    image: 'filter-results.svg',
    buttonAction: () => handleRoleAdd(),
    buttonText: (
      <>
        <i className="fa fa-plus" /> {t('Role')}
      </>
    ),
  };

  return (
    <>
      <SubMenu name={t('List Roles')} buttons={subMenuButtons} />
      <RoleListAddModal
        addDangerToast={addDangerToast}
        onHide={() => setRoleModalAddOpen(false)}
        show={roleModalAddOpen}
        onSave={handleRoleModalAddSave}
        permissions={permissions}
        addSuccessToast={addSuccessToast}
      />
      {roleModalOpen && currentRole && (
        <RoleListEditModal
          role={currentRole}
          show={roleModalOpen}
          onHide={() => setRoleModalOpen(false)}
          onSave={handleRoleModalEditSave}
          addDangerToast={addDangerToast}
          addSuccessToast={addSuccessToast}
          permissions={permissions}
          users={users}
        />
      )}
      {roleDuplicateModalOpen && currentRole && (
        <RoleListDuplicateModal
          role={currentRole}
          show={roleDuplicateModalOpen}
          onHide={() => setRoleDuplicateModalOpen(false)}
          onSave={handleRoleModalDuplicateSave}
          addDangerToast={addDangerToast}
          addSuccessToast={addSuccessToast}
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
