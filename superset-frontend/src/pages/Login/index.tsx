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

import { SupersetClient, styled, t, css, useTheme } from '@superset-ui/core';
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  Typography,
  Icons,
} from '@superset-ui/core/components';
import { useState } from 'react';
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

const StyledBackground = styled.div`
  ${({ theme }) => {
    const bgImageUrl = theme.loginPageBackgroundImageUrl;
    const overlayColor =
      theme.loginPageBackgroundOverlayColor || 'rgba(0, 0, 0, 0.5)';
    return bgImageUrl
      ? css`
          background-image: url(${bgImageUrl});
          background-size: cover;
          background-position: center;
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          &::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: ${overlayColor};
          }
        `
      : '';
  }}
`;

const StyledBrandLogo = styled.img`
  display: block;
  max-width: 160px;
  max-height: 64px;
  margin: 0;
  object-fit: contain;
`;

export default function Login() {
  const theme = useTheme();

  const [form] = Form.useForm<LoginForm>();
  const [loading, setLoading] = useState(false);

  const bootstrapData = getBootstrapData();

  const authType: AuthType = bootstrapData.common.conf.AUTH_TYPE;
  const providers: Provider[] = bootstrapData.common.conf.AUTH_PROVIDERS;
  const authRegistration: boolean =
    bootstrapData.common.conf.AUTH_USER_REGISTRATION;

  const onFinish = (values: LoginForm) => {
    setLoading(true);
    SupersetClient.postForm('/login/', values, '').finally(() => {
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
    <>
      <StyledBackground />
      <Flex
        justify="center"
        align="center"
        data-test="login-form"
        css={css`
          width: 100%;
          height: calc(100vh - 200px);
        `}
      >
        <StyledCard
          padded
          title={
            <Flex vertical align="start" gap="middle">
              {theme.loginFormBrandLogoUrl && (
                <StyledBrandLogo
                  src={theme.loginFormBrandLogoUrl}
                  alt={theme.brandLogoAlt || 'Apache Superset'}
                  style={{ marginTop: theme.sizeUnit * 4 }}
                />
              )}
              <Typography.Title
                level={4}
                style={{
                  marginTop: 0,
                  marginBottom: theme.loginFormBrandLogoUrl
                    ? theme.sizeUnit * 2
                    : 0,
                  marginLeft: 0,
                  marginRight: 0,
                }}
              >
                {t('Sign in')}
              </Typography.Title>
            </Flex>
          }
        >
          {authType === AuthType.AuthOauth && (
            <Flex justify="center" gap={0} vertical>
              <Form layout="vertical" requiredMark="optional" form={form}>
                {providers.map((provider: OAuthProvider) => (
                  <Form.Item<LoginForm>>
                    <Button
                      href={`/login/${provider.name}`}
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
                    {
                      required: true,
                      message: t('Please enter your username'),
                    },
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
                    {
                      required: true,
                      message: t('Please enter your password'),
                    },
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
    </>
  );
}
