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
import {
  CustomParametersChangeType,
  Engines,
  FieldPropTypes,
} from '../../types';

const LABELS = {
  CLIENT_ID: t('Client ID'),
  SECRET: t('Client Secret'),
  AUTH_URI: t('Authorization Request URI'),
  TOKEN_URI: t('Token Request URI'),
  SCOPE: t('Scope'),
};

interface OAuth2ClientInfo {
  id: string;
  secret: string;
  authorization_request_uri: string;
  token_request_uri: string;
  scope: string;
}

/**
 * Coerce a backend- or form-supplied value to a plain object.
 *
 * `masked_encrypted_extra` and the `parameters.*` entries arrive either as an
 * object or as a JSON string -- the save-time merge in `DatabaseModal`
 * re-serializes `parameters.*` in place -- and `masked_encrypted_extra` has
 * historically been the literal string "null". `JSON.parse('null')` returns
 * null and malformed JSON throws, so both are absorbed here.
 */
const asObject = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value || '{}');
    } catch (e) {
      // Only swallow JSON.parse's own SyntaxError; let real programmer errors
      // (RangeError, TypeError from a broken stub, etc.) propagate.
      if (!(e instanceof SyntaxError)) throw e;
      return {};
    }
    return asObject(parsed);
  }

  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

export const OAuth2ClientField = ({
  changeMethods,
  db,
  default_value: defaultValue,
  isPublic = true,
}: FieldPropTypes) => {
  const deriveOauth2ClientInfo = (): OAuth2ClientInfo => {
    // The in-flight form value wins over the stored blob. Switching the
    // configuration method to SQLAlchemy URI and back re-mounts this field
    // while `parameters.oauth2_client_info` still holds what was typed;
    // seeding from `masked_encrypted_extra` alone would show empty inputs for
    // a client the save payload would nonetheless carry.
    const typed = asObject(db?.parameters?.oauth2_client_info);
    const stored = asObject(
      asObject(db?.masked_encrypted_extra).oauth2_client_info,
    );
    const info: Partial<OAuth2ClientInfo> = (
      Object.keys(typed).length ? typed : stored
    ) as Partial<OAuth2ClientInfo>;

    return {
      id: info.id || '',
      secret: info.secret || '',
      authorization_request_uri:
        info.authorization_request_uri ??
        defaultValue?.authorization_request_uri ??
        '',
      token_request_uri:
        info.token_request_uri ?? defaultValue?.token_request_uri ?? '',
      scope: info.scope ?? defaultValue?.scope ?? '',
    };
  };

  const [oauth2ClientInfo, setOauth2ClientInfo] = useState<OAuth2ClientInfo>(
    deriveOauth2ClientInfo,
  );

  // Serialized so the effect below keys off the *value*: the reducer hands back
  // a fresh object on every keystroke, which as a raw dependency would re-sync
  // state with itself on each one.
  const typedClientInfo = JSON.stringify(
    db?.parameters?.oauth2_client_info ?? null,
  );

  // Re-sync local state when either source changes (e.g., when the gsheets
  // dropdown toggles back to private after we cleared stored creds).
  useEffect(() => {
    setOauth2ClientInfo(deriveOauth2ClientInfo());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `defaultValue` is a
    // static per-engine default that doesn't change after the form opens;
    // depending on it would cause spurious re-syncs when the parent re-renders.
  }, [db?.masked_encrypted_extra, typedClientInfo]);

  if (db?.engine === Engines.GSheet && isPublic) {
    return null;
  }

  const handleChange =
    (key: keyof OAuth2ClientInfo) => (e: ChangeEvent<HTMLInputElement>) => {
      const updatedInfo = {
        ...oauth2ClientInfo,
        [key]: e.target.value,
      };

      setOauth2ClientInfo(updatedInfo);

      const event: CustomParametersChangeType = {
        target: {
          type: 'object',
          name: 'oauth2_client_info',
          value: updatedInfo,
        },
      };
      changeMethods.onParametersChange(event);
    };

  return (
    <Collapse
      items={[
        {
          key: 'oauth2-client-information',
          label: t('OAuth2 client information'),
          children: (
            <Form layout="vertical">
              <FormItem label={LABELS.CLIENT_ID}>
                <Input
                  data-test="client-id"
                  value={oauth2ClientInfo.id}
                  onChange={handleChange('id')}
                />
              </FormItem>
              <FormItem label={LABELS.SECRET}>
                <Input
                  data-test="client-secret"
                  type="password"
                  value={oauth2ClientInfo.secret}
                  onChange={handleChange('secret')}
                />
              </FormItem>
              <FormItem label={LABELS.AUTH_URI}>
                <Input
                  data-test="client-authorization-request-uri"
                  placeholder="https://"
                  value={oauth2ClientInfo.authorization_request_uri}
                  onChange={handleChange('authorization_request_uri')}
                />
              </FormItem>
              <FormItem label={LABELS.TOKEN_URI}>
                <Input
                  data-test="client-token-request-uri"
                  placeholder="https://"
                  value={oauth2ClientInfo.token_request_uri}
                  onChange={handleChange('token_request_uri')}
                />
              </FormItem>
              <FormItem
                label={LABELS.SCOPE}
                help={
                  db?.engine === Engines.Snowflake
                    ? t(
                        'Enter the scopes allowed by your Snowflake integration, ' +
                          'for example session:role:ANALYST refresh_token. ' +
                          "Without a role scope, Snowflake uses the user's default role.",
                      )
                    : undefined
                }
              >
                <Input
                  data-test="client-scope"
                  value={oauth2ClientInfo.scope}
                  onChange={handleChange('scope')}
                />
              </FormItem>
            </Form>
          ),
        },
      ]}
    />
  );
};
