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
import { useEffect, useState, useCallback } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import Modal from 'src/components/Modal';
import Tabs from 'src/components/Tabs';
import { AntdForm, Select } from 'src/components/';
import { Input } from 'src/components/Input';
import Button from 'src/components/Button';
import { RoleObject } from 'src/pages/RolesList';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import { FormattedPermission, UserObject } from 'src/features/roles/types';
import { CellProps } from 'react-table';

type EditRoleModalProps = {
  show: boolean;
  onHide: () => void;
  addDangerToast: (message: string) => void;
  addSuccessToast: (message: string) => void;
  onSave: () => void;
  role: RoleObject;
  permissions: FormattedPermission[];
  users: UserObject[];
};

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

function EditRoleModal({
  show,
  onHide,
  addDangerToast,
  role,
  onSave,
  addSuccessToast,
  permissions,
  users,
}: EditRoleModalProps) {
  const { id, name, permission_ids, user_ids } = role;
  const [activeTabKey, setActiveTabKey] = useState(roleTabs.edit.key);
  const [form] = AntdForm.useForm();
  const FormItem = AntdForm.Item;
  const [isSaving, setIsSaving] = useState(false);
  const filteredUsers = users.filter(user =>
    user?.roles.some(role => role.id === id),
  );

  const [roleName, setRoleName] = useState(name);

  const resetForm = useCallback(() => {
    form.resetFields();
    setIsSaving(false);
  }, [form]);

  const handleClose = useCallback(() => {
    resetForm();
    onHide();
  }, [onHide, resetForm]);

  useEffect(() => {
    if (show) {
      resetForm();
    }
  }, [show, resetForm]);

  const handleFormSubmit = useCallback(
    async values => {
      try {
        setIsSaving(true);
        await SupersetClient.put({
          endpoint: `/api/v1/security/roles/${id}`,
          jsonPayload: { name: values.roleName },
        });

        await SupersetClient.post({
          endpoint: `/api/v1/security/roles/${id}/permissions`,
          jsonPayload: { permission_view_menu_ids: values.selectedPermissions },
        });

        await SupersetClient.put({
          endpoint: `/api/v1/security/roles/${id}/users`,
          jsonPayload: { user_ids: values.selectedUsers },
        });

        addSuccessToast(t('Role successfully updated!'));
        resetForm();
        onSave();
      } catch (err) {
        addDangerToast(t('Error while updating role'));
      } finally {
        setIsSaving(false);
      }
    },
    [id, addDangerToast, addSuccessToast, onSave, resetForm],
  );

  return (
    <Modal
      show={show}
      title={t('Edit Role')}
      onHide={handleClose}
      bodyStyle={{ height: '400px' }}
      footer={
        <>
          <Button
            buttonStyle="secondary"
            data-test="edit-role-modal-cancel-button"
            onClick={handleClose}
          >
            {t('Cancel')}
          </Button>
          <Button
            buttonStyle="primary"
            htmlType="submit"
            onClick={() => form.submit()}
            data-test="edit-role-modal-save-button"
            disabled={isSaving || !roleName.trim()}
          >
            {isSaving ? t('Saving...') : t('Save')}
          </Button>
        </>
      }
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
          <AntdForm
            form={form}
            layout="vertical"
            onFinish={handleFormSubmit}
            initialValues={{
              roleName: name,
              selectedPermissions: permission_ids,
              selectedUsers: user_ids,
            }}
          >
            <FormItem
              name="roleName"
              label={t('Role Name')}
              rules={[{ required: true, message: t('Role name is required') }]}
            >
              <Input
                name="roleName"
                data-test="role-name-input"
                onChange={e => setRoleName(e.target.value)}
              />
            </FormItem>
            <FormItem name="selectedPermissions" label={t('Permissions')}>
              <Select
                mode="multiple"
                name="selectedPermissions"
                options={permissions.map(p => ({
                  label: p.label,
                  value: p.id,
                }))}
                getPopupContainer={trigger =>
                  trigger.closest('.antd5-modal-content')
                }
                data-test="permissions-select"
              />
            </FormItem>
            <FormItem name="selectedUsers" label={t('Users')}>
              <Select
                mode="multiple"
                name="selectedUsers"
                options={users.map(u => ({ label: u.username, value: u.id }))}
                data-test="users-select"
              />
            </FormItem>
          </AntdForm>
        </Tabs.TabPane>
        <Tabs.TabPane tab={roleTabs.users.name} key={roleTabs.users.key}>
          <TableView
            columns={userColumns}
            data={filteredUsers}
            emptyWrapperType={EmptyWrapperType.Small}
          />
        </Tabs.TabPane>
      </Tabs>
    </Modal>
  );
}

export default EditRoleModal;
