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
import Tabs from 'src/components/Tabs';
import { RoleObject } from 'src/pages/RolesList';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import {
  BaseModalProps,
  FormattedPermission,
  RoleForm,
  UserObject,
} from 'src/features/roles/types';
import { CellProps } from 'react-table';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import FormModal from 'src/components/Modal/FormModal';
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
    Header: 'First Name',
  },
  {
    accessor: 'last_name',
    Header: 'Last Name',
  },
  {
    accessor: 'username',
    Header: 'User Name',
  },
  {
    accessor: 'email',
    Header: 'Email',
  },
  {
    accessor: 'active',
    Header: 'Is Active?',
    Cell: ({ cell }: CellProps<{ active: boolean }>) =>
      cell.value ? 'Yes' : 'No',
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
      >
        <Tabs.TabPane
          tab={roleTabs.edit.name}
          key={roleTabs.edit.key}
          forceRender
        >
          <>
            <RoleNameField />
            <PermissionsField permissions={permissions} />
            <UsersField users={users} />
          </>
        </Tabs.TabPane>
        <Tabs.TabPane tab={roleTabs.users.name} key={roleTabs.users.key}>
          <TableView
            columns={userColumns}
            data={filteredUsers}
            emptyWrapperType={EmptyWrapperType.Small}
          />
        </Tabs.TabPane>
      </Tabs>
    </FormModal>
  );
}

export default RoleListEditModal;
