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
import { useState } from 'react';
import { t } from '@superset-ui/core';
import Tabs from '@superset-ui/core/components/Tabs';
import { RoleObject } from 'src/pages/RolesList';
import {
  EmptyWrapperType,
  FormModal,
  TableView,
} from '@superset-ui/core/components';
import {
  BaseModalProps,
  FormattedPermission,
  RoleForm,
  UserObject,
} from 'src/features/roles/types';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { PermissionsField, RoleNameField, UsersField } from './RoleFormItems';
import {
  updateRoleName,
  updateRolePermissions,
  updateRoleUsers,
} from './utils';

export interface RoleListEditModalProps extends BaseModalProps {
  role: RoleObject;
  permissions: FormattedPermission[];
  users: UserObject[];
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
  users,
}: RoleListEditModalProps) {
  const { id, name, permission_ids, user_ids } = role;
  const [activeTabKey, setActiveTabKey] = useState(roleTabs.edit.key);
  const { addDangerToast, addSuccessToast } = useToasts();
  const filteredUsers = users.filter(user =>
    user?.roles.some(role => role.id === id),
  );

  const handleFormSubmit = async (values: RoleForm) => {
    try {
      await updateRoleName(id, values.roleName);
      await updateRolePermissions(id, values.rolePermissions);
      await updateRoleUsers(id, values.roleUsers);
      addSuccessToast(t('Role successfully updated!'));
    } catch (err) {
      addDangerToast(t('Error while updating role!'));
      throw err;
    }
  };

  const initialValues = {
    roleName: name,
    rolePermissions: permission_ids,
    roleUsers: user_ids,
  };

  return (
    <FormModal
      show={show}
      onHide={onHide}
      title={t('Edit Role')}
      onSave={onSave}
      formSubmitHandler={handleFormSubmit}
      initialValues={initialValues}
      bodyStyle={{ height: '400px' }}
      requiredFields={['roleName']}
    >
      <Tabs
        activeKey={activeTabKey}
        onChange={activeKey => setActiveTabKey(activeKey)}
        items={[
          {
            key: roleTabs.edit.key,
            label: roleTabs.edit.name,
            forceRender: true,
            children: (
              <>
                <RoleNameField />
                <PermissionsField permissions={permissions} />
                <UsersField users={users} />
              </>
            ),
          },
          {
            key: roleTabs.users.key,
            label: roleTabs.users.name,
            children: (
              <TableView
                columns={userColumns}
                data={filteredUsers}
                emptyWrapperType={EmptyWrapperType.Small}
              />
            ),
          },
        ]}
      />
    </FormModal>
  );
}

export default RoleListEditModal;
