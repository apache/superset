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
import { useEffect, useState } from 'react';
import { SupersetClient, t } from '@superset-ui/core';
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
import { GroupObject } from 'src/pages/GroupsList';
import rison from 'rison';
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
  groups,
}: RoleListEditModalProps) {
  const { id, name, permission_ids, user_ids, group_ids } = role;
  const [activeTabKey, setActiveTabKey] = useState(roleTabs.edit.key);
  const { addDangerToast, addSuccessToast } = useToasts();
  const [roleUsers, setRoleUsers] = useState<UserObject[]>([]);
  const [loadingRoleUsers, setLoadingRoleUsers] = useState(true);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user_ids.length) {
        setRoleUsers([]);
        setLoadingRoleUsers(false);
        return;
      }

      const query = rison.encode({
        filters: [{ col: 'id', opr: 'in', value: user_ids }],
        page: 0,
        page_size: 100,
      });

      try {
        const response = await SupersetClient.get({
          endpoint: `/api/v1/security/users/?q=${query}`,
        });
        setRoleUsers(response.json?.result || []);
      } catch {
        addDangerToast(t('There was an error loading users.'));
      } finally {
        setLoadingRoleUsers(false);
        setFormKey(prevKey => prevKey + 1);
      }
    };
    fetchUsers();
  }, [user_ids]);

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
      key={formKey}
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
    </FormModal>
  );
}

export default RoleListEditModal;
