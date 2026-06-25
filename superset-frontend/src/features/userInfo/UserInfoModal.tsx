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
import { t } from '@apache-superset/core/translation';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { useEffect, useState } from 'react';
import {
  FormModal,
  FormItem,
  Input,
  type FormInstance,
} from '@superset-ui/core/components';
import { GeneratePasswordInputSuffix } from 'src/components/GeneratePasswordInputSuffix';
import {
  AUTH_DB_DEFAULT_PASSWORD_POLICY,
  AuthDbPasswordPolicy,
  generateAuthDbPassword,
  getAuthDbPasswordPolicyError,
} from 'src/utils/generateAuthDbPassword';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import AuthDbPasswordPolicyIndicator from 'src/components/AuthDbPasswordPolicyIndicator';
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
  const [passwordPolicy, setPasswordPolicy] = useState<AuthDbPasswordPolicy>(
    AUTH_DB_DEFAULT_PASSWORD_POLICY,
  );

  useEffect(() => {
    if (!show || isEditMode) {
      return;
    }
    let ignore = false;
    SupersetClient.get({
      endpoint: '/api/v1/me/password/policy',
    })
      .then(({ json }) => {
        if (!ignore && json?.result) {
          setPasswordPolicy(json.result as AuthDbPasswordPolicy);
        }
      })
      .catch(() => {
        // Keep default policy when endpoint is unavailable.
      });
    return () => {
      ignore = true;
    };
  }, [show, isEditMode]);

  const getPasswordPolicyError = (password: string): string | null =>
    getAuthDbPasswordPolicyError(password, passwordPolicy);

  const requiredFields = isEditMode
    ? ['first_name', 'last_name']
    : ['current_password', 'new_password', 'confirm_password'];
  const initialValues = isEditMode
    ? {
        first_name: user?.firstName,
        last_name: user?.lastName,
      }
    : {};
  const handleFormSubmit = async (values: FormValues) => {
    try {
      if (isEditMode) {
        await SupersetClient.put({
          endpoint: `/api/v1/me/`,
          jsonPayload: values,
        });
        addSuccessToast(t('The user was updated successfully'));
      } else {
        await SupersetClient.put({
          endpoint: `/api/v1/me/password`,
          jsonPayload: {
            current_password: String(values.current_password),
            new_password: String(values.new_password),
            confirm_password: String(values.confirm_password),
          },
        });
        addSuccessToast(t('The password reset was successful'));
      }
    } catch (error) {
      const clientError = await getClientErrorObject(error);
      const raw = clientError.message;
      const text =
        typeof raw === 'string'
          ? raw
          : raw && typeof raw === 'object'
            ? (Object.values(raw).flat() as string[]).join(' ')
            : t('Something went wrong while saving the user info');
      addDangerToast(text);
      throw error;
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

  const ResetPasswordFields = ({ form }: { form: FormInstance }) => (
    <>
      <FormItem
        name="current_password"
        label={t('Current password')}
        rules={[{ required: true, message: t('Current password is required') }]}
      >
        <Input.Password
          name="current_password"
          autoComplete="current-password"
          placeholder={t('Enter your current password')}
        />
      </FormItem>
      <FormItem
        name="new_password"
        label={t('New password')}
        rules={[
          { required: true, message: t('New password is required') },
          {
            validator(_, value) {
              const password = String(value ?? '');
              if (!password) {
                return Promise.resolve();
              }
              const errorMessage = getPasswordPolicyError(password);
              return errorMessage
                ? Promise.reject(new Error(errorMessage))
                : Promise.resolve();
            },
          },
        ]}
      >
        <Input.Password
          name="new_password"
          autoComplete="new-password"
          placeholder={t('Enter a new password')}
          suffix={
            <GeneratePasswordInputSuffix
              onGenerate={() => {
                const pwd = generateAuthDbPassword(passwordPolicy);
                form.setFieldsValue({
                  new_password: pwd,
                  confirm_password: pwd,
                });
                // setFieldsValue does not fire the form's change handlers, so
                // validate the affected fields to recompute submit state.
                form
                  .validateFields(['new_password', 'confirm_password'])
                  .catch(() => {});
              }}
            />
          }
        />
      </FormItem>
      <FormItem noStyle dependencies={['new_password']}>
        {() => {
          const newPassword = String(form.getFieldValue('new_password') ?? '');
          return (
            <FormItem
              label={t('Password strength')}
              colon={false}
              required={false}
              style={{ marginBottom: 0 }}
            >
              <AuthDbPasswordPolicyIndicator
                password={newPassword}
                policy={passwordPolicy}
              />
            </FormItem>
          );
        }}
      </FormItem>
      <FormItem
        name="confirm_password"
        label={t('Confirm new password')}
        dependencies={['new_password']}
        rules={[
          {
            required: true,
            message: t('Please confirm your password'),
          },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('new_password') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error(t('Passwords do not match!')));
            },
          }),
        ]}
      >
        <Input.Password
          name="confirm_password"
          autoComplete="new-password"
          placeholder={t('Confirm the new password')}
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
      {(form: FormInstance) =>
        isEditMode ? <EditModeFields /> : <ResetPasswordFields form={form} />
      }
    </FormModal>
  );
}

export const ChangePasswordModal = (
  props: Omit<UserInfoModalProps, 'isEditMode' | 'user'>,
) => <UserInfoModal {...props} isEditMode={false} />;

export const UserInfoEditModal = (
  props: Omit<UserInfoModalProps, 'isEditMode'> & { user: User },
) => <UserInfoModal {...props} isEditMode />;
