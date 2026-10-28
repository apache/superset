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
import { SupersetClient } from '@superset-ui/core';
import { css } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  Flex,
  Form,
  Icons,
  Input,
  Result,
  Typography,
} from '@superset-ui/core/components';
import { useState } from 'react';
import { ensureAppRoot } from 'src/utils/navigationUtils';
import { RoutePaths } from 'src/views/routePaths';
import { StyledCard, StyledLabel } from 'src/pages/Login/styles';

export const PASSWORD_RECOVERY_ENDPOINT = '/api/v1/security/password_recovery/';

interface ForgotPasswordForm {
  email: string;
}

export default function ForgotPassword() {
  const [form] = Form.useForm<ForgotPasswordForm>();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onFinish = async ({ email }: ForgotPasswordForm) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await SupersetClient.post({
        endpoint: PASSWORD_RECOVERY_ENDPOINT,
        jsonPayload: { email },
      });
      setSubmitted(true);
    } catch (response) {
      // Only a 2xx reaches the confirmation. The endpoint answers 200 for
      // known and unknown addresses alike, so a failed request carries no
      // account information, and showing one as a success would leave the
      // user waiting for an email that was never sent. Nothing the server
      // says is shown either way.
      setErrorMessage(
        (response as Partial<Response>)?.status === 429
          ? t('Too many requests. Please wait and try again.')
          : t('Something went wrong. Please try again later.'),
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Flex
        justify="center"
        css={css`
          width: 100%;
        `}
        data-test="forgot-password-sent"
      >
        <Result
          status="success"
          title={t('Check your email')}
          subTitle={t(
            'If an account exists for that email address, a link to reset your password has been sent to it. If no email arrives, check your spam folder or contact your administrator.',
          )}
          extra={[
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
      data-test="forgot-password-form"
      css={css`
        width: 100%;
        height: calc(100vh - 200px);
      `}
    >
      <StyledCard title={t('Forgot password')} padded>
        <Flex justify="center" vertical gap="middle">
          <Typography.Text type="secondary">
            {t(
              'Enter the email address of your account and we will send you a link to reset your password.',
            )}
          </Typography.Text>
          {errorMessage && (
            <Alert type="error" showIcon message={errorMessage} />
          )}
          <Form
            layout="vertical"
            requiredMark="optional"
            form={form}
            onFinish={onFinish}
          >
            <Form.Item<ForgotPasswordForm>
              label={<StyledLabel>{t('Email')}</StyledLabel>}
              name="email"
              rules={[
                { required: true, message: t('Please enter your email') },
                { type: 'email', message: t('Please enter a valid email') },
              ]}
            >
              <Input
                autoFocus
                autoComplete="email"
                prefix={<Icons.MailOutlined iconSize="l" />}
                data-test="email-input"
              />
            </Form.Item>
            <Form.Item label={null}>
              <Button
                block
                buttonStyle="primary"
                htmlType="submit"
                loading={loading}
                data-test="send-reset-link-button"
              >
                {t('Send reset link')}
              </Button>
            </Form.Item>
          </Form>
          <Typography.Link
            href={ensureAppRoot(RoutePaths.LOGIN)}
            data-test="back-to-login-link"
          >
            {t('Back to sign in')}
          </Typography.Link>
        </Flex>
      </StyledCard>
    </Flex>
  );
}
