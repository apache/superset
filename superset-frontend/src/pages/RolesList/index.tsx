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
import RoleListAddModal from 'src/features/roles/RoleListAddModal';
import RoleListEditModal from 'src/features/roles/RoleListEditModal';
import RoleListDuplicateModal from 'src/features/roles/RoleListDuplicateModal';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { ConfirmStatusChange, DeleteModal } from '@superset-ui/core/components';
import {
  ListView,
  ListViewFilterOperator as FilterOperator,
  ListViewActionsBar,
  type ListViewProps,
  type ListViewActionProps,
  type ListViewFilters,
} from 'src/components';
import { FormattedPermission, UserObject } from 'src/features/roles/types';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import { Icons } from '@superset-ui/core/components/Icons';
import { fetchPaginatedData } from 'src/utils/fetchOptions';
import { fetchUserOptions } from 'src/features/groups/utils';
import { WIDER_DROPDOWN_WIDTH } from 'src/components/ListView/utils';
import { GroupObject } from '../GroupsList';

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
  group_ids: number[];
};

enum ModalType {
  ADD = 'add',
  EDIT = 'edit',
  DUPLICATE = 'duplicate',
}

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
  const [groups, setGroups] = useState<GroupObject[]>([]);
  const [loadingState, setLoadingState] = useState({
    permissions: true,
    groups: true,
  });

  const isAdmin = useMemo(() => isUserAdmin(user), [user]);

  const fetchPermissions = useCallback(() => {
    fetchPaginatedData({
      endpoint: '/api/v1/security/permissions-resources/',
      setData: setPermissions,
      setLoadingState,
      loadingKey: 'permissions',
      addDangerToast,
      errorMessage: 'Error while fetching permissions',
      mapResult: ({ permission, view_menu, id }) => ({
        label: `${permission.name.replace(/_/g, ' ')} ${view_menu.name.replace(/_/g, ' ')}`,
        value: `${permission.name}__${view_menu.name}`,
        id,
      }),
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
    fetchPermissions();
  }, [fetchPermissions]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

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
        id: 'name',
        Header: t('Name'),
        size: 'xxl',
        Cell: ({
          row: {
            original: { name },
          },
        }: any) => <span>{name}</span>,
      },
      {
        accessor: 'user_ids',
        id: 'user_ids',
        Header: t('Users'),
        hidden: true,
        Cell: ({ row: { original } }: any) => original.user_ids.join(', '),
      },
      {
        accessor: 'group_ids',
        id: 'group_ids',
        Header: t('Groups'),
        hidden: true,
        Cell: ({ row: { original } }: any) => original.groups_ids.join(', '),
      },
      {
        accessor: 'permission_ids',
        id: 'permission_ids',
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

          return (
            <ListViewActionsBar actions={actions as ListViewActionProps[]} />
          );
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
        name: t('Bulk select'),
        onClick: toggleBulkSelect,
        buttonStyle: 'secondary',
      },
      {
        icon: <Icons.PlusOutlined iconSize="m" />,
        name: t('Role'),
        buttonStyle: 'primary',
        onClick: () => {
          openModal(ModalType.ADD);
        },
        loading: loadingState.permissions,
        'data-test': 'add-role-button',
      },
    );
  }

  const filters: ListViewFilters = useMemo(
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
        fetchSelects: async (filterValue, page, pageSize) =>
          fetchUserOptions(filterValue, page, pageSize, addDangerToast),
        dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
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
        dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
      {
        Header: t('Groups'),
        key: 'group_ids',
        id: 'group_ids',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        selects: groups?.map(group => ({
          label: group.name,
          value: group.id,
        })),
        loading: loadingState.groups,
        dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
    ],
    [permissions, groups, loadingState.groups, loadingState.permissions],
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
          <Icons.PlusOutlined iconSize="m" />
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
          }}
          permissions={permissions}
          groups={groups}
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
