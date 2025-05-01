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
import { FormItem } from 'src/components/Form';
import Select from 'src/components/Select/Select';
import { Input } from 'src/components/Input';
import { t } from '@superset-ui/core';
import { FC } from 'react';
import { FormattedPermission, UserObject } from './types';

interface PermissionsFieldProps {
  permissions: FormattedPermission[];
}

interface UsersFieldProps {
  users: UserObject[];
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
      getPopupContainer={trigger => trigger.closest('.antd5-modal-content')}
      data-test="permissions-select"
    />
  </FormItem>
);

export const UsersField: FC<UsersFieldProps> = ({ users }) => (
  <FormItem name="roleUsers" label={t('Users')}>
    <Select
      mode="multiple"
      name="roleUsers"
      options={users.map(user => ({ label: user.username, value: user.id }))}
      data-test="users-select"
    />
  </FormItem>
);
