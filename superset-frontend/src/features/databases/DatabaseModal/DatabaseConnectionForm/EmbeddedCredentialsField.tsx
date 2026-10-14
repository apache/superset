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

import { ChangeEvent, useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { Input, Collapse, Form, FormItem } from '@superset-ui/core/components';
import { Radio } from '@superset-ui/core/components/Radio';
import { CustomParametersChangeType, FieldPropTypes } from '../../types';

const LABELS = {
  USERNAME: t('Username'),
  PASSWORD: t('Password'),
  PRIVATE_KEY: t('Private key (PEM)'),
  PRIVATE_KEY_PASSPHRASE: t('Private key passphrase (optional)'),
};

// Stated here rather than only in the docs: an admin who reads this as a
// general-purpose fallback has made a security mistake.
const HELP_TEXT = t(
  'Used only when a dashboard is viewed through an embedded guest token. ' +
    'Every embedded viewer of this connection queries as this one user, so it ' +
    'should be a dedicated account with the narrowest access those dashboards ' +
    'need. Logged-in users are unaffected and continue to authenticate ' +
    'individually via OAuth2.',
);

interface EmbeddedCredentials {
  username: string;
  password: string;
  auth_method: 'password' | 'keypair';
  privatekey_body: string;
  privatekey_pass: string;
}

export const EmbeddedCredentialsField = ({
  changeMethods,
  db,
}: FieldPropTypes) => {
  const deriveEmbeddedCredentials = (): EmbeddedCredentials => {
    // `masked_encrypted_extra` is backend-supplied and historically sometimes
    // the string "null" -- JSON.parse('null') returns null, and malformed JSON
    // throws. Defend against both so one bad value cannot crash the modal.
    let parsed: unknown;
    try {
      parsed = JSON.parse(db?.masked_encrypted_extra || '{}');
    } catch (e) {
      // Only swallow JSON.parse's own SyntaxError; let real programmer errors
      // through.
      if (!(e instanceof SyntaxError)) throw e;
      parsed = {};
    }

    const encryptedExtra =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as { embedded_credentials?: Partial<EmbeddedCredentials> })
        : {};
    const credentials = encryptedExtra.embedded_credentials;

    return {
      username: credentials?.username || '',
      auth_method:
        credentials?.auth_method === 'keypair' ? 'keypair' : 'password',
      // On edit this is the backend's mask. It is posted back verbatim and
      // `unmask_encrypted_extra` restores the stored secrets.
      password: credentials?.password || '',
      privatekey_body: credentials?.privatekey_body || '',
      privatekey_pass: credentials?.privatekey_pass || '',
    };
  };

  const [embeddedCredentials, setEmbeddedCredentials] =
    useState<EmbeddedCredentials>(deriveEmbeddedCredentials);

  useEffect(() => {
    setEmbeddedCredentials(deriveEmbeddedCredentials());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync only when
    // the stored blob changes, mirroring OAuth2ClientField.
  }, [db?.masked_encrypted_extra]);

  const updateCredentials = (updated: EmbeddedCredentials) => {
    setEmbeddedCredentials(updated);

    const selectedCredentials =
      updated.auth_method === 'keypair'
        ? {
            username: updated.username,
            auth_method: updated.auth_method,
            privatekey_body: updated.privatekey_body,
            ...(updated.privatekey_pass && {
              privatekey_pass: updated.privatekey_pass,
            }),
          }
        : {
            username: updated.username,
            auth_method: updated.auth_method,
            password: updated.password,
          };
    const event: CustomParametersChangeType = {
      target: {
        type: 'object',
        name: 'embedded_credentials',
        value: selectedCredentials,
      },
    };
    changeMethods.onParametersChange(event);
  };

  const handleChange =
    (key: 'username' | 'password' | 'privatekey_body' | 'privatekey_pass') =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const updated = {
        ...embeddedCredentials,
        [key]: e.target.value,
      };
      updateCredentials(updated);
    };

  return (
    <Collapse
      items={[
        {
          key: 'embedded-credentials',
          label: t('Embedded guest credentials'),
          children: (
            <Form layout="vertical">
              <FormItem label={LABELS.USERNAME} help={HELP_TEXT}>
                <Input
                  data-test="embedded-credentials-username"
                  value={embeddedCredentials.username}
                  onChange={handleChange('username')}
                />
              </FormItem>
              <FormItem label={t('Authentication method')}>
                <Radio.Group
                  value={embeddedCredentials.auth_method}
                  onChange={({ target: { value } }) =>
                    updateCredentials({
                      ...embeddedCredentials,
                      auth_method: value,
                    })
                  }
                >
                  <Radio value="password">{t('Password')}</Radio>
                  <Radio value="keypair">{t('Key pair')}</Radio>
                </Radio.Group>
              </FormItem>
              {embeddedCredentials.auth_method === 'keypair' ? (
                <>
                  <FormItem label={LABELS.PRIVATE_KEY}>
                    <Input.TextArea
                      data-test="embedded-credentials-private-key"
                      value={embeddedCredentials.privatekey_body}
                      onChange={handleChange('privatekey_body')}
                    />
                  </FormItem>
                  <FormItem label={LABELS.PRIVATE_KEY_PASSPHRASE}>
                    <Input
                      data-test="embedded-credentials-key-passphrase"
                      type="password"
                      value={embeddedCredentials.privatekey_pass}
                      onChange={handleChange('privatekey_pass')}
                    />
                  </FormItem>
                </>
              ) : (
                <FormItem label={LABELS.PASSWORD}>
                  <Input
                    data-test="embedded-credentials-password"
                    type="password"
                    value={embeddedCredentials.password}
                    onChange={handleChange('password')}
                  />
                </FormItem>
              )}
            </Form>
          ),
        },
      ]}
    />
  );
};

export default EmbeddedCredentialsField;
