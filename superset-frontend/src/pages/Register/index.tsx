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

import { SupersetClient, styled, t, css } from '@superset-ui/core';
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  Result,
} from '@superset-ui/core/components';
import { useState } from 'react';
import getBootstrapData from 'src/utils/getBootstrapData';
import ReactCAPTCHA from 'react-google-recaptcha';
import { useParams } from 'react-router-dom';

interface RegisterForm {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const StyledCard = styled(Card)`
  ${({ theme }) => css`
    width: 50%;
    margin-top: ${theme.marginXL}px;
    background: ${theme.colorBgBase};
    .ant-form-item-label label {
      color: ${theme.colorPrimary};
    }
  `}
`;

const formItemLayout = {
  labelCol: {
    xs: { span: 24 },
    sm: { span: 6 },
  },
  wrapperCol: {
    xs: { span: 24 },
    sm: { span: 24 },
  },
};

export default function Login() {
  const [form] = Form.useForm<RegisterForm>();
  const [loading, setLoading] = useState(false);
  const [captchaResponse, setCaptchaResponse] = useState<string | null>(null);
  const { activationHash } = useParams<{ activationHash?: string }>();

  const bootstrapData = getBootstrapData();

  const authRecaptchaPublicKey: string =
    bootstrapData.common.conf.RECAPTCHA_PUBLIC_KEY || '';

  if (activationHash) {
    return (
      <Flex
        justify="center"
        css={css`
          width: 100%;
        `}
        data-test="register-form"
      >
        <Result
          status="success"
          title="Registration successful"
          subTitle="Your account is activated. You can log in with your credentials."
          extra={[
            <Button type="default" href="/login/" data-test="login-button">
              {t('Login')}
            </Button>,
          ]}
        />
      </Flex>
    );
  }

  const onFinish = (values: RegisterForm) => {
    setLoading(true);
    const payload = {
      username: values.username,
      first_name: values.firstName,
      last_name: values.lastName,
      email: values.email,
      password: values.password,
      conf_password: values.confirmPassword,
      'g-recaptcha-response': captchaResponse,
    };
    SupersetClient.postForm('/register/form', payload, '').finally(() => {
      setLoading(false);
    });
  };
  return (
    <Flex
      justify="center"
      css={css`
        width: 100%;
      `}
      data-test="register-form"
    >
      <StyledCard title={t('Fill out the registration form')} padded>
        <Form form={form} onFinish={onFinish} {...formItemLayout}>
          <Form.Item<RegisterForm>
            label={t('Username')}
            name="username"
            rules={[
              { required: true, message: t('Please enter your username') },
            ]}
          >
            <Input
              placeholder={t('Username')}
              autoComplete="username"
              data-test="username-input"
            />
          </Form.Item>
          <Form.Item<RegisterForm>
            label={t('First Name')}
            name="firstName"
            rules={[
              { required: true, message: t('Please enter your first name') },
            ]}
          >
            <Input
              placeholder={t('First name')}
              autoComplete="given-name"
              data-test="first-name-input"
            />
          </Form.Item>
          <Form.Item<RegisterForm>
            label={t('Last Name')}
            name="lastName"
            rules={[
              { required: true, message: t('Please enter your last name') },
            ]}
          >
            <Input
              placeholder={t('Last name')}
              autoComplete="family-name"
              data-test="last-name-input"
            />
          </Form.Item>
          <Form.Item<RegisterForm>
            label={t('Email')}
            name="email"
            rules={[
              { required: true, message: t('Please enter your email') },
              { type: 'email', message: t('Please enter a valid email') },
            ]}
          >
            <Input
              placeholder={t('Email')}
              autoComplete="email"
              data-test="email-input"
            />
          </Form.Item>
          <Form.Item<RegisterForm>
            label={t('Password')}
            name="password"
            rules={[
              { required: true, message: t('Please enter your password') },
            ]}
          >
            <Input.Password
              placeholder={t('Password')}
              autoComplete="new-password"
              data-test="password-input"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label={t('Confirm password')}
            dependencies={['password']}
            hasFeedback
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
                    new Error(
                      t('The two passwords that you entered do not match!'),
                    ),
                  );
                },
              }),
            ]}
          >
            <Input.Password
              placeholder={t('Confirm password')}
              data-test="confirm-password-input"
            />
          </Form.Item>
          {authRecaptchaPublicKey && (
            <Form.Item label="Captcha">
              <ReactCAPTCHA
                sitekey={authRecaptchaPublicKey}
                onChange={value => {
                  setCaptchaResponse(value);
                }}
                data-test="captcha-input"
              />
            </Form.Item>
          )}
          <Form.Item>
            <Button
              block
              type="default"
              htmlType="submit"
              loading={loading}
              data-test="register-button"
            >
              {t('Register')}
            </Button>
          </Form.Item>
        </Form>
      </StyledCard>
    </Flex>
  );
}
