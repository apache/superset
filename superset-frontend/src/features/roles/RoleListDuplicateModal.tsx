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
import { useState, useCallback, useEffect } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import Modal from 'src/components/Modal';
import { Input } from 'src/components/Input';
import Button from 'src/components/Button';
import { AntdForm } from 'src/components';
import { RoleObject } from 'src/pages/RolesList';

export interface DuplicateRoleModalProps {
  role: RoleObject;
  show: boolean;
  onHide: () => void;
  addDangerToast: (message: string) => void;
  onSave: () => void;
  addSuccessToast: (message: string) => void;
}

function DuplicateRoleModal({
  role,
  show,
  onHide,
  addDangerToast,
  onSave,
  addSuccessToast,
}: DuplicateRoleModalProps) {
  const { name, permission_ids } = role;
  const [isSaving, setIsSaving] = useState(false);
  const [form] = AntdForm.useForm();
  const FormItem = AntdForm.Item;
  const [roleName, setRoleName] = useState('');

  const handleClose = useCallback(() => {
    form.resetFields();
    setIsSaving(false);
    onHide();
  }, [onHide, form]);

  const handleSave = async (values: { roleName: string }) => {
    setIsSaving(true);

    try {
      const { json: roleResponse } = await SupersetClient.post({
        endpoint: '/api/v1/security/roles/',
        jsonPayload: { name: values.roleName },
      });

      if (permission_ids.length > 0) {
        await SupersetClient.post({
          endpoint: `/api/v1/security/roles/${roleResponse.id}/permissions`,
          jsonPayload: { permission_view_menu_ids: permission_ids },
        });
      }

      addSuccessToast(t('Role successfully duplicated!'));
      handleClose();
      onSave();
    } catch (err) {
      addDangerToast(t('Error while duplicating role'));
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (show) {
      form.resetFields();
    }
  }, [show, form]);

  return (
    <Modal
      show={show}
      title={t('Duplicate role %(name)s', { name })}
      onHide={handleClose}
      footer={
        <>
          <Button
            buttonStyle="secondary"
            data-test="duplicate-role-modal-cancel-button"
            onClick={handleClose}
          >
            {t('Cancel')}
          </Button>
          <Button
            disabled={isSaving || !roleName.trim()}
            buttonStyle="primary"
            htmlType="submit"
            onClick={() => form.submit()}
            data-test="duplicate-role-modal-save-button"
          >
            {isSaving ? t('Saving...') : t('Save')}
          </Button>
        </>
      }
    >
      <AntdForm form={form} layout="vertical" onFinish={handleSave}>
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
      </AntdForm>
    </Modal>
  );
}

export default DuplicateRoleModal;
