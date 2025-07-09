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
import { SupersetClient, t } from '@superset-ui/core';
import { FormModal, FormItem, Input } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { User } from 'src/types/bootstrapTypes';
import { BaseUserListModalProps, FormValues } from '../users/types';

export interface UserInfoModalProps extends BaseUserListModalProps {
  isEditMode?: boolean;
  user?: User;
}

function UserInfoModal({
  show,
  onHide,
  onSave,
  isEditMode,
  user,
}: UserInfoModalProps) {
  const { addDangerToast, addSuccessToast } = useToasts();

  const requiredFields = isEditMode
    ? ['first_name', 'last_name']
    : ['password', 'confirm_password'];
  const initialValues = isEditMode
    ? {
        first_name: user?.firstName,
        last_name: user?.lastName,
      }
    : {};
  const handleFormSubmit = async (values: FormValues) => {
    try {
      const { confirm_password, ...payload } = values;
      await SupersetClient.put({
        endpoint: `/api/v1/me/`,
        jsonPayload: { ...payload },
      });
      addSuccessToast(
        isEditMode
          ? t('The user was updated successfully')
          : t('The password reset was successful'),
      );
      onSave();
    } catch (error) {
      addDangerToast(t('Something went wrong while saving the user info'));
    }
  };

  const EditModeFields = () => (
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
        <Input name="last_name" placeholder={t("Enter the user's last name")} />
      </FormItem>
    </>
  );

  const ResetPasswordFields = () => (
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
        name="confirm_password"
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
              return Promise.reject(new Error(t('Passwords do not match!')));
            },
          }),
        ]}
      >
        <Input.Password
          name="confirm_password"
          placeholder={t("Confirm the user's password")}
        />
      </FormItem>
    </>
  );

  return (
    <FormModal
      show={show}
      onHide={onHide}
      title={isEditMode ? t('Edit user') : t('Reset password')}
      onSave={onSave}
      formSubmitHandler={handleFormSubmit}
      requiredFields={requiredFields}
      initialValues={initialValues}
    >
      {isEditMode ? <EditModeFields /> : <ResetPasswordFields />}
    </FormModal>
  );
}

export const UserInfoResetPasswordModal = (
  props: Omit<UserInfoModalProps, 'isEditMode' | 'user'>,
) => <UserInfoModal {...props} isEditMode={false} />;

export const UserInfoEditModal = (
  props: Omit<UserInfoModalProps, 'isEditMode'> & { user: User },
) => <UserInfoModal {...props} isEditMode />;
