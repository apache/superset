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
import { useEffect, useRef, useState } from 'react';
import { t } from '@superset-ui/core';
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
  FormattedPermission,
  RoleForm,
} from 'src/features/roles/types';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { GroupObject } from 'src/pages/GroupsList';
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
} from './utils';

export interface RoleListEditModalProps extends BaseModalProps {
  role: RoleObject;
  permissions: FormattedPermission[];
  groups: GroupObject[];
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
  permissions,
  groups,
}: RoleListEditModalProps) {
  const { id, name, permission_ids, user_ids, group_ids } = role;
  const [activeTabKey, setActiveTabKey] = useState(roleTabs.edit.key);
  const { addDangerToast, addSuccessToast } = useToasts();
  const [roleUsers, setRoleUsers] = useState<UserObject[]>([]);
  const [loadingRoleUsers, setLoadingRoleUsers] = useState(true);
  const formRef = useRef<FormInstance | null>(null);

  useEffect(() => {
    if (!user_ids.length) {
      setRoleUsers([]);
      setLoadingRoleUsers(false);
      return;
    }

    const filters = [{ col: 'id', opr: 'in', value: user_ids }];

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
  }, [user_ids]);

  useEffect(() => {
    if (!loadingRoleUsers && formRef.current && roleUsers.length >= 0) {
      const userOptions = roleUsers.map(user => ({
        value: user.id,
        label: user.username,
      }));

      formRef.current.setFieldsValue({
        roleUsers: userOptions,
      });
    }
  }, [loadingRoleUsers, roleUsers]);

  const handleFormSubmit = async (values: RoleForm) => {
    try {
      const userIds = values.roleUsers?.map(user => user.value) || [];
      await Promise.all([
        updateRoleName(id, values.roleName),
        updateRolePermissions(id, values.rolePermissions),
        updateRoleUsers(id, userIds),
        updateRoleGroups(id, values.roleGroups),
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
    rolePermissions: permission_ids,
    roleUsers:
      roleUsers?.map(user => ({
        value: user.id,
        label: user.username,
      })) || [],
    roleGroups: group_ids,
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
                <PermissionsField permissions={permissions} />
                <UsersField
                  addDangerToast={addDangerToast}
                  loading={loadingRoleUsers}
                />
                <GroupsField groups={groups} />
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
