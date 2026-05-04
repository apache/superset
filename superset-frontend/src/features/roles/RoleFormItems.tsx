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
import { FormItem, Input, AsyncSelect } from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import { fetchUserOptions } from '../groups/utils';
import { fetchGroupOptions, fetchPermissionOptions } from './utils';

interface AsyncOptionsFieldProps {
  addDangerToast: (msg: string) => void;
  loading?: boolean;
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

export const PermissionsField = ({
  addDangerToast,
  loading = false,
}: AsyncOptionsFieldProps) => (
  <FormItem name="rolePermissions" label={t('Permissions')}>
    <AsyncSelect
      mode="multiple"
      name="rolePermissions"
      placeholder={t('Select permissions')}
      options={(filterValue, page, pageSize) =>
        fetchPermissionOptions(filterValue, page, pageSize, addDangerToast)
      }
      loading={loading}
      getPopupContainer={() => document.body}
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

export const GroupsField = ({
  addDangerToast,
  loading = false,
}: AsyncOptionsFieldProps) => (
  <FormItem name="roleGroups" label={t('Groups')}>
    <AsyncSelect
      mode="multiple"
      name="roleGroups"
      placeholder={t('Select groups')}
      options={(filterValue, page, pageSize) =>
        fetchGroupOptions(filterValue, page, pageSize, addDangerToast)
      }
      loading={loading}
      data-test="groups-select"
    />
  </FormItem>
);
