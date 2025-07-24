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
import { RoleObject } from 'src/pages/RolesList';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { FormModal, Icons } from '@superset-ui/core/components';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';
import { RoleNameField } from './RoleFormItems';
import { BaseModalProps, RoleForm } from './types';
import { createRole, updateRolePermissions } from './utils';

export interface RoleListDuplicateModalProps extends BaseModalProps {
  role: RoleObject;
}

function RoleListDuplicateModal({
  role,
  show,
  onHide,
  onSave,
}: RoleListDuplicateModalProps) {
  const { name, permission_ids } = role;
  const { addDangerToast, addSuccessToast } = useToasts();

  const handleFormSubmit = async (values: RoleForm) => {
    try {
      const { json: roleResponse } = await createRole(values.roleName);

      if (permission_ids.length > 0) {
        await updateRolePermissions(roleResponse.id, permission_ids);
      }
      addSuccessToast(t('The role has been duplicated successfully.'));
    } catch (err) {
      addDangerToast(
        t('There was an error duplicating the role. Please, try again.'),
      );
      throw err;
    }
  };

  return (
    <FormModal
      show={show}
      onHide={onHide}
      name={t('Duplicate role %(name)s', { name })}
      title={
        <ModalTitleWithIcon
          title={t('Duplicate role %(name)s', { name })}
          icon={<Icons.EditOutlined />}
        />
      }
      onSave={onSave}
      formSubmitHandler={handleFormSubmit}
      requiredFields={['roleName']}
      initialValues={{}}
    >
      <RoleNameField />
    </FormModal>
  );
}
export default RoleListDuplicateModal;
