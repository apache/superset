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

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  Collapse,
  Flex,
  Form,
  FormItem,
  Input,
  LabeledErrorBoundInput as ValidatedInput,
  Tag,
  Typography,
} from '@superset-ui/core/components';
import { Radio } from '@superset-ui/core/components/Radio';
import {
  CustomParametersChangeType,
  DatabaseObject,
  FieldPropTypes,
} from '../../types';

const PANEL_KEY = 'embedded-credentials';
const FIELD_NAME = 'embedded_credentials';

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

const INACTIVE_REASON = t(
  'Requires OAuth2 client information and “Impersonate logged in user” ' +
    '(Advanced → Security).',
);

interface EmbeddedCredentials {
  username: string;
  password: string;
  auth_method: 'password' | 'keypair';
  privatekey_body: string;
  privatekey_pass: string;
}

/**
 * Coerce a backend- or form-supplied value to a plain object.
 *
 * Both `masked_encrypted_extra` and the `parameters.*` entries arrive either as
 * an object or as a JSON string -- the save-time merge in `DatabaseModal`
 * re-serializes `parameters.*` in place -- and `masked_encrypted_extra` has
 * historically been the literal string "null". `JSON.parse('null')` returns
 * null and malformed JSON throws, so both are absorbed here rather than at each
 * call site.
 */
const asObject = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value || '{}');
    } catch (e) {
      // Only swallow JSON.parse's own SyntaxError; let real programmer errors
      // through.
      if (!(e instanceof SyntaxError)) throw e;
      return {};
    }
    return asObject(parsed);
  }

  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const isNonBlankString = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Does an `oauth2_client_info` block actually configure a client?
 *
 * Mirrors `oauth2_client_info_configured` in `superset/utils/oauth2.py`: some
 * forms save the block with a blank client id and secret, so both must be
 * non-blank. A masked secret counts as set.
 */
export const oauth2ClientInfoConfigured = (clientInfo: unknown): boolean => {
  const client = asObject(clientInfo);
  return isNonBlankString(client.id) && isNonBlankString(client.secret);
};

/**
 * Does this connection have an OAuth2 client configured?
 *
 * The per-connection half is live form state (the admin may be filling the
 * OAuth2 section during setup, so `parameters` is checked ahead of the stored
 * blob); the deployment-wide half -- a client in `DATABASE_OAUTH2_CLIENTS` --
 * is knowable only server-side and arrives through the schema property's
 * `default`.
 */
export const connectionUsesOAuth2 = (
  db?: DatabaseObject,
  defaultValue?: { engine_oauth2_client_configured?: boolean },
): boolean => {
  if (defaultValue?.engine_oauth2_client_configured) {
    return true;
  }

  return (
    oauth2ClientInfoConfigured(db?.parameters?.oauth2_client_info) ||
    oauth2ClientInfoConfigured(
      asObject(db?.masked_encrypted_extra).oauth2_client_info,
    )
  );
};

export const EmbeddedCredentialsField = ({
  changeMethods,
  db,
  default_value: defaultValue,
  getValidation,
  validationErrors,
}: FieldPropTypes) => {
  const deriveEmbeddedCredentials = (
    blankAuthMethod: EmbeddedCredentials['auth_method'] = 'password',
  ): EmbeddedCredentials => {
    // The in-flight form value wins over the stored blob. Switching the
    // configuration method to SQLAlchemy URI and back re-mounts this field
    // while `parameters.embedded_credentials` still holds what was typed;
    // seeding from `masked_encrypted_extra` alone would show empty inputs for
    // a credential the save payload would nonetheless carry.
    const typed = asObject(db?.parameters?.embedded_credentials);
    const stored = asObject(
      asObject(db?.masked_encrypted_extra).embedded_credentials,
    );
    const source = Object.keys(typed).length ? typed : stored;

    return {
      username: asString(source.username),
      auth_method: Object.keys(source).length
        ? source.auth_method === 'keypair'
          ? 'keypair'
          : 'password'
        : blankAuthMethod,
      // On edit these are the backend's masks. They are posted back verbatim
      // and `unmask_encrypted_extra` restores the stored secrets.
      password: asString(source.password),
      privatekey_body: asString(source.privatekey_body),
      privatekey_pass: asString(source.privatekey_pass),
    };
  };

  const [embeddedCredentials, setEmbeddedCredentials] =
    useState<EmbeddedCredentials>(() => deriveEmbeddedCredentials());
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const databaseIdRef = useRef(db?.id);

  // Serialized so the effect below keys off the *value*: the reducer hands back
  // a fresh object on every keystroke, which as a raw dependency would re-sync
  // state with itself on each one.
  const typedCredentials = JSON.stringify(
    db?.parameters?.embedded_credentials ?? null,
  );

  useEffect(() => {
    const databaseChanged = databaseIdRef.current !== db?.id;
    databaseIdRef.current = db?.id;
    // Clearing the parent credential must not reset a blank form's selector.
    setEmbeddedCredentials(previous =>
      deriveEmbeddedCredentials(
        databaseChanged ? 'password' : previous.auth_method,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync only when
    // the connection or one of the two sources changes.
  }, [db?.id, db?.masked_encrypted_extra, typedCredentials]);

  const errorMessage = asString(validationErrors?.embedded_credentials);

  // The panel is collapsed by default, which would hide its own validation
  // error. Open it when one arrives rather than leaving the user with a
  // disabled Connect button and nothing to look at.
  useEffect(() => {
    if (errorMessage) {
      setActiveKeys(keys =>
        keys.includes(PANEL_KEY) ? keys : [...keys, PANEL_KEY],
      );
    }
  }, [errorMessage]);

  // The backend refuses to save a credential unless the connection has an
  // OAuth2 client and impersonation is on, so the fields are only editable
  // then. The section stays visible either way so the requirement is
  // discoverable, and a stored credential can still be removed.
  const isActive =
    connectionUsesOAuth2(db, defaultValue) && !!db?.impersonate_user;
  const isStored =
    FIELD_NAME in asObject(db?.masked_encrypted_extra) ||
    Object.keys(asObject(db?.parameters?.embedded_credentials)).length > 0;

  const clearCredentials = () => {
    // Report "no credential" rather than a shape full of empty strings: the
    // save-time merge treats any object as truthy and would persist it. Clear
    // the in-flight parameter *and* the Secure Extra key, as the gsheets
    // public/private toggle does.
    changeMethods.onParametersChange({
      target: { name: FIELD_NAME, value: '' },
    });
    changeMethods.onClearEncryptedExtraKey(FIELD_NAME);
  };

  const updateCredentials = (updated: EmbeddedCredentials) => {
    setEmbeddedCredentials(updated);

    const isBlank = !(
      updated.username ||
      updated.password ||
      updated.privatekey_body ||
      updated.privatekey_pass
    );

    // `auth_method` alone is not a credential.
    if (isBlank) {
      clearCredentials();
      return;
    }

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
        name: FIELD_NAME,
        value: selectedCredentials,
      },
    };
    changeMethods.onParametersChange(event);
    // Mirror the edit into Secure Extra so the JSON shown under Advanced →
    // Security matches what will be saved.
    changeMethods.onEncryptedExtraInputChange({
      target: { name: FIELD_NAME, value: selectedCredentials },
    });
  };

  const removeCredentials = () => {
    setEmbeddedCredentials(previous => ({
      ...previous,
      username: '',
      password: '',
      privatekey_body: '',
      privatekey_pass: '',
    }));
    clearCredentials();
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

  const isKeypair = embeddedCredentials.auth_method === 'keypair';
  const hasCredential = !!(
    embeddedCredentials.username ||
    embeddedCredentials.password ||
    embeddedCredentials.privatekey_body ||
    embeddedCredentials.privatekey_pass
  );
  const errorStatus = (field: string) =>
    errorMessage && !field ? ('error' as const) : undefined;
  const validationMethods = { onBlur: getValidation };

  return (
    <Collapse
      activeKey={activeKeys}
      onChange={keys => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
      items={[
        {
          key: PANEL_KEY,
          label: (
            <Flex vertical>
              <span>{t('Embedded guest credentials')}</span>
              {!isActive && (
                <Typography.Text
                  type="secondary"
                  data-test="embedded-credentials-inactive-reason"
                >
                  {INACTIVE_REASON}
                </Typography.Text>
              )}
            </Flex>
          ),
          extra: isStored ? (
            <Tag data-test="embedded-credentials-configured">
              {t('Configured')}
            </Tag>
          ) : undefined,
          children: (
            <Form layout="vertical">
              <Typography.Paragraph type="secondary">
                {HELP_TEXT}
              </Typography.Paragraph>
              {errorMessage && (
                <Alert
                  type="error"
                  closable={false}
                  data-test="embedded-credentials-error"
                >
                  {errorMessage}
                </Alert>
              )}
              <ValidatedInput
                id="embedded_credentials_username"
                name="embedded_credentials_username"
                data-test="embedded-credentials-username"
                label={LABELS.USERNAME}
                placeholder={t('e.g. embedded_viewer')}
                autoComplete="off"
                disabled={!isActive}
                value={embeddedCredentials.username}
                validationMethods={validationMethods}
                onChange={handleChange('username')}
              />
              <FormItem label={t('Authentication method')}>
                <Radio.Group
                  disabled={!isActive}
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
              {isKeypair ? (
                <>
                  <FormItem
                    label={LABELS.PRIVATE_KEY}
                    validateStatus={errorStatus(
                      embeddedCredentials.privatekey_body,
                    )}
                  >
                    <Input.TextArea
                      data-test="embedded-credentials-private-key"
                      placeholder={t('-----BEGIN PRIVATE KEY-----')}
                      disabled={!isActive}
                      value={embeddedCredentials.privatekey_body}
                      onChange={handleChange('privatekey_body')}
                      onBlur={getValidation}
                    />
                  </FormItem>
                  <ValidatedInput
                    id="embedded_credentials_key_passphrase"
                    name="embedded_credentials_key_passphrase"
                    data-test="embedded-credentials-key-passphrase"
                    label={LABELS.PRIVATE_KEY_PASSPHRASE}
                    visibilityToggle
                    autoComplete="new-password"
                    disabled={!isActive}
                    value={embeddedCredentials.privatekey_pass}
                    validationMethods={validationMethods}
                    onChange={handleChange('privatekey_pass')}
                  />
                </>
              ) : (
                <ValidatedInput
                  id="embedded_credentials_password"
                  name="embedded_credentials_password"
                  data-test="embedded-credentials-password"
                  label={LABELS.PASSWORD}
                  placeholder={t('e.g. ********')}
                  visibilityToggle
                  autoComplete="new-password"
                  disabled={!isActive}
                  value={embeddedCredentials.password}
                  validationMethods={validationMethods}
                  onChange={handleChange('password')}
                />
              )}
              {(hasCredential || isStored) && (
                <Button
                  buttonStyle="link"
                  data-test="embedded-credentials-remove"
                  onClick={removeCredentials}
                >
                  {t('Remove embedded guest credentials')}
                </Button>
              )}
            </Form>
          ),
        },
      ]}
    />
  );
};

export default EmbeddedCredentialsField;
