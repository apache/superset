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

import { useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { Input, Collapse, Form, FormItem } from '@superset-ui/core/components';
import { CustomParametersChangeType, FieldPropTypes } from '../../types';

const LABELS = {
  USERNAME: t('Username'),
  PASSWORD: t('Password'),
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
      // On edit this is the backend's mask. It is posted back verbatim and
      // `unmask_encrypted_extra` restores the stored password.
      password: credentials?.password || '',
    };
  };

  const [embeddedCredentials, setEmbeddedCredentials] =
    useState<EmbeddedCredentials>(deriveEmbeddedCredentials);

  useEffect(() => {
    setEmbeddedCredentials(deriveEmbeddedCredentials());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync only when
    // the stored blob changes, mirroring OAuth2ClientField.
  }, [db?.masked_encrypted_extra]);

  const handleChange = (key: keyof EmbeddedCredentials) => (e: any) => {
    const updated = {
      ...embeddedCredentials,
      [key]: e.target.value,
    };

    setEmbeddedCredentials(updated);

    const event: CustomParametersChangeType = {
      target: {
        type: 'object',
        name: 'embedded_credentials',
        value: updated,
      },
    };
    changeMethods.onParametersChange(event);
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
              <FormItem label={LABELS.PASSWORD}>
                <Input
                  data-test="embedded-credentials-password"
                  type="password"
                  value={embeddedCredentials.password}
                  onChange={handleChange('password')}
                />
              </FormItem>
            </Form>
          ),
        },
      ]}
    />
  );
};

export default EmbeddedCredentialsField;
