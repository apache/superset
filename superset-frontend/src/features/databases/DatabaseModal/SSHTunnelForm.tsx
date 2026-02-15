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
import { t } from '@apache-superset/core';
import { JsonObject } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import {
  Form,
  FormLabel,
  Col,
  Row,
  LabeledErrorBoundInput,
} from '@superset-ui/core/components';
import { Input } from '@superset-ui/core/components/Input';
import { Radio } from '@superset-ui/core/components/Radio';
import { DatabaseObject, CustomEventHandlerType } from '../types';
import { AuthType } from '.';

const StyledDiv = styled.div`
  padding-top: ${({ theme }) => theme.sizeUnit * 2}px;
  label {
    color: ${({ theme }) => theme.colorText};
    margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  }
`;

const StyledRow = styled(Row)`
  padding-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const StyledFormItem = styled(Form.Item)`
  margin-bottom: 0 !important;
`;

interface SSHTunnelFormProps {
  db: DatabaseObject | null;
  onSSHTunnelParametersChange: CustomEventHandlerType;
  setSSHTunnelLoginMethod: (method: AuthType) => void;
  isValidating?: boolean;
  validationErrors?: JsonObject | null;
  getValidation: () => void;
}

const SSHTunnelForm = ({
  db,
  onSSHTunnelParametersChange,
  setSSHTunnelLoginMethod,
  isValidating = false,
  validationErrors,
  getValidation,
}: SSHTunnelFormProps) => {
  const [usePassword, setUsePassword] = useState<AuthType>(AuthType.Password);
  const sshErrors = validationErrors?.ssh_tunnel || {};

  return (
    <Form>
      <StyledRow gutter={16}>
        <Col xs={24} md={12}>
          <StyledDiv>
            <LabeledErrorBoundInput
              id="server_address"
              name="server_address"
              label={t('SSH Host')}
              required
              placeholder={t('e.g. 127.0.0.1')}
              value={db?.ssh_tunnel?.server_address || ''}
              onChange={onSSHTunnelParametersChange}
              validationMethods={{ onBlur: getValidation }}
              errorMessage={sshErrors?.server_address}
              isValidating={isValidating}
              data-test="ssh-tunnel-server_address-input"
            />
          </StyledDiv>
        </Col>
        <Col xs={24} md={12}>
          <StyledDiv>
            <LabeledErrorBoundInput
              id="server_port"
              name="server_port"
              label={t('SSH Port')}
              required
              placeholder={t('22')}
              type="number"
              value={db?.ssh_tunnel?.server_port}
              onChange={onSSHTunnelParametersChange}
              validationMethods={{ onBlur: getValidation }}
              errorMessage={sshErrors?.server_port}
              isValidating={isValidating}
              data-test="ssh-tunnel-server_port-input"
            />
          </StyledDiv>
        </Col>
      </StyledRow>
      <StyledRow gutter={16}>
        <Col xs={24}>
          <StyledDiv>
            <LabeledErrorBoundInput
              id="username"
              name="username"
              label={t('Username')}
              required
              placeholder={t('e.g. Analytics')}
              value={db?.ssh_tunnel?.username || ''}
              onChange={onSSHTunnelParametersChange}
              validationMethods={{ onBlur: getValidation }}
              errorMessage={sshErrors?.username}
              isValidating={isValidating}
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
              <LabeledErrorBoundInput
                id="password"
                name="password"
                label={t('SSH Password')}
                required
                visibilityToggle
                placeholder={t('e.g. ********')}
                value={db?.ssh_tunnel?.password || ''}
                onChange={onSSHTunnelParametersChange}
                validationMethods={{ onBlur: getValidation }}
                errorMessage={sshErrors?.password}
                isValidating={isValidating}
                data-test="ssh-tunnel-password-input"
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
                <StyledFormItem
                  validateStatus={
                    isValidating
                      ? 'validating'
                      : sshErrors?.private_key
                        ? 'error'
                        : 'success'
                  }
                  help={sshErrors?.private_key}
                  hasFeedback={isValidating || !!sshErrors?.private_key}
                >
                  <Input.TextArea
                    name="private_key"
                    placeholder={t('Paste Private Key here')}
                    value={db?.ssh_tunnel?.private_key || ''}
                    onChange={onSSHTunnelParametersChange}
                    onBlur={getValidation}
                    data-test="ssh-tunnel-private_key-input"
                    rows={4}
                  />
                </StyledFormItem>
              </StyledDiv>
            </Col>
          </StyledRow>
          <StyledRow gutter={16}>
            <Col xs={24}>
              <StyledDiv>
                <LabeledErrorBoundInput
                  id="private_key_password"
                  name="private_key_password"
                  label={t('Private Key Password')}
                  required
                  visibilityToggle
                  placeholder={t('e.g. ********')}
                  value={db?.ssh_tunnel?.private_key_password || ''}
                  onChange={onSSHTunnelParametersChange}
                  validationMethods={{ onBlur: getValidation }}
                  errorMessage={sshErrors?.private_key_password}
                  isValidating={isValidating}
                  data-test="ssh-tunnel-private_key_password-input"
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
