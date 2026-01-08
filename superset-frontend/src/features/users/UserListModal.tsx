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
import {
  Checkbox,
  FormModal,
  Select,
  Input,
  FormItem,
  FormInstance,
} from '@superset-ui/core/components';
import { Group, Role, UserObject } from 'src/pages/UsersList/types';
import { Actions } from 'src/constants';
import { BaseUserListModalProps, FormValues } from './types';
import { createUser, updateUser, atLeastOneRoleOrGroup } from './utils';

export interface UserModalProps extends BaseUserListModalProps {
  roles: Role[];
  isEditMode?: boolean;
  isPasswordChange?: boolean;
  user?: UserObject;
  groups: Group[];
}

function UserListModal({
  show,
  onHide,
  onSave,
  roles,
  isEditMode = false,
  isPasswordChange = false,
  user,
  groups,
}: UserModalProps) {
  const { addDangerToast, addSuccessToast } = useToasts();
  const modalTitle = isPasswordChange
    ? t('Change password')
    : isEditMode
      ? t('Edit User')
      : t('Add User');
  const modalName = modalTitle;
  const modalIsEditLike = isEditMode || isPasswordChange;
  const showProfileFields = !isPasswordChange;
  const showAssociationFields = !isPasswordChange;
  const showPasswordFields = !isEditMode || isPasswordChange;

  const sanitizeValues = (formValues: FormValues) => {
    const { confirmPassword: _confirmPassword, ...rest } = formValues;
    return rest;
  };

  const handleFormSubmit = async (values: FormValues) => {
    const handleError = async (
      err: any,
      action: Actions.CREATE | Actions.UPDATE | Actions.PASSWORD_CHANGE,
    ) => {
      let errorMessage =
        action === Actions.CREATE
          ? t('There was an error creating the user. Please, try again.')
          : action === Actions.UPDATE
            ? t('There was an error updating the user. Please, try again.')
            : action === Actions.PASSWORD_CHANGE
              ? t(
                  'There was an error changing the user password. Please, try again.',
                )
              : t('An unexpected error occurred. Please, try again.');

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

    const sanitizedValues = sanitizeValues(values);

    if (isEditMode) {
      if (!user) {
        throw new Error('User is required in edit mode');
      }
      try {
        await updateUser(user.id, sanitizedValues);
        addSuccessToast(t('The user has been updated successfully.'));
      } catch (err) {
        await handleError(err, Actions.UPDATE);
      }
    } else if (isPasswordChange) {
      if (!user) {
        throw new Error('User is required in password change mode');
      }
      try {
        const password = sanitizedValues.password as string | undefined;
        if (!password) {
          throw new Error('Password is required');
        }
        await updateUser(user.id, { password });
        addSuccessToast(t('The user password has been changed successfully.'));
      } catch (err) {
        await handleError(err, Actions.PASSWORD_CHANGE);
      }
    } else {
      try {
        await createUser(sanitizedValues);
        addSuccessToast(t('The user has been created successfully.'));
      } catch (err) {
        await handleError(err, Actions.CREATE);
      }
    }
  };

  const requiredFields = isPasswordChange
    ? ['password', 'confirmPassword']
    : isEditMode
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
      name={modalName}
      title={
        <ModalTitleWithIcon isEditMode={modalIsEditLike} title={modalTitle} />
      }
      onSave={onSave}
      formSubmitHandler={handleFormSubmit}
      requiredFields={requiredFields}
      initialValues={initialValues}
    >
      {(form: FormInstance) => (
        <>
          {showProfileFields && (
            <>
              <FormItem
                name="first_name"
                label={t('First name')}
                rules={[
                  { required: true, message: t('First name is required') },
                ]}
              >
                <Input
                  name="first_name"
                  placeholder={t("Enter the user's first name")}
                />
              </FormItem>
              <FormItem
                name="last_name"
                label={t('Last name')}
                rules={[
                  { required: true, message: t('Last name is required') },
                ]}
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
            </>
          )}
          {showAssociationFields && (
            <>
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
            </>
          )}
          {showPasswordFields && (
            <>
              <FormItem
                name="password"
                label={t('Password')}
                rules={[{ required: true, message: t('Password is required') }]}
              >
                <Input.Password
                  name="password"
                  placeholder={t("Enter the user's password")}
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
) => <UserListModal {...props} isEditMode={false} isPasswordChange={false} />;

export const UserListEditModal = (
  props: Omit<UserModalProps, 'isEditMode'> & { user: UserObject },
) => <UserListModal {...props} isEditMode isPasswordChange={false} />;

export const UserListPasswordChangeModal = (
  props: Omit<UserModalProps, 'isEditMode' | 'isPasswordChange'> & {
    user: UserObject;
  },
) => <UserListModal {...props} isEditMode={false} isPasswordChange />;

export default UserListModal;
