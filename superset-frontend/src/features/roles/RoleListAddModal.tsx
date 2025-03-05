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
import { AntdForm, Select } from 'src/components';
import Modal from 'src/components/Modal';
import { Input } from 'src/components/Input';
import Button from 'src/components/Button';
import { FormattedPermission } from './types';

export interface AddRoleModalProps {
  show: boolean;
  onHide: () => void;
  addDangerToast: (message: string) => void;
  onSave: () => void;
  permissions: FormattedPermission[];
  addSuccessToast: (message: string) => void;
}

function AddRoleModal({
  show,
  onHide,
  addDangerToast,
  onSave,
  permissions,
  addSuccessToast,
}: AddRoleModalProps) {
  const [form] = AntdForm.useForm();
  const FormItem = AntdForm.Item;
  const [isSaving, setIsSaving] = useState(false);
  const [roleName, setRoleName] = useState('');

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
        const { json: roleResponse } = await SupersetClient.post({
          endpoint: '/api/v1/security/roles/',
          jsonPayload: { name: values.roleName },
        });

        if (
          values.selectedPermissions &&
          values.selectedPermissions.length > 0
        ) {
          await SupersetClient.post({
            endpoint: `/api/v1/security/roles/${roleResponse.id}/permissions`,
            jsonPayload: {
              permission_view_menu_ids: values.selectedPermissions,
            },
          });
        }
        addSuccessToast(t('Role successfully created!'));
        resetForm();
        onSave();
      } catch (err) {
        addDangerToast(t('Error while adding role'));
      } finally {
        setIsSaving(false);
      }
    },
    [permissions, addDangerToast, addSuccessToast, onSave, resetForm],
  );

  return (
    <Modal
      show={show}
      title={t('Add Role')}
      onHide={handleClose}
      footer={
        <>
          <Button
            buttonStyle="secondary"
            data-test="add-role-modal-cancel-button"
            onClick={handleClose}
          >
            {t('Cancel')}
          </Button>
          <Button
            buttonStyle="primary"
            htmlType="submit"
            onClick={() => form.submit()}
            data-test="add-role-modal-save-button"
            disabled={isSaving || !roleName.trim()}
          >
            {isSaving ? t('Saving...') : t('Save')}
          </Button>
        </>
      }
    >
      <AntdForm form={form} layout="vertical" onFinish={handleFormSubmit}>
        <FormItem
          name="roleName"
          label={t('Role Name')}
          rules={[
            { required: true, message: t('Role name is required') },
            { whitespace: true, message: t('Role name cannot be empty') },
          ]}
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
              label: p.value,
              value: p.id,
            }))}
            getPopupContainer={trigger =>
              trigger.closest('.antd5-modal-content')
            }
            data-test="permissions-select"
          />
        </FormItem>
      </AntdForm>
    </Modal>
  );
}

export default AddRoleModal;
