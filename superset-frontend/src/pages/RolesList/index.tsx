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

import { useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import { useListViewResource } from 'src/views/CRUD/hooks';
import RoleListAddModal from 'src/features/roles/RoleListAddModal';
import RoleListEditModal from 'src/features/roles/RoleListEditModal';
import RoleListDuplicateModal from 'src/features/roles/RoleListDuplicateModal';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import {
  ConfirmStatusChange,
  DeleteModal,
  Tooltip,
} from '@superset-ui/core/components';
import { Modal } from '@superset-ui/core/components/Modal';
import {
  ListView,
  ListViewFilterOperator as FilterOperator,
  ListViewActionsBar,
  type ListViewProps,
  type ListViewActionProps,
  type ListViewFilters,
} from 'src/components';
import { UserObject } from 'src/features/roles/types';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import { Icons } from '@superset-ui/core/components/Icons';
import { fetchUserOptions } from 'src/features/groups/utils';
import {
  fetchGroupOptions,
  fetchPermissionOptions,
} from 'src/features/roles/utils';
import { WIDER_DROPDOWN_WIDTH } from 'src/components/ListView/utils';
import { downloadBlob } from 'src/utils/export';
import rison from 'rison';

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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const importFileInput = useRef<HTMLInputElement>(null);

  const resetImportFile = () => {
    setImportFile(null);
    if (importFileInput.current) {
      importFileInput.current.value = '';
    }
  };

  const exportRoles = async (selected: RoleObject[]) => {
    try {
      const { json: roles } = await SupersetClient.get({
        endpoint: `/api/v1/security/roles/export/?q=${rison.encode(selected.map(role => role.id))}`,
      });
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, -5);
      const filename =
        selected.length === 1
          ? `roles_export_${
              selected[0].name
                .trim()
                .replace(/\s+/g, '-')
                .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_') || 'role'
            }_${timestamp}.json`
          : `roles_export_${timestamp}.json`;
      downloadBlob(
        new Blob([JSON.stringify(roles, null, 2)], {
          type: 'application/json',
        }),
        filename,
      );
      addSuccessToast(t('Exported roles'));
    } catch (error) {
      addDangerToast(t('Unable to export roles'));
    }
  };

  const importRoles = async (file?: File) => {
    if (!file) return;
    try {
      const roleDefinitions = JSON.parse(await file.text());
      const { json: result } = await SupersetClient.post({
        endpoint: '/api/v1/security/roles/import/',
        body: JSON.stringify(roleDefinitions),
        headers: { 'Content-Type': 'application/json' },
      });
      addSuccessToast(
        t(
          'Role import complete. Created: %s; updated: %s; unchanged: %s; skipped: %s',
          result.created.join(', ') || t('none'),
          result.updated.join(', ') || t('none'),
          result.unchanged.join(', ') || t('none'),
          result.skipped.join(', ') || t('none'),
        ),
      );
      refreshData();
      setShowImportModal(false);
      resetImportFile();
    } catch (error) {
      addDangerToast(
        t(
          'Unable to import roles. Check that the file is valid and permissions exist on this instance.',
        ),
      );
    }
  };

  const isAdmin = useMemo(() => isUserAdmin(user), [user]);

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
        Cell: ({ row: { original } }: any) => original.group_ids.join(', '),
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
          const handleExport = () => exportRoles([original]);

          const actions = isAdmin
            ? [
                {
                  label: 'role-list-export-action',
                  tooltip: t('Export role'),
                  placement: 'bottom',
                  icon: 'UploadOutlined',
                  onClick: handleExport,
                },
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
    [exportRoles, isAdmin],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (isAdmin) {
    subMenuButtons.push(
      {
        name: (
          <Tooltip
            id="import-roles-tooltip"
            title={t('Import roles')}
            placement="bottom"
          >
            <Icons.DownloadOutlined
              aria-label={t('Import roles')}
              data-test="import-roles-button"
              iconSize="l"
            />
          </Tooltip>
        ),
        buttonStyle: 'link',
        onClick: () => {
          resetImportFile();
          setShowImportModal(true);
        },
      },
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
        inputName: 'role_list_search',
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
        popupStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
      {
        Header: t('Permissions'),
        key: 'permission_ids',
        id: 'permission_ids',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: async (filterValue, page, pageSize) =>
          fetchPermissionOptions(filterValue, page, pageSize, addDangerToast),
        popupStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
      {
        Header: t('Groups'),
        key: 'group_ids',
        id: 'group_ids',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: async (filterValue, page, pageSize) =>
          fetchGroupOptions(filterValue, page, pageSize, addDangerToast),
        popupStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
    ],
    [addDangerToast],
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
      <Modal
        show={showImportModal}
        title={t('Import roles')}
        onHide={() => {
          setShowImportModal(false);
          resetImportFile();
        }}
        primaryButtonName={t('Import')}
        disablePrimaryButton={!importFile}
        onHandledPrimaryAction={() => importRoles(importFile ?? undefined)}
      >
        <p>
          {t(
            'Import is additive: missing permissions are added and existing permissions are kept. Built-in roles are skipped. Every permission and view must already exist on this instance.',
          )}
        </p>
        <input
          ref={importFileInput}
          type="file"
          accept="application/json,.json"
          onChange={event => {
            setImportFile(event.currentTarget.files?.[0] ?? null);
          }}
          data-test="import-roles-input"
        />
      </Modal>
      <SubMenu name={t('List Roles')} buttons={subMenuButtons} />
      <RoleListAddModal
        onHide={() => closeModal(ModalType.ADD)}
        show={modalState.add}
        onSave={() => {
          refreshData();
          closeModal(ModalType.ADD);
        }}
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
                {
                  key: 'export',
                  name: t('Export'),
                  onSelect: exportRoles,
                  type: 'primary',
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
