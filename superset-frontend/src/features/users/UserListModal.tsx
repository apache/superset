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
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  Checkbox,
  FormModal,
  Modal,
  Select,
  Input,
  Form,
  FormItem,
  FormInstance,
} from '@superset-ui/core/components';
import { Group, Role, UserObject, UserAssetsSummary } from 'src/pages/UsersList/types';
import { Actions } from 'src/constants';
import { BaseUserListModalProps, FormValues } from './types';
import { createUser, updateUser, atLeastOneRoleOrGroup } from './utils';

export interface UserModalProps extends BaseUserListModalProps {
  roles: Role[];
  isEditMode?: boolean;
  user?: UserObject;
  groups: Group[];
}

function UserListModal({
  show,
  onHide,
  onSave,
  roles,
  isEditMode = false,
  user,
  groups,
}: UserModalProps) {
  const { addDangerToast, addSuccessToast } = useToasts();
  const handleFormSubmit = async (values: FormValues) => {
    const handleError = async (
      err: any,
      action: Actions.CREATE | Actions.UPDATE,
    ) => {
      let errorMessage =
        action === Actions.CREATE
          ? t('There was an error creating the user. Please, try again.')
          : t('There was an error updating the user. Please, try again.');

      if (err.status === 422) {
        const errorData = await err.json();
        const detail = errorData?.message || '';

        if (detail.includes('duplicate key value')) {
          if (detail.includes('ab_user_username_key')) {
            errorMessage = t(
              'This username is already taken. Please choose another one.',
            );
          } else if (detail.includes('ab_user_email_key')) {
            errorMessage = t(
              'This email is already associated with an account. Please choose another one.',
            );
          }
        }
      }

      addDangerToast(errorMessage);
      throw err;
    };

    if (isEditMode) {
      if (!user) {
        throw new Error('User is required in edit mode');
      }
      try {
        await updateUser(user.id, values);
        addSuccessToast(t('The user has been updated successfully.'));
      } catch (err) {
        await handleError(err, Actions.UPDATE);
      }
    } else {
      try {
        await createUser(values);
        addSuccessToast(t('The user has been created successfully.'));
      } catch (err) {
        await handleError(err, Actions.CREATE);
      }
    }
  };

  const requiredFields = isEditMode
    ? ['first_name', 'last_name', 'username', 'email']
    : [
        'first_name',
        'last_name',
        'username',
        'email',
        'password',
        'confirmPassword',
      ];

  const initialValues = {
    ...user,
    roles: user?.roles?.map(role => role.id) || [],
    groups: user?.groups?.map(group => group.id) || [],
  };

  return (
    <FormModal
      show={show}
      onHide={onHide}
      name={isEditMode ? 'Edit User' : 'Add User'}
      title={
        <ModalTitleWithIcon
          isEditMode={isEditMode}
          title={isEditMode ? t('Edit User') : t('Add User')}
        />
      }
      onSave={onSave}
      formSubmitHandler={handleFormSubmit}
      requiredFields={requiredFields}
      initialValues={initialValues}
    >
      {(form: FormInstance) => (
        <>
          <FormItem
            name="first_name"
            label={t('First name')}
            rules={[{ required: true, message: t('First name is required') }]}
          >
            <Input
              name="first_name"
              placeholder={t("Enter the user's first name")}
            />
          </FormItem>
          <FormItem
            name="last_name"
            label={t('Last name')}
            rules={[{ required: true, message: t('Last name is required') }]}
          >
            <Input
              name="last_name"
              placeholder={t("Enter the user's last name")}
            />
          </FormItem>
          <FormItem
            name="username"
            label={t('Username')}
            rules={[{ required: true, message: t('Username is required') }]}
          >
            <Input
              name="username"
              placeholder={t("Enter the user's username")}
            />
          </FormItem>
          <FormItem
            name="active"
            label={t('Is active?')}
            valuePropName="checked"
          >
            <Checkbox
              onChange={checked => {
                form.setFieldsValue({ isActive: checked });
              }}
            />
          </FormItem>
          <FormItem
            name="email"
            label={t('Email')}
            rules={[
              { required: true, message: t('Email is required') },
              {
                type: 'email',
                message: t('Please enter a valid email address'),
              },
            ]}
          >
            <Input name="email" placeholder={t("Enter the user's email")} />
          </FormItem>
          <FormItem
            name="roles"
            label={t('Roles')}
            dependencies={['groups']}
            rules={[atLeastOneRoleOrGroup('groups')]}
          >
            <Select
              name="roles"
              mode="multiple"
              placeholder={t('Select roles')}
              options={roles.map(role => ({
                value: role.id,
                label: role.name,
              }))}
              getPopupContainer={trigger =>
                trigger.closest('.ant-modal-content')
              }
            />
          </FormItem>
          <FormItem
            name="groups"
            label={t('Groups')}
            dependencies={['roles']}
            rules={[atLeastOneRoleOrGroup('roles')]}
          >
            <Select
              name="groups"
              mode="multiple"
              placeholder={t('Select groups')}
              options={groups.map(group => ({
                value: group.id,
                label: group.name,
              }))}
              getPopupContainer={trigger =>
                trigger.closest('.ant-modal-content')
              }
            />
          </FormItem>
          {!isEditMode && (
            <>
              <FormItem
                name="password"
                label={t('Password')}
                rules={[{ required: true, message: t('Password is required') }]}
              >
                <Input.Password
                  name="password"
                  placeholder="Enter the user's password"
                />
              </FormItem>
              <FormItem
                name="confirmPassword"
                label={t('Confirm Password')}
                dependencies={['password']}
                rules={[
                  {
                    required: true,
                    message: t('Please confirm your password'),
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error(t('Passwords do not match!')),
                      );
                    },
                  }),
                ]}
              >
                <Input.Password
                  name="confirmPassword"
                  placeholder={t("Confirm the user's password")}
                />
              </FormItem>
            </>
          )}
        </>
      )}
    </FormModal>
  );
}

export const UserListAddModal = (
  props: Omit<UserModalProps, 'isEditMode' | 'initialValues'>,
) => <UserListModal {...props} isEditMode={false} />;

export const UserListEditModal = (
  props: Omit<UserModalProps, 'isEditMode'> & { user: UserObject },
) => <UserListModal {...props} isEditMode />;


export interface UserDeleteModalProps {
  userToDelete: UserObject;
  availableUsers: UserObject[];
  assets: UserAssetsSummary | null;
  onConfirm: (payload: { newOwnerId: number | null; softDelete: boolean }) => void;
  onCancel: () => void;
}

export function UserListDeleteModal({
  userToDelete,
  availableUsers,
  assets,
  onConfirm,
  onCancel,
}: UserDeleteModalProps) {
  const TITLE = 'Delete User'
  const [title, setTitle] = useState(TITLE);
  const [doReassign, setDoReassign] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [softDelete, setSoftDelete] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');

  const handleSubmit = () => {
    onConfirm({ newOwnerId: selectedUserId, softDelete: softDelete});
  };

  const disableSubmit = (doReassign && !selectedUserId) ||
                        (confirmationText.toUpperCase() !== 'DELETE');

  if (!doReassign && assets?.count) {
    setTitle('Reassign Assets and Delete User');
    setDoReassign(true);
  }

  return (
    <Modal
      show
      onHide={onCancel}
      title={t(title)}
      onHandledPrimaryAction={handleSubmit}
      primaryButtonName={t('Confirm')}
      primaryButtonStyle="danger"
      disablePrimaryButton={disableSubmit}
    >
      <Form>
        {doReassign && (<div>
            <div style={{ marginBottom: '16px', fontWeight: 500 }}>
              {t('User "%s" owns the following assets:', userToDelete.username)}
              <ul style={{ marginTop: '8px' }}>
                {assets?.dashboards && assets.dashboards.length > 0 &&
                  (<li>{t('Dashboards:')}
                    <ul>
                      {assets.dashboards.map((e) => {return (
                        <li>{e}</li>
                      )})}
                    </ul>
                  </li>)}
                {assets?.charts && assets.charts.length > 0 &&
                  (<li>{t('Charts:')}
                    <ul>
                      {assets.charts.map((e) => {return (
                        <li>{e}</li>
                      )})}
                    </ul>
                  </li>)}
                {assets?.saved_queries && assets.saved_queries.length > 0 &&
                  (<li>{t('Saved Queries:')}
                    <ul>
                      {assets.saved_queries.map((e) => {return (
                        <li>{e}</li>
                      )})}
                    </ul>
                  </li>)}
              </ul>
            </div>
            <div style={{ marginBottom: '16px', fontWeight: 500 }}>
              {t('Please select a user to reassign these assets to:')}
            </div>

            <div style={{ marginBottom: '16px', fontWeight: 500 }}>
              <Select
                placeholder={t('Select a user')}
                value={selectedUserId}
                onChange={(value: number) => setSelectedUserId(value)}
                options={availableUsers.map(user => ({
                  label: `${user.first_name} ${user.last_name} (@${user.username})`,
                  value: user.id,
                }))}
              />
            </div>
          </div>
        )}

        <Checkbox
          checked={softDelete}
          onChange={e => setSoftDelete(e.target.checked)}
          style={{ marginBottom: '16px', fontSize: '12px', color: '#667' }}
        >
          {t(
            "Soft delete user. Selecting this option allows for future retrieval of this user's account from the database if needed."
          )}
        </Checkbox>
  
        <FormItem>
          <Input
            placeholder={t('Type DELETE to confirm')}
            value={confirmationText}
            onChange={e => setConfirmationText(e.target.value)}
            style={{ width: '100%' }}
          />
        </FormItem>

        {confirmationText.toUpperCase() !== 'DELETE' && (
          <div style={{ fontSize: '12px', color: '#b00' }}>
            {t('You must type DELETE to enable the button.')}
          </div>
        )}
      </Form>
    </Modal>
  );
}

export default UserListModal;
