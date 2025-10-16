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
  Typography,
  Icons,
} from '@superset-ui/core/components';
import { useState, useMemo } from 'react';
import { capitalize } from 'lodash/fp';
import getBootstrapData from 'src/utils/getBootstrapData';

type OAuthProvider = {
  name: string;
  icon: string;
};

type OIDProvider = {
  name: string;
  url: string;
};

type Provider = OAuthProvider | OIDProvider;

interface LoginForm {
  username: string;
  password: string;
}

enum AuthType {
  AuthOID = 0,
  AuthDB = 1,
  AuthLDAP = 2,
  AuthOauth = 4,
}

const StyledCard = styled(Card)`
  ${({ theme }) => css`
    max-width: 400px;
    width: 100%;
    margin-top: ${theme.marginXL}px;
    color: ${theme.colorBgContainer};
    background: ${theme.colorBgBase};
    .ant-form-item-label label {
      color: ${theme.colorPrimary};
    }
  `}
`;

const StyledLabel = styled(Typography.Text)`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSM}px;
  `}
`;

export default function Login() {
  const [form] = Form.useForm<LoginForm>();
  const [loading, setLoading] = useState(false);

  const bootstrapData = getBootstrapData();
  const nextUrl = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('next') || '';
    } catch (_error) {
      return '';
    }
  }, []);

  const loginEndpoint = useMemo(
    () => (nextUrl ? `/login/?next=${encodeURIComponent(nextUrl)}` : '/login/'),
    [nextUrl],
  );

  const buildProviderLoginUrl = (providerName: string) => {
    const base = `/login/${providerName}`;
    return nextUrl
      ? `${base}${base.includes('?') ? '&' : '?'}next=${encodeURIComponent(nextUrl)}`
      : base;
  };

  const authType: AuthType = bootstrapData.common.conf.AUTH_TYPE;
  const providers: Provider[] = bootstrapData.common.conf.AUTH_PROVIDERS;
  const authRegistration: boolean =
    bootstrapData.common.conf.AUTH_USER_REGISTRATION;

  const onFinish = (values: LoginForm) => {
    setLoading(true);
    SupersetClient.postForm(loginEndpoint, values, '').finally(() => {
      setLoading(false);
    });
  };

  const getAuthIconElement = (
    providerName: string,
  ): React.JSX.Element | undefined => {
    if (!providerName || typeof providerName !== 'string') {
      return undefined;
    }
    const iconComponentName = `${capitalize(providerName)}Outlined`;
    const IconComponent = (Icons as Record<string, React.ComponentType<any>>)[
      iconComponentName
    ];

    if (IconComponent && typeof IconComponent === 'function') {
      return <IconComponent />;
    }
    return undefined;
  };

  return (
    <Flex
      justify="center"
      align="center"
      data-test="login-form"
      css={css`
        width: 100%;
        height: calc(100vh - 200px);
      `}
    >
      <StyledCard title={t('Sign in')} padded>
        {authType === AuthType.AuthOID && (
          <Flex justify="center" vertical gap="middle">
            <Form layout="vertical" requiredMark="optional" form={form}>
              {providers.map((provider: OIDProvider) => (
                <Form.Item<LoginForm>>
                  <Button
                    href={buildProviderLoginUrl(provider.name)}
                    block
                    iconPosition="start"
                    icon={getAuthIconElement(provider.name)}
                  >
                    {t('Sign in with')} {capitalize(provider.name)}
                  </Button>
                </Form.Item>
              ))}
            </Form>
          </Flex>
        )}
        {authType === AuthType.AuthOauth && (
          <Flex justify="center" gap={0} vertical>
            <Form layout="vertical" requiredMark="optional" form={form}>
              {providers.map((provider: OAuthProvider) => (
                <Form.Item<LoginForm>>
                  <Button
                    href={buildProviderLoginUrl(provider.name)}
                    block
                    iconPosition="start"
                    icon={getAuthIconElement(provider.name)}
                  >
                    {t('Sign in with')} {capitalize(provider.name)}
                  </Button>
                </Form.Item>
              ))}
            </Form>
          </Flex>
        )}

        {(authType === AuthType.AuthDB || authType === AuthType.AuthLDAP) && (
          <Flex justify="center" vertical gap="middle">
            <Typography.Text type="secondary">
              {t('Enter your login and password below:')}
            </Typography.Text>
            <Form
              layout="vertical"
              requiredMark="optional"
              form={form}
              onFinish={onFinish}
            >
              <Form.Item<LoginForm>
                label={<StyledLabel>{t('Username:')}</StyledLabel>}
                name="username"
                rules={[
                  { required: true, message: t('Please enter your username') },
                ]}
              >
                <Input
                  autoFocus
                  prefix={<Icons.UserOutlined iconSize="l" />}
                  data-test="username-input"
                />
              </Form.Item>
              <Form.Item<LoginForm>
                label={<StyledLabel>{t('Password:')}</StyledLabel>}
                name="password"
                rules={[
                  { required: true, message: t('Please enter your password') },
                ]}
              >
                <Input.Password
                  prefix={<Icons.KeyOutlined iconSize="l" />}
                  data-test="password-input"
                />
              </Form.Item>
              <Form.Item label={null}>
                <Flex
                  css={css`
                    width: 100%;
                  `}
                >
                  <Button
                    block
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    data-test="login-button"
                  >
                    {t('Sign in')}
                  </Button>
                  {authRegistration && (
                    <Button
                      block
                      type="default"
                      href="/register/"
                      data-test="register-button"
                    >
                      {t('Register')}
                    </Button>
                  )}
                </Flex>
              </Form.Item>
            </Form>
          </Flex>
        )}
      </StyledCard>
    </Flex>
  );
}
