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
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  FormModal,
  FormItem,
  Input,
  Icons,
  type FormInstance,
} from '@superset-ui/core/components';
import { GeneratePasswordInputSuffix } from 'src/components/GeneratePasswordInputSuffix';
import { generateAuthDbPassword } from 'src/utils/generateAuthDbPassword';
import { UserObject } from 'src/pages/UsersList/types';
import { buildSecurityUserUpdatePayload } from './utils';

export interface UserListResetPasswordModalProps {
  show: boolean;
  onHide: () => void;
  onSave: () => void;
  user: UserObject | null;
}

function UserListResetPasswordModal({
  show,
  onHide,
  onSave,
  user,
}: UserListResetPasswordModalProps) {
  const { addDangerToast, addSuccessToast } = useToasts();

  const handleFormSubmit = async (values: {
    password: string;
    confirmPassword: string;
  }) => {
    if (!user) {
      return;
    }
    const { confirmPassword, ...rest } = values;
    void confirmPassword;
    const payload = {
      ...buildSecurityUserUpdatePayload(user),
      password: rest.password,
    };
    try {
      await SupersetClient.put({
        endpoint: `/api/v1/security/users/${user.id}`,
        jsonPayload: payload,
      });
      addSuccessToast(
        t('Password for %(username)s was updated successfully', {
          username: user.username,
        }),
      );
      onSave();
    } catch (error) {
      const clientError = await getClientErrorObject(error);
      const raw = clientError.message;
      const text =
        typeof raw === 'string'
          ? raw
          : raw && typeof raw === 'object'
            ? (Object.values(raw).flat() as string[]).join(' ')
            : t('Something went wrong while updating the password');
      addDangerToast(text);
      throw error;
    }
  };

  return (
    <FormModal
      show={show}
      onHide={onHide}
      name="user-list-reset-password"
      title={
        <ModalTitleWithIcon
          title={
            user
              ? `${t('Reset password')} — ${user.username}`
              : t('Reset password')
          }
          icon={<Icons.KeyOutlined />}
        />
      }
      onSave={onSave}
      formSubmitHandler={handleFormSubmit}
      requiredFields={['password', 'confirmPassword']}
      initialValues={{}}
    >
      {(form: FormInstance) => (
        <>
          <FormItem
            name="password"
            label={t('New password')}
            rules={[{ required: true, message: t('Password is required') }]}
          >
            <Input.Password
              name="password"
              autoComplete="new-password"
              placeholder={t("Enter the user's new password")}
              suffix={
                <GeneratePasswordInputSuffix
                  onGenerate={() => {
                    const pwd = generateAuthDbPassword();
                    form.setFieldsValue({ password: pwd, confirmPassword: pwd });
                  }}
                />
              }
            />
          </FormItem>
          <FormItem
            name="confirmPassword"
            label={t('Confirm password')}
            dependencies={['password']}
            rules={[
              {
                required: true,
                message: t('Please confirm the password'),
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
              name="confirmPassword"
              autoComplete="new-password"
              placeholder={t('Confirm the new password')}
            />
          </FormItem>
        </>
      )}
    </FormModal>
  );
}

export default UserListResetPasswordModal;
