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
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import { css } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  Flex,
  Form,
  Input,
  Result,
} from '@superset-ui/core/components';
import { useEffect, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { ensureAppRoot } from 'src/utils/navigationUtils';
import { RoutePaths } from 'src/views/routePaths';
import { StyledCard, StyledLabel } from 'src/pages/Login/styles';

export const PASSWORD_RESET_ENDPOINT =
  '/api/v1/security/password_recovery/reset/';

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

type ResetStatus = 'form' | 'success' | 'invalidLink';

// Validation errors arrive as ``{"message": {"<field>": ["...", ...]}}``.
function getFieldErrors(message: unknown, field: string): string[] {
  if (!message || typeof message !== 'object') {
    return [];
  }
  const errors = (message as Record<string, unknown>)[field];
  if (Array.isArray(errors)) {
    return errors.filter((error): error is string => typeof error === 'string');
  }
  return typeof errors === 'string' ? [errors] : [];
}

function readToken(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? '';
}

export default function ResetPassword() {
  const [form] = Form.useForm<ResetPasswordForm>();
  const history = useHistory();
  const location = useLocation();

  // The reset link carries the token in the URL fragment (``#token=...``) so
  // it never reaches server logs or Referer headers. It is read once into a
  // ref, rather than state, so it is never rendered or kept beyond its use,
  // and the fragment is stripped from the address bar straight away.
  const tokenRef = useRef<string | null>(null);
  if (tokenRef.current === null) {
    tokenRef.current = readToken(location.hash);
  }

  const [status, setStatus] = useState<ResetStatus>(
    tokenRef.current ? 'form' : 'invalidLink',
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!location.hash) {
      return;
    }
    // Opening another reset link in the same tab only changes the fragment,
    // so the page stays mounted: switch to the new link's token rather than
    // stripping it unused.
    const token = readToken(location.hash);
    if (token && token !== tokenRef.current) {
      tokenRef.current = token;
      form.resetFields();
      setErrorMessage(null);
      setLoading(false);
      setStatus('form');
    }
    history.replace({ pathname: location.pathname, search: location.search });
  }, [form, history, location]);

  const onFinish = async ({ password }: ResetPasswordForm) => {
    // If another link is opened in this tab while the request is in flight,
    // the page belongs to that link by the time the answer arrives, so the
    // answer for this one is dropped instead of overwriting its state.
    const submittedToken = tokenRef.current;
    let superseded = false;
    setLoading(true);
    setErrorMessage(null);
    try {
      await SupersetClient.post({
        endpoint: PASSWORD_RESET_ENDPOINT,
        jsonPayload: { token: submittedToken, password },
      });
      superseded = tokenRef.current !== submittedToken;
      if (superseded) {
        return;
      }
      tokenRef.current = '';
      setStatus('success');
    } catch (response) {
      const errorData = await getClientErrorObject(response as Response);
      superseded = tokenRef.current !== submittedToken;
      if (superseded) {
        return;
      }
      const message: unknown = errorData.message;
      const passwordErrors = getFieldErrors(message, 'password');
      if (getFieldErrors(message, 'token').length > 0) {
        // Invalid, expired and already-used links are reported alike.
        tokenRef.current = '';
        setStatus('invalidLink');
      } else if (passwordErrors.length > 0) {
        // The backend owns the password policy; show its reasons as they
        // are. The link stays valid, so the user can try another password.
        form.setFields([{ name: 'password', errors: passwordErrors }]);
      } else if (errorData.status === 429) {
        setErrorMessage(t('Too many requests. Please wait and try again.'));
      } else {
        setErrorMessage(
          t('Your password could not be reset. Please try again later.'),
        );
      }
    } finally {
      if (!superseded) {
        setLoading(false);
      }
    }
  };

  if (status === 'success') {
    return (
      <Flex
        justify="center"
        css={css`
          width: 100%;
        `}
        data-test="reset-password-success"
      >
        <Result
          status="success"
          title={t('Your password has been reset')}
          subTitle={t('Sign in with your new password.')}
          extra={[
            <Button
              key="login"
              buttonStyle="primary"
              href={ensureAppRoot(RoutePaths.LOGIN)}
              data-test="login-button"
            >
              {t('Sign in')}
            </Button>,
          ]}
        />
      </Flex>
    );
  }

  if (status === 'invalidLink') {
    return (
      <Flex
        justify="center"
        css={css`
          width: 100%;
        `}
        data-test="reset-password-invalid-link"
      >
        <Result
          status="warning"
          title={t('This password reset link is invalid or has expired')}
          subTitle={t('Request a new link to reset your password.')}
          extra={[
            <Button
              key="request"
              buttonStyle="primary"
              href={ensureAppRoot(RoutePaths.FORGOT_PASSWORD)}
              data-test="request-new-link-button"
            >
              {t('Request a new link')}
            </Button>,
            <Button
              key="login"
              buttonStyle="secondary"
              href={ensureAppRoot(RoutePaths.LOGIN)}
              data-test="back-to-login-button"
            >
              {t('Back to sign in')}
            </Button>,
          ]}
        />
      </Flex>
    );
  }

  return (
    <Flex
      justify="center"
      align="center"
      data-test="reset-password-form"
      css={css`
        width: 100%;
        height: calc(100vh - 200px);
      `}
    >
      <StyledCard title={t('Choose a new password')} padded>
        <Flex justify="center" vertical gap="middle">
          {errorMessage && (
            <Alert type="error" showIcon message={errorMessage} />
          )}
          <Form
            layout="vertical"
            requiredMark="optional"
            form={form}
            onFinish={onFinish}
          >
            <Form.Item<ResetPasswordForm>
              label={<StyledLabel>{t('New password')}</StyledLabel>}
              name="password"
              rules={[{ required: true, message: t('Password is required') }]}
            >
              <Input.Password
                autoFocus
                autoComplete="new-password"
                data-test="password-input"
              />
            </Form.Item>
            <Form.Item<ResetPasswordForm>
              label={<StyledLabel>{t('Confirm new password')}</StyledLabel>}
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: t('Please confirm your password') },
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
                autoComplete="new-password"
                data-test="confirm-password-input"
              />
            </Form.Item>
            <Form.Item label={null}>
              <Button
                block
                buttonStyle="primary"
                htmlType="submit"
                loading={loading}
                data-test="reset-password-button"
              >
                {t('Reset password')}
              </Button>
            </Form.Item>
          </Form>
        </Flex>
      </StyledCard>
    </Flex>
  );
}
