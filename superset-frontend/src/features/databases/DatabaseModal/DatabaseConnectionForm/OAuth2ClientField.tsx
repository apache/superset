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

import Collapse from 'src/components/Collapse';
import { Input } from 'src/components/Input';
import { FormItem } from 'src/components/Form';
import { FieldPropTypes } from '../../types';

interface OAuth2ClientInfo {
  id: string;
  secret: string;
  authorization_request_uri: string;
  token_request_uri: string;
  scope: string;
}

export const OAuth2ClientField = ({ changeMethods, db }: FieldPropTypes) => {
  const encryptedExtra = JSON.parse(db?.masked_encrypted_extra || '{}');
  const [oauth2ClientInfo, setOauth2ClientInfo] = useState<OAuth2ClientInfo>({
    id: encryptedExtra.oauth2_client_info?.id || '',
    secret: encryptedExtra.oauth2_client_info?.secret || '',
    authorization_request_uri:
      encryptedExtra.oauth2_client_info?.authorization_request_uri || '',
    token_request_uri:
      encryptedExtra.oauth2_client_info?.token_request_uri || '',
    scope: encryptedExtra.oauth2_client_info?.scope || '',
  });

  if (db?.engine_information?.supports_oauth2 !== true) {
    return null;
  }

  const handleChange = (key: any) => (e: any) => {
    const updatedInfo = {
      ...oauth2ClientInfo,
      [key]: e.target.value,
    };

    setOauth2ClientInfo(updatedInfo);

    const event = {
      target: {
        name: 'oauth2_client_info',
        value: updatedInfo,
      },
    };
    changeMethods.onEncryptedExtraInputChange(event);
  };

  return (
    <Collapse>
      <Collapse.Panel header="OAuth2 client information" key="1">
        <FormItem label="Client ID">
          <Input
            data-test="client-id"
            value={oauth2ClientInfo.id}
            onChange={handleChange('id')}
          />
        </FormItem>
        <FormItem label="Client Secret">
          <Input
            data-test="client-secret"
            type="password"
            value={oauth2ClientInfo.secret}
            onChange={handleChange('secret')}
          />
        </FormItem>
        <FormItem label="Authorization Request URI">
          <Input
            data-test="client-authorization-request-uri"
            placeholder="https://"
            value={oauth2ClientInfo.authorization_request_uri}
            onChange={handleChange('authorization_request_uri')}
          />
        </FormItem>
        <FormItem label="Token Request URI">
          <Input
            data-test="client-token-request-uri"
            placeholder="https://"
            value={oauth2ClientInfo.token_request_uri}
            onChange={handleChange('token_request_uri')}
          />
        </FormItem>
        <FormItem label="Scope">
          <Input
            data-test="client-scope"
            value={oauth2ClientInfo.scope}
            onChange={handleChange('scope')}
          />
        </FormItem>
      </Collapse.Panel>
    </Collapse>
  );
};
