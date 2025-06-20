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
import {
  FormItem,
  Input,
  Select,
  AsyncSelect,
} from '@superset-ui/core/components';
import { t } from '@superset-ui/core';
import { FC } from 'react';
import { GroupObject } from 'src/pages/GroupsList';
import { FormattedPermission } from './types';
import { fetchUserOptions } from '../groups/utils';

interface PermissionsFieldProps {
  permissions: FormattedPermission[];
}

interface GroupsFieldProps {
  groups: GroupObject[];
}

interface UsersFieldProps {
  addDangerToast: (msg: string) => void;
  loading: boolean;
}

export const RoleNameField = () => (
  <FormItem
    name="roleName"
    label={t('Role Name')}
    rules={[{ required: true, message: t('Role name is required') }]}
  >
    <Input name="roleName" data-test="role-name-input" />
  </FormItem>
);

export const PermissionsField: FC<PermissionsFieldProps> = ({
  permissions,
}) => (
  <FormItem name="rolePermissions" label={t('Permissions')}>
    <Select
      mode="multiple"
      name="rolePermissions"
      options={permissions.map(permission => ({
        label: permission.label,
        value: permission.id,
      }))}
      getPopupContainer={trigger => trigger.closest('.ant-modal-content')}
      data-test="permissions-select"
    />
  </FormItem>
);

export const UsersField = ({ addDangerToast, loading }: UsersFieldProps) => (
  <FormItem name="roleUsers" label={t('Users')}>
    <AsyncSelect
      name="roleUsers"
      mode="multiple"
      placeholder={t('Select users')}
      options={(filterValue, page, pageSize) =>
        fetchUserOptions(filterValue, page, pageSize, addDangerToast)
      }
      loading={loading}
      data-test="roles-select"
    />
  </FormItem>
);

export const GroupsField: FC<GroupsFieldProps> = ({ groups }) => (
  <FormItem name="roleGroups" label={t('Groups')}>
    <Select
      mode="multiple"
      name="roleGroups"
      options={groups.map(group => ({ label: group.name, value: group.id }))}
      data-test="groups-select"
    />
  </FormItem>
);
