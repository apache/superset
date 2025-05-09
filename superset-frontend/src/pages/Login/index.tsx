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

import { css } from '@emotion/react';
import { SupersetClient, styled, t } from '@superset-ui/core';
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  Typography,
  Icons,
} from 'src/components';
import { useState } from 'react';
import getBootstrapData from 'src/utils/getBootstrapData';

type LoginType = {
  username: string;
  password: string;
};

type OauthProvider = {
  name: string;
  icon: string;
};

interface LoginForm {
  username: string;
  password: string;
}

enum AuthType {
  AuthDB = 1,
  AuthLDAP,
  AuthRemoteUser,
  AuthOauth,
  AuthOID,
}

const LoginContainer = styled(Flex)`
  width: 100%;
`;

const StyledCard = styled(Card)`
  ${({ theme }) => css`
    width: 40%;
    margin-top: ${theme.marginXL}px;
    background: ${theme.colorBgBase};
    .antd5-form-item-label label {
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

  const authType: AuthType = bootstrapData.common.conf.AUTH_TYPE;
  const oauthProviders: OauthProvider[] =
    bootstrapData.common.conf.OAUTH_PROVIDERS;

  const onFinish = (values: LoginType) => {
    setLoading(true);
    SupersetClient.postForm('/login/', values, '').finally(() => {
      setLoading(false);
    });
  };

  return (
    <LoginContainer justify="center">
      <StyledCard title={t('Sign in')} padded>
        {authType === AuthType.AuthOauth && (
          <Flex justify="center" vertical gap="middle">
            <Form
              layout="vertical"
              requiredMark="optional"
              form={form}
              onFinish={onFinish}
            >
              {oauthProviders.map(provider => (
                <Form.Item<LoginType>>
                  <Typography.Link
                    href={`/login/${provider.name.toLowerCase()}`}
                  >
                    {t('Sign in with')} {provider.name}
                  </Typography.Link>
                </Form.Item>
              ))}
            </Form>
          </Flex>
        )}
        {authType === AuthType.AuthDB && (
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
              <Form.Item<LoginType>
                label={<StyledLabel>{t('Username:')}</StyledLabel>}
                name="username"
                rules={[
                  { required: true, message: t('Please enter your username') },
                ]}
              >
                <Input prefix={<Icons.UserOutlined size={1} />} />
              </Form.Item>
              <Form.Item<LoginType>
                label={<StyledLabel>{t('Password:')}</StyledLabel>}
                name="password"
                rules={[
                  { required: true, message: t('Please enter your password') },
                ]}
              >
                <Input.Password prefix={<Icons.KeyOutlined size={1} />} />
              </Form.Item>
              <Form.Item label={null}>
                <Button
                  block
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                >
                  {t('Sign in')}
                </Button>
              </Form.Item>
            </Form>
          </Flex>
        )}
      </StyledCard>
    </LoginContainer>
  );
}
