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
import { t } from '@superset-ui/core';
import { useListViewResource } from 'src/views/CRUD/hooks';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { ActionsBar, ActionProps } from 'src/components/ListView/ActionsBar';
import { ListView, ListViewProps } from 'src/components/ListView';
import { type ListViewFilters, ListViewFilterOperator } from 'src/components';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import {
  GroupListAddModal,
  GroupListEditModal,
} from 'src/features/groups/GroupListModal';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { deleteGroup, fetchUserOptions } from 'src/features/groups/utils';
import { fetchPaginatedData } from 'src/utils/fetchOptions';
import {
  Tooltip,
  Icons,
  ConfirmStatusChange,
  DeleteModal,
} from '@superset-ui/core/components';
import { WIDER_DROPDOWN_WIDTH } from 'src/components/ListView/utils';

const PAGE_SIZE = 25;

interface GroupsListProps {
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

export type User = {
  id: number;
  username: string;
};

export type GroupObject = {
  id: number;
  name: string;
  label: string;
  description: string;
  roles: Role[];
  users: User[];
};

enum ModalType {
  ADD = 'add',
  EDIT = 'edit',
}

function GroupsList({ user }: GroupsListProps) {
  const { addDangerToast, addSuccessToast } = useToasts();
  const {
    state: {
      loading,
      resourceCount: groupsCount,
      resourceCollection: groups,
      bulkSelectEnabled,
    },
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<GroupObject>(
    'security/groups',
    t('Group'),
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

  const [currentGroup, setCurrentGroup] = useState<GroupObject | null>(null);
  const [groupCurrentlyDeleting, setGroupCurrentlyDeleting] =
    useState<GroupObject | null>(null);
  const [loadingState, setLoadingState] = useState({
    roles: true,
  });
  const [roles, setRoles] = useState<Role[]>([]);

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

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleGroupDelete = async ({ id, name }: GroupObject) => {
    try {
      await deleteGroup(id);
      refreshData();
      setGroupCurrentlyDeleting(null);
      addSuccessToast(t('Deleted group: %s', name));
    } catch (error) {
      addDangerToast(t('There was an issue deleting %s', name));
    }
  };

  const handleBulkGroupsDelete = (groupsToDelete: GroupObject[]) => {
    const deletedGroupsNames: string[] = [];

    Promise.all(
      groupsToDelete.map(group =>
        deleteGroup(group.id)
          .then(() => {
            deletedGroupsNames.push(group.name);
          })
          .catch(err => {
            addDangerToast(t('Error deleting %s', group.name));
          }),
      ),
    )
      .then(() => {
        if (deletedGroupsNames.length > 0) {
          addSuccessToast(
            t('Deleted groups: %s', deletedGroupsNames.join(', ')),
          );
        }
      })
      .finally(() => {
        refreshData();
      });
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
        accessor: 'label',
        id: 'label',
        Header: t('Label'),
        Cell: ({
          row: {
            original: { label },
          },
        }: any) => <span>{label}</span>,
      },
      {
        accessor: 'description',
        id: 'description',
        Header: t('Description'),
        Cell: ({
          row: {
            original: { description },
          },
        }: any) => <span>{description}</span>,
        hidden: true,
      },
      {
        accessor: 'roles',
        id: 'roles',
        Header: t('Roles'),
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
        accessor: 'users',
        id: 'users',
        Header: t('Users'),
        Cell: ({
          row: {
            original: { users },
          },
        }: any) => (
          <span>{users?.map((user: User) => user.username).join(', ')}</span>
        ),
        disableSortBy: true,
        hidden: true,
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => {
            setCurrentGroup(original);
            openModal(ModalType.EDIT);
          };
          const handleDelete = () => setGroupCurrentlyDeleting(original);
          const actions = isAdmin
            ? [
                {
                  label: 'group-list-edit-action',
                  tooltip: t('Edit group'),
                  placement: 'bottom',
                  icon: 'EditOutlined',
                  onClick: handleEdit,
                },
                {
                  label: 'group-list-delete-action',
                  tooltip: t('Delete group'),
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
        name: t('Bulk select'),
        onClick: toggleBulkSelect,
        buttonStyle: 'secondary',
      },
      {
        name: t('Group'),
        icon: <Icons.PlusOutlined iconSize="m" />,
        buttonStyle: 'primary',
        onClick: () => {
          openModal(ModalType.ADD);
        },
        loading: loadingState.roles,
        'data-test': 'add-group-button',
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
        operator: ListViewFilterOperator.Contains,
      },
      {
        Header: t('Label'),
        key: 'label',
        id: 'label',
        input: 'search',
        operator: ListViewFilterOperator.Contains,
      },
      {
        Header: t('Description'),
        key: 'description',
        id: 'description',
        input: 'search',
        operator: ListViewFilterOperator.Contains,
      },
      {
        Header: t('Roles'),
        key: 'roles',
        id: 'roles',
        input: 'select',
        operator: ListViewFilterOperator.RelationManyMany,
        unfilteredLabel: t('All'),
        selects: roles?.map(role => ({
          label: role.name,
          value: role.id,
        })),
        loading: loadingState.roles,
        dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
      {
        Header: t('Users'),
        key: 'users',
        id: 'users',
        input: 'select',
        operator: ListViewFilterOperator.RelationManyMany,
        unfilteredLabel: t('All'),
        fetchSelects: async (filterValue, page, pageSize) =>
          fetchUserOptions(filterValue, page, pageSize, addDangerToast),
        dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
    ],
    [loadingState.roles, roles],
  );

  const emptyState = {
    title: t('No groups yet'),
    image: 'filter-results.svg',
    ...(isAdmin && {
      buttonAction: () => {
        openModal(ModalType.ADD);
      },
      buttonIcon: <Icons.PlusOutlined iconSize="m" />,
      buttonText: t('Group'),
    }),
  };

  return (
    <>
      <SubMenu name={t('List Groups')} buttons={subMenuButtons} />
      <GroupListAddModal
        onHide={() => closeModal(ModalType.ADD)}
        show={modalState.add}
        onSave={() => {
          refreshData();
          closeModal(ModalType.ADD);
        }}
        roles={roles}
      />
      {modalState.edit && currentGroup && (
        <GroupListEditModal
          group={currentGroup}
          show={modalState.edit}
          onHide={() => closeModal(ModalType.EDIT)}
          onSave={() => {
            refreshData();
            closeModal(ModalType.EDIT);
          }}
          roles={roles}
        />
      )}

      {groupCurrentlyDeleting && (
        <DeleteModal
          description={t('This action will permanently delete the group.')}
          onConfirm={() => {
            if (groupCurrentlyDeleting) {
              handleGroupDelete(groupCurrentlyDeleting);
            }
          }}
          onHide={() => setGroupCurrentlyDeleting(null)}
          open
          title={t('Delete Group?')}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to delete the selected groups?')}
        onConfirm={handleBulkGroupsDelete}
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
            <ListView<GroupObject>
              className="group-list-view"
              columns={columns}
              count={groupsCount}
              data={groups}
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

export default GroupsList;
