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
import { t } from '@superset-ui/core';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { FormModal, Icons } from '@superset-ui/core/components';
import { createRole, updateRolePermissions } from './utils';
import { PermissionsField, RoleNameField } from './RoleFormItems';
import { BaseModalProps, FormattedPermission, RoleForm } from './types';

export interface RoleListAddModalProps extends BaseModalProps {
  permissions: FormattedPermission[];
}

function RoleListAddModal({
  show,
  onHide,
  onSave,
  permissions,
}: RoleListAddModalProps) {
  const { addDangerToast, addSuccessToast } = useToasts();
  const handleFormSubmit = async (values: RoleForm) => {
    try {
      const { json: roleResponse } = await createRole(values.roleName);

      if (values.rolePermissions?.length > 0) {
        await updateRolePermissions(roleResponse.id, values.rolePermissions);
      }

      addSuccessToast(t('The role has been created successfully.'));
    } catch (err) {
      addDangerToast(
        t('There was an error creating the role. Please, try again.'),
      );
      throw err;
    }
  };

  return (
    <FormModal
      show={show}
      onHide={onHide}
      name="Add Role"
      title={
        <ModalTitleWithIcon
          title={t('Add Role')}
          icon={<Icons.PlusOutlined />}
        />
      }
      onSave={onSave}
      formSubmitHandler={handleFormSubmit}
      requiredFields={['roleName']}
      initialValues={{}}
    >
      <>
        <RoleNameField />
        <PermissionsField permissions={permissions} />
      </>
    </FormModal>
  );
}

export default RoleListAddModal;
