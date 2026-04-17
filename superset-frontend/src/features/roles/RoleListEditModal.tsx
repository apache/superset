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
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import Tabs from '@superset-ui/core/components/Tabs';
import { RoleObject } from 'src/pages/RolesList';
import {
  EmptyWrapperType,
  FormModal,
  TableView,
  FormInstance,
  Icons,
} from '@superset-ui/core/components';
import {
  BaseModalProps,
  RoleForm,
  SelectOption,
} from 'src/features/roles/types';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { SupersetClient } from '@superset-ui/core';
import { fetchPaginatedData } from 'src/utils/fetchOptions';
import { type UserObject } from 'src/pages/UsersList/types';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';
import {
  GroupsField,
  PermissionsField,
  RoleNameField,
  UsersField,
} from './RoleFormItems';
import {
  updateRoleGroups,
  updateRoleName,
  updateRolePermissions,
  updateRoleUsers,
  formatPermissionLabel,
} from './utils';

export interface RoleListEditModalProps extends BaseModalProps {
  role: RoleObject;
}

const roleTabs = {
  edit: {
    key: 'edit',
    name: t('Edit Role'),
  },
  users: {
    key: 'users',
    name: t('Users'),
  },
};

const userColumns = [
  {
    accessor: 'first_name',
    Header: t('First Name'),
    id: 'first_name',
  },
  {
    accessor: 'last_name',
    Header: t('Last Name'),
    id: 'last_name',
  },
  {
    accessor: 'username',
    Header: t('User Name'),
    id: 'username',
  },
  {
    accessor: 'email',
    Header: t('Email'),
    id: 'email',
  },
  {
    accessor: 'active',
    Header: t('Is Active?'),
    Cell: ({ value }: { value: boolean }) => (value ? t('Yes') : t('No')),
    id: 'active',
  },
];

function RoleListEditModal({
  show,
  onHide,
  role,
  onSave,
}: RoleListEditModalProps) {
  const { id, name, permission_ids = [], group_ids = [] } = role;
  const stablePermissionIds = useMemo(
    () => permission_ids,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(permission_ids)],
  );
  const stableGroupIds = useMemo(
    () => group_ids,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(group_ids)],
  );
  const [activeTabKey, setActiveTabKey] = useState(roleTabs.edit.key);
  const { addDangerToast, addSuccessToast } = useToasts();
  const [roleUsers, setRoleUsers] = useState<UserObject[]>([]);
  const [rolePermissions, setRolePermissions] = useState<SelectOption[]>([]);
  const [roleGroups, setRoleGroups] = useState<SelectOption[]>([]);
  const [loadingRoleUsers, setLoadingRoleUsers] = useState(true);
  const [loadingRolePermissions, setLoadingRolePermissions] = useState(true);
  const [loadingRoleGroups, setLoadingRoleGroups] = useState(true);
  const formRef = useRef<FormInstance | null>(null);
  const permissionFetchSucceeded = useRef(false);
  const groupFetchSucceeded = useRef(false);

  useEffect(() => {
    const filters = [{ col: 'roles', opr: 'rel_m_m', value: id }];

    fetchPaginatedData({
      endpoint: `/api/v1/security/users/`,
      pageSize: 100,
      setData: setRoleUsers,
      filters,
      setLoadingState: (loading: boolean) => setLoadingRoleUsers(loading),
      loadingKey: 'roleUsers',
      addDangerToast,
      errorMessage: t('There was an error loading users.'),
      mapResult: (user: UserObject) => ({
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
      }),
    });
  }, [addDangerToast, id]);

  useEffect(() => {
    setLoadingRolePermissions(true);
    permissionFetchSucceeded.current = false;

    SupersetClient.get({
      endpoint: `/api/v1/security/roles/${id}/permissions/`,
    })
      .then(response => {
        permissionFetchSucceeded.current = true;
        setRolePermissions(
          (
            response.json?.result as Array<{
              id: number;
              permission_name: string;
              view_menu_name: string;
            }>
          ).map(p => ({
            value: p.id,
            label: formatPermissionLabel(p.permission_name, p.view_menu_name),
          })),
        );
      })
      .catch(() => {
        addDangerToast(t('There was an error loading permissions.'));
      })
      .finally(() => {
        setLoadingRolePermissions(false);
      });
  }, [addDangerToast, id]);

  useEffect(() => {
    if (!stableGroupIds.length) {
      setRoleGroups([]);
      setLoadingRoleGroups(false);
      return;
    }

    setLoadingRoleGroups(true);
    groupFetchSucceeded.current = false;
    const filters = [{ col: 'id', opr: 'in', value: stableGroupIds }];

    fetchPaginatedData({
      endpoint: `/api/v1/security/groups/`,
      pageSize: 100,
      setData: (data: SelectOption[]) => {
        groupFetchSucceeded.current = true;
        setRoleGroups(data);
      },
      filters,
      setLoadingState: (loading: boolean) => setLoadingRoleGroups(loading),
      loadingKey: 'roleGroups',
      addDangerToast,
      errorMessage: t('There was an error loading groups.'),
      mapResult: (group: { id: number; name: string }) => ({
        value: group.id,
        label: group.name,
      }),
    });
  }, [addDangerToast, stableGroupIds, id]);

  useEffect(() => {
    if (!loadingRoleUsers && formRef.current) {
      const userOptions = roleUsers.map(user => ({
        value: user.id,
        label: user.username,
      }));

      formRef.current.setFieldsValue({
        roleUsers: userOptions,
      });
    }
  }, [loadingRoleUsers, roleUsers]);

  useEffect(() => {
    if (
      !loadingRolePermissions &&
      formRef.current &&
      stablePermissionIds.length > 0
    ) {
      const fetchedIds = new Set(rolePermissions.map(p => p.value));
      const missingIds = stablePermissionIds.filter(id => !fetchedIds.has(id));
      const allPermissions = [
        ...rolePermissions,
        ...missingIds.map(id => ({ value: id, label: String(id) })),
      ];
      if (missingIds.length > 0 && permissionFetchSucceeded.current) {
        addDangerToast(
          t('Some permissions could not be resolved and are shown as IDs.'),
        );
      }
      formRef.current.setFieldsValue({
        rolePermissions: allPermissions,
      });
    }
  }, [
    loadingRolePermissions,
    rolePermissions,
    stablePermissionIds,
    addDangerToast,
  ]);

  useEffect(() => {
    if (!loadingRoleGroups && formRef.current && stableGroupIds.length > 0) {
      const fetchedIds = new Set(roleGroups.map(g => g.value));
      const missingIds = stableGroupIds.filter(id => !fetchedIds.has(id));
      const allGroups = [
        ...roleGroups,
        ...missingIds.map(id => ({ value: id, label: String(id) })),
      ];
      if (missingIds.length > 0 && groupFetchSucceeded.current) {
        addDangerToast(
          t('Some groups could not be resolved and are shown as IDs.'),
        );
      }
      formRef.current.setFieldsValue({
        roleGroups: allGroups,
      });
    }
  }, [loadingRoleGroups, roleGroups, stableGroupIds, addDangerToast]);

  const mapSelectedIds = (options?: Array<SelectOption | number>) =>
    options?.map(option =>
      typeof option === 'number' ? option : option.value,
    ) || [];

  const handleFormSubmit = async (values: RoleForm) => {
    try {
      const userIds = values.roleUsers?.map(user => user.value) || [];
      const permissionIds = mapSelectedIds(values.rolePermissions);
      const groupIds = mapSelectedIds(values.roleGroups);
      await Promise.all([
        updateRoleName(id, values.roleName),
        updateRolePermissions(id, permissionIds),
        updateRoleUsers(id, userIds),
        updateRoleGroups(id, groupIds),
      ]);
      addSuccessToast(t('The role has been updated successfully.'));
    } catch (err) {
      addDangerToast(
        t('There was an error updating the role. Please, try again.'),
      );
      throw err;
    }
  };

  const initialValues = {
    roleName: name,
    rolePermissions: permission_ids.map(permissionId => ({
      value: permissionId,
      label: String(permissionId),
    })),
    roleUsers:
      roleUsers?.map(user => ({
        value: user.id,
        label: user.username,
      })) || [],
    roleGroups: group_ids.map(groupId => ({
      value: groupId,
      label: String(groupId),
    })),
  };

  return (
    <FormModal
      show={show}
      onHide={onHide}
      name="Edit Role"
      title={
        <ModalTitleWithIcon
          title={t('Edit Role')}
          icon={<Icons.EditOutlined />}
        />
      }
      onSave={onSave}
      formSubmitHandler={handleFormSubmit}
      initialValues={initialValues}
      requiredFields={['roleName']}
    >
      {(form: FormInstance) => {
        formRef.current = form;

        return (
          <Tabs
            activeKey={activeTabKey}
            onChange={activeKey => setActiveTabKey(activeKey)}
          >
            <Tabs.TabPane
              tab={roleTabs.edit.name}
              key={roleTabs.edit.key}
              forceRender
            >
              <>
                <RoleNameField />
                <PermissionsField
                  addDangerToast={addDangerToast}
                  loading={loadingRolePermissions}
                />
                <UsersField
                  addDangerToast={addDangerToast}
                  loading={loadingRoleUsers}
                />
                <GroupsField
                  addDangerToast={addDangerToast}
                  loading={loadingRoleGroups}
                />
              </>
            </Tabs.TabPane>
            <Tabs.TabPane tab={roleTabs.users.name} key={roleTabs.users.key}>
              <TableView
                columns={userColumns}
                data={roleUsers}
                emptyWrapperType={EmptyWrapperType.Small}
              />
            </Tabs.TabPane>
          </Tabs>
        );
      }}
    </FormModal>
  );
}

export default RoleListEditModal;
