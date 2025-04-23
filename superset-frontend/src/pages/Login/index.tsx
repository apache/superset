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
import { Button, Card, Flex, Form, Input } from 'src/components';
import { Icons } from 'src/components/Icons';
import Typography from 'src/components/Typography';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';

type LoginType = {
  username: string;
  password: string;
};

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

interface LoginForm {
  username: string;
  password: string;
}

export default function Login() {
  const [form] = Form.useForm<LoginForm>();
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  // Parse the query string to get the 'next' parameter
  const queryParams = new URLSearchParams(location.search);
  const nextUrl = queryParams.get('next') || '/superset/welcome/';

  const onFinish = (values: LoginType) => {
    setLoading(true);
    SupersetClient.postForm('/login/', values, '').then(response => {
      setLoading(false);
      console.log('Login response:', response);
      window.location.href = nextUrl;
    });
  };

  return (
    <LoginContainer justify="center">
      <StyledCard title={t('Sign in')} padded variant="borderless">
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
              <Button block type="primary" htmlType="submit" loading={loading}>
                {t('Sign in')}
              </Button>
            </Form.Item>
          </Form>
        </Flex>
      </StyledCard>
    </LoginContainer>
  );
}
