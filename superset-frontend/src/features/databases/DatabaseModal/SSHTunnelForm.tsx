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
import { useState } from 'react';
import { t, styled } from '@superset-ui/core';
import { AntdForm, Col, Row } from 'src/components';
import { Form, FormLabel } from 'src/components/Form';
import { Radio } from 'src/components/Radio';
import { Input, TextArea } from 'src/components/Input';
import { Input as AntdInput, Tooltip } from 'antd';
import Icons from 'src/components/Icons';
import { DatabaseObject, FieldPropTypes } from '../types';
import { AuthType } from '.';

const StyledDiv = styled.div`
  padding-top: ${({ theme }) => theme.gridUnit * 2}px;
  label {
    color: ${({ theme }) => theme.colors.grayscale.base};
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  }
`;

const StyledRow = styled(Row)`
  padding-bottom: ${({ theme }) => theme.gridUnit * 2}px;
`;

const StyledFormItem = styled(AntdForm.Item)`
  margin-bottom: 0 !important;
`;

const StyledInputPassword = styled(AntdInput.Password)`
  margin: ${({ theme }) => `${theme.gridUnit}px 0 ${theme.gridUnit * 2}px`};
`;

const SSHTunnelForm = ({
  db,
  onSSHTunnelParametersChange,
  setSSHTunnelLoginMethod,
}: {
  db: DatabaseObject | null;
  onSSHTunnelParametersChange: FieldPropTypes['changeMethods']['onSSHTunnelParametersChange'];
  setSSHTunnelLoginMethod: (method: AuthType) => void;
}) => {
  const [usePassword, setUsePassword] = useState<AuthType>(AuthType.Password);

  return (
    <Form>
      <StyledRow gutter={16}>
        <Col xs={24} md={12}>
          <StyledDiv>
            <FormLabel htmlFor="server_address" required>
              {t('SSH Host')}
            </FormLabel>
            <Input
              name="server_address"
              type="text"
              placeholder={t('e.g. 127.0.0.1')}
              value={db?.ssh_tunnel?.server_address || ''}
              onChange={onSSHTunnelParametersChange}
              data-test="ssh-tunnel-server_address-input"
            />
          </StyledDiv>
        </Col>
        <Col xs={24} md={12}>
          <StyledDiv>
            <FormLabel htmlFor="server_port" required>
              {t('SSH Port')}
            </FormLabel>
            <Input
              name="server_port"
              placeholder={t('22')}
              type="number"
              value={db?.ssh_tunnel?.server_port}
              onChange={onSSHTunnelParametersChange}
              data-test="ssh-tunnel-server_port-input"
            />
          </StyledDiv>
        </Col>
      </StyledRow>
      <StyledRow gutter={16}>
        <Col xs={24}>
          <StyledDiv>
            <FormLabel htmlFor="username" required>
              {t('Username')}
            </FormLabel>
            <Input
              name="username"
              type="text"
              placeholder={t('e.g. Analytics')}
              value={db?.ssh_tunnel?.username || ''}
              onChange={onSSHTunnelParametersChange}
              data-test="ssh-tunnel-username-input"
            />
          </StyledDiv>
        </Col>
      </StyledRow>
      <StyledRow gutter={16}>
        <Col xs={24}>
          <StyledDiv>
            <FormLabel htmlFor="use_password" required>
              {t('Login with')}
            </FormLabel>
            <StyledFormItem name="use_password" initialValue={usePassword}>
              <Radio.Group
                onChange={({ target: { value } }) => {
                  setUsePassword(value);
                  setSSHTunnelLoginMethod(value);
                }}
              >
                <Radio
                  value={AuthType.Password}
                  data-test="ssh-tunnel-use_password-radio"
                >
                  {t('Password')}
                </Radio>
                <Radio
                  value={AuthType.PrivateKey}
                  data-test="ssh-tunnel-use_private_key-radio"
                >
                  {t('Private Key & Password')}
                </Radio>
              </Radio.Group>
            </StyledFormItem>
          </StyledDiv>
        </Col>
      </StyledRow>
      {usePassword === AuthType.Password && (
        <StyledRow gutter={16}>
          <Col xs={24}>
            <StyledDiv>
              <FormLabel htmlFor="password" required>
                {t('SSH Password')}
              </FormLabel>
              <StyledInputPassword
                name="password"
                placeholder={t('e.g. ********')}
                value={db?.ssh_tunnel?.password || ''}
                onChange={onSSHTunnelParametersChange}
                data-test="ssh-tunnel-password-input"
                iconRender={visible =>
                  visible ? (
                    <Tooltip title="Hide password.">
                      <Icons.EyeInvisibleOutlined />
                    </Tooltip>
                  ) : (
                    <Tooltip title="Show password.">
                      <Icons.EyeOutlined />
                    </Tooltip>
                  )
                }
                role="textbox"
              />
            </StyledDiv>
          </Col>
        </StyledRow>
      )}
      {usePassword === AuthType.PrivateKey && (
        <>
          <StyledRow gutter={16}>
            <Col xs={24}>
              <StyledDiv>
                <FormLabel htmlFor="private_key" required>
                  {t('Private Key')}
                </FormLabel>
                <TextArea
                  name="private_key"
                  placeholder={t('Paste Private Key here')}
                  value={db?.ssh_tunnel?.private_key || ''}
                  onChange={onSSHTunnelParametersChange}
                  data-test="ssh-tunnel-private_key-input"
                  rows={4}
                />
              </StyledDiv>
            </Col>
          </StyledRow>
          <StyledRow gutter={16}>
            <Col xs={24}>
              <StyledDiv>
                <FormLabel htmlFor="private_key_password" required>
                  {t('Private Key Password')}
                </FormLabel>
                <StyledInputPassword
                  name="private_key_password"
                  placeholder={t('e.g. ********')}
                  value={db?.ssh_tunnel?.private_key_password || ''}
                  onChange={onSSHTunnelParametersChange}
                  data-test="ssh-tunnel-private_key_password-input"
                  iconRender={visible =>
                    visible ? (
                      <Tooltip title="Hide password.">
                        <Icons.EyeInvisibleOutlined />
                      </Tooltip>
                    ) : (
                      <Tooltip title="Show password.">
                        <Icons.EyeOutlined />
                      </Tooltip>
                    )
                  }
                  role="textbox"
                />
              </StyledDiv>
            </Col>
          </StyledRow>
        </>
      )}
    </Form>
  );
};
export default SSHTunnelForm;
