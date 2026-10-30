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

import { render, fireEvent } from 'spec/helpers/testing-library';
import { DatabaseObject } from 'src/features/databases/types';
import {
  EmbeddedCredentialsField,
  oauth2ClientInfoConfigured,
} from './EmbeddedCredentialsField';

const mockChangeMethods = {
  onEncryptedExtraInputChange: jest.fn(),
  onClearEncryptedExtraKey: jest.fn(),
  onParametersChange: jest.fn(),
  onChange: jest.fn(),
  onQueryChange: jest.fn(),
  onParametersUploadFileChange: jest.fn(),
  onAddTableCatalog: jest.fn(),
  onRemoveTableCatalog: jest.fn(),
  onExtraInputChange: jest.fn(),
  onSSHTunnelParametersChange: jest.fn(),
};

const OAUTH2_CLIENT_INFO = {
  id: 'client-id',
  secret: 'XXXXXXXXXX',
};

const defaultProps = {
  required: false,
  onParametersChange: jest.fn(),
  onParametersUploadFileChange: jest.fn(),
  changeMethods: mockChangeMethods,
  validationErrors: null,
  getValidation: jest.fn(),
  clearValidationErrors: jest.fn(),
  field: 'embedded_credentials',
  isValidating: false,
  db: {
    configuration_method: 'dynamic_form',
    database_name: 'test',
    driver: 'snowflake',
    engine: 'snowflake',
    id: 1,
    name: 'test',
    is_managed_externally: false,
    impersonate_user: true,
    masked_encrypted_extra: JSON.stringify({
      oauth2_client_info: OAUTH2_CLIENT_INFO,
      embedded_credentials: {
        username: 'embedded_svc',
        password: 'XXXXXXXXXX',
      },
    }),
  } as DatabaseObject,
};

afterEach(() => {
  jest.clearAllMocks();
});

test('does not show input fields until the collapse trigger is clicked', () => {
  const { getByText, getByTestId, queryByTestId } = render(
    <EmbeddedCredentialsField {...defaultProps} />,
  );

  expect(
    queryByTestId('embedded-credentials-username'),
  ).not.toBeInTheDocument();
  expect(
    queryByTestId('embedded-credentials-password'),
  ).not.toBeInTheDocument();

  fireEvent.click(getByText('Embedded guest credentials'));

  expect(getByTestId('embedded-credentials-username')).toBeInTheDocument();
  expect(getByTestId('embedded-credentials-password')).toBeInTheDocument();
  expect(
    queryByTestId('embedded-credentials-private-key'),
  ).not.toBeInTheDocument();
});

test('renders the stored username and the masked password', () => {
  const { getByText, getByTestId } = render(
    <EmbeddedCredentialsField {...defaultProps} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));

  // The username stays readable so an admin can see who embedded queries run
  // as; the password comes back masked and is posted back verbatim.
  expect(getByTestId('embedded-credentials-username')).toHaveValue(
    'embedded_svc',
  );
  expect(getByTestId('embedded-credentials-password')).toHaveValue(
    'XXXXXXXXXX',
  );
});

test('warns that every embedded viewer shares the credential', () => {
  const { getByText } = render(<EmbeddedCredentialsField {...defaultProps} />);

  fireEvent.click(getByText('Embedded guest credentials'));

  expect(
    getByText(/Every embedded viewer of this connection queries as this one/),
  ).toBeInTheDocument();
});

test('reports changes as an object so the parent can encrypt it', () => {
  const { getByText, getByTestId } = render(
    <EmbeddedCredentialsField {...defaultProps} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));
  fireEvent.change(getByTestId('embedded-credentials-username'), {
    target: { value: 'other_svc' },
  });

  expect(mockChangeMethods.onParametersChange).toHaveBeenCalledWith(
    expect.objectContaining({
      target: {
        type: 'object',
        name: 'embedded_credentials',
        value: {
          username: 'other_svc',
          password: 'XXXXXXXXXX',
          auth_method: 'password',
        },
      },
    }),
  );
});

test('uses a PEM key without requiring the embedded password', () => {
  const { getByText, getByTestId, queryByTestId } = render(
    <EmbeddedCredentialsField {...defaultProps} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));
  fireEvent.click(getByText('Key pair'));

  expect(
    queryByTestId('embedded-credentials-password'),
  ).not.toBeInTheDocument();
  fireEvent.change(getByTestId('embedded-credentials-private-key'), {
    target: {
      value: '-----BEGIN PRIVATE KEY-----\nexample\n-----END PRIVATE KEY-----',
    },
  });

  expect(mockChangeMethods.onParametersChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      target: expect.objectContaining({
        name: 'embedded_credentials',
        value: expect.objectContaining({
          username: 'embedded_svc',
          auth_method: 'keypair',
          privatekey_body:
            '-----BEGIN PRIVATE KEY-----\nexample\n-----END PRIVATE KEY-----',
        }),
      }),
    }),
  );
  expect(
    mockChangeMethods.onParametersChange.mock.lastCall?.[0].target.value,
  ).not.toHaveProperty('password');
});

test('reuses a masked embedded PEM key and passphrase on edit', () => {
  const props = {
    ...defaultProps,
    db: {
      ...defaultProps.db,
      masked_encrypted_extra: JSON.stringify({
        oauth2_client_info: OAUTH2_CLIENT_INFO,
        embedded_credentials: {
          username: 'embedded_svc',
          auth_method: 'keypair',
          privatekey_body: 'XXXXXXXXXX',
          privatekey_pass: 'XXXXXXXXXX',
        },
      }),
    },
  };
  const { getByText, getByTestId, queryByTestId } = render(
    <EmbeddedCredentialsField {...props} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));
  expect(
    queryByTestId('embedded-credentials-password'),
  ).not.toBeInTheDocument();
  expect(getByTestId('embedded-credentials-private-key')).toHaveValue(
    'XXXXXXXXXX',
  );
  expect(getByTestId('embedded-credentials-key-passphrase')).toHaveValue(
    'XXXXXXXXXX',
  );
});

test('renders empty fields when no credential is stored', () => {
  const props = {
    ...defaultProps,
    db: {
      ...defaultProps.db,
      masked_encrypted_extra: JSON.stringify({
        oauth2_client_info: OAUTH2_CLIENT_INFO,
      }),
    } as DatabaseObject,
  };

  const { getByText, getByTestId } = render(
    <EmbeddedCredentialsField {...props} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));

  expect(getByTestId('embedded-credentials-username')).toHaveValue('');
  expect(getByTestId('embedded-credentials-password')).toHaveValue('');
});

test('keeps a blank key-pair selection when the parent clears the credential', () => {
  const db = {
    ...defaultProps.db,
    masked_encrypted_extra: JSON.stringify({
      oauth2_client_info: OAUTH2_CLIENT_INFO,
    }),
  };
  const { getByText, getByTestId, getByRole, queryByTestId, rerender } = render(
    <EmbeddedCredentialsField {...defaultProps} db={db} />,
  );
  fireEvent.click(getByText('Embedded guest credentials'));
  fireEvent.click(getByText('Key pair'));
  expect(mockChangeMethods.onParametersChange).toHaveBeenLastCalledWith({
    target: { name: 'embedded_credentials', value: '' },
  });

  rerender(
    <EmbeddedCredentialsField
      {...defaultProps}
      db={
        {
          ...db,
          parameters: { embedded_credentials: '' },
        } as unknown as DatabaseObject
      }
    />,
  );
  expect(getByRole('radio', { name: 'Key pair' })).toBeChecked();
  expect(getByTestId('embedded-credentials-private-key')).toBeInTheDocument();
  expect(
    queryByTestId('embedded-credentials-password'),
  ).not.toBeInTheDocument();

  fireEvent.change(getByTestId('embedded-credentials-username'), {
    target: { value: 'embedded_svc' },
  });
  expect(mockChangeMethods.onParametersChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      target: expect.objectContaining({
        value: expect.objectContaining({ auth_method: 'keypair' }),
      }),
    }),
  );

  rerender(<EmbeddedCredentialsField {...defaultProps} db={db} />);
  expect(getByTestId('embedded-credentials-username')).toHaveValue('');
  expect(getByRole('radio', { name: 'Key pair' })).toBeChecked();
  rerender(
    <EmbeddedCredentialsField {...defaultProps} db={{ ...db, id: 2 }} />,
  );
  expect(getByRole('radio', { name: 'Password' })).toBeChecked();
});

test.each([
  ['the literal string "null"', 'null'],
  ['malformed JSON', 'not json'],
  ['a JSON primitive', '42'],
  ['a JSON array', '[1, 2, 3]'],
])('mounts safely when masked_encrypted_extra is %s', (_label, value) => {
  const props = {
    ...defaultProps,
    db: { ...defaultProps.db, masked_encrypted_extra: value },
    // Without this the component correctly renders nothing, which would make
    // these cases vacuous -- the point is that the parse itself cannot throw.
    default_value: { engine_oauth2_client_configured: true },
  };

  expect(() => render(<EmbeddedCredentialsField {...props} />)).not.toThrow();
});

test('is disabled with a reason when the connection has no OAuth2 client', () => {
  const props = {
    ...defaultProps,
    db: { ...defaultProps.db, masked_encrypted_extra: '{}' },
  };

  const { getByText, getByTestId } = render(
    <EmbeddedCredentialsField {...props} />,
  );

  expect(getByTestId('embedded-credentials-inactive-reason')).toHaveTextContent(
    'Requires OAuth2 client information and “Impersonate logged in user”',
  );
  fireEvent.click(getByText('Embedded guest credentials'));
  expect(getByTestId('embedded-credentials-username')).toBeDisabled();
  expect(getByTestId('embedded-credentials-password')).toBeDisabled();
});

test('is disabled with a reason when impersonation is off', () => {
  const props = {
    ...defaultProps,
    db: { ...defaultProps.db, impersonate_user: false } as DatabaseObject,
  };

  const { getByText, getByTestId, getByRole } = render(
    <EmbeddedCredentialsField {...props} />,
  );

  expect(
    getByTestId('embedded-credentials-inactive-reason'),
  ).toBeInTheDocument();
  fireEvent.click(getByText('Embedded guest credentials'));
  expect(getByTestId('embedded-credentials-username')).toBeDisabled();
  expect(getByRole('radio', { name: 'Key pair' })).toBeDisabled();
  // A stored credential can still be removed while the section is inactive.
  expect(getByTestId('embedded-credentials-remove')).toBeEnabled();
});

test('is enabled without a reason when OAuth2 and impersonation are on', () => {
  const { getByText, getByTestId, queryByTestId } = render(
    <EmbeddedCredentialsField {...defaultProps} />,
  );

  expect(
    queryByTestId('embedded-credentials-inactive-reason'),
  ).not.toBeInTheDocument();
  fireEvent.click(getByText('Embedded guest credentials'));
  expect(getByTestId('embedded-credentials-username')).toBeEnabled();
  expect(getByTestId('embedded-credentials-password')).toBeEnabled();
});

test('uses a password input with a visibility toggle and no autofill', () => {
  const { getByText, getByTestId, getAllByTestId } = render(
    <EmbeddedCredentialsField {...defaultProps} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));

  const password = getByTestId('embedded-credentials-password');
  expect(password).toHaveAttribute('type', 'password');
  expect(password).toHaveAttribute('autocomplete', 'new-password');
  expect(password).toHaveAttribute('placeholder');
  expect(getByTestId('embedded-credentials-username')).toHaveAttribute(
    'autocomplete',
    'off',
  );
  expect(getAllByTestId('icon-eye').length).toBeGreaterThan(0);

  fireEvent.click(getAllByTestId('icon-eye')[0]);
  expect(password).toHaveAttribute('type', 'text');
});

test('shows a Configured tag when a credential is stored', () => {
  const { getByTestId } = render(
    <EmbeddedCredentialsField {...defaultProps} />,
  );

  expect(getByTestId('embedded-credentials-configured')).toHaveTextContent(
    'Configured',
  );
});

test('does not show a Configured tag or Remove when nothing is stored', () => {
  const props = {
    ...defaultProps,
    db: {
      ...defaultProps.db,
      masked_encrypted_extra: JSON.stringify({
        oauth2_client_info: OAUTH2_CLIENT_INFO,
      }),
    } as DatabaseObject,
  };
  const { getByText, queryByTestId } = render(
    <EmbeddedCredentialsField {...props} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));
  expect(
    queryByTestId('embedded-credentials-configured'),
  ).not.toBeInTheDocument();
  expect(queryByTestId('embedded-credentials-remove')).not.toBeInTheDocument();
});

test('mirrors username edits into the Secure Extra JSON', () => {
  const { getByText, getByTestId } = render(
    <EmbeddedCredentialsField {...defaultProps} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));
  fireEvent.change(getByTestId('embedded-credentials-username'), {
    target: { value: 'other_svc' },
  });

  expect(
    mockChangeMethods.onEncryptedExtraInputChange,
  ).toHaveBeenLastCalledWith({
    target: {
      name: 'embedded_credentials',
      value: {
        username: 'other_svc',
        auth_method: 'password',
        password: 'XXXXXXXXXX',
      },
    },
  });
});

test('Remove deletes the credential from Secure Extra', () => {
  const { getByText, getByTestId } = render(
    <EmbeddedCredentialsField {...defaultProps} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));
  fireEvent.click(getByTestId('embedded-credentials-remove'));

  expect(mockChangeMethods.onClearEncryptedExtraKey).toHaveBeenCalledWith(
    'embedded_credentials',
  );
  expect(mockChangeMethods.onParametersChange).toHaveBeenLastCalledWith({
    target: { name: 'embedded_credentials', value: '' },
  });
  expect(mockChangeMethods.onEncryptedExtraInputChange).not.toHaveBeenCalled();
  expect(getByTestId('embedded-credentials-username')).toHaveValue('');
  expect(getByTestId('embedded-credentials-password')).toHaveValue('');
});

test('is enabled when OAuth2 client info is being typed into the form', () => {
  const props = {
    ...defaultProps,
    db: {
      ...defaultProps.db,
      masked_encrypted_extra: '{}',
      parameters: { oauth2_client_info: OAUTH2_CLIENT_INFO },
    } as unknown as DatabaseObject,
  };

  const { queryByTestId } = render(<EmbeddedCredentialsField {...props} />);

  expect(
    queryByTestId('embedded-credentials-inactive-reason'),
  ).not.toBeInTheDocument();
});

test('is enabled when the engine has a deployment-wide OAuth2 client', () => {
  const props = {
    ...defaultProps,
    db: { ...defaultProps.db, masked_encrypted_extra: '{}' },
    default_value: { engine_oauth2_client_configured: true },
  };

  const { queryByTestId } = render(<EmbeddedCredentialsField {...props} />);

  expect(
    queryByTestId('embedded-credentials-inactive-reason'),
  ).not.toBeInTheDocument();
});

test('prefers an in-flight credential over the stored blob', () => {
  // Switching the configuration method and back re-mounts the field while
  // `parameters` still holds what was typed. Seeding from the stored blob
  // alone would render empty inputs for a credential the save would carry.
  const props = {
    ...defaultProps,
    db: {
      ...defaultProps.db,
      parameters: {
        embedded_credentials: {
          username: 'typed_svc',
          auth_method: 'password',
          password: 'typed_pwd',
        },
      },
    } as unknown as DatabaseObject,
  };

  const { getByText, getByTestId } = render(
    <EmbeddedCredentialsField {...props} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));

  expect(getByTestId('embedded-credentials-username')).toHaveValue('typed_svc');
  expect(getByTestId('embedded-credentials-password')).toHaveValue('typed_pwd');
});

test('clears the stored key instead of saving a blank credential', () => {
  const { getByText, getByTestId } = render(
    <EmbeddedCredentialsField {...defaultProps} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));
  fireEvent.change(getByTestId('embedded-credentials-password'), {
    target: { value: '' },
  });
  fireEvent.change(getByTestId('embedded-credentials-username'), {
    target: { value: '' },
  });

  expect(mockChangeMethods.onClearEncryptedExtraKey).toHaveBeenCalledWith(
    'embedded_credentials',
  );
  // `auth_method` on its own is not a credential, so the parameter is cleared
  // rather than posted as a shape full of empty strings.
  expect(mockChangeMethods.onParametersChange).toHaveBeenLastCalledWith({
    target: { name: 'embedded_credentials', value: '' },
  });
});

test('validates on blur so an incomplete credential surfaces before save', () => {
  const { getByText, getByTestId } = render(
    <EmbeddedCredentialsField {...defaultProps} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));
  fireEvent.blur(getByTestId('embedded-credentials-username'));

  expect(defaultProps.getValidation).toHaveBeenCalled();
});

test('opens the panel and shows the error when validation rejects the pair', () => {
  const props = {
    ...defaultProps,
    db: {
      ...defaultProps.db,
      masked_encrypted_extra: JSON.stringify({
        oauth2_client_info: OAUTH2_CLIENT_INFO,
        embedded_credentials: { username: 'embedded_svc' },
      }),
    } as DatabaseObject,
    validationErrors: {
      embedded_credentials: 'Embedded guest credentials are incomplete.',
    },
  };

  const { getByTestId } = render(<EmbeddedCredentialsField {...props} />);

  // No click: the panel opens itself, otherwise the error would be hidden
  // behind a collapsed header while Connect sits disabled.
  expect(getByTestId('embedded-credentials-error')).toHaveTextContent(
    'Embedded guest credentials are incomplete.',
  );
});

test.each([
  ['a blank client id and secret', { id: '', secret: '' }],
  ['a blank client secret', { id: 'client-id', secret: '   ' }],
  ['a blank client id', { id: '', secret: 'XXXXXXXXXX' }],
])('is inactive when the stored OAuth2 client has %s', (_, client) => {
  // sc-127897: a blank client is no client, matching the server's save check.
  const props = {
    ...defaultProps,
    db: {
      ...defaultProps.db,
      masked_encrypted_extra: JSON.stringify({
        oauth2_client_info: {
          ...client,
          scope: 'refresh_token',
          authorization_request_uri:
            'https://x.snowflakecomputing.com/oauth/authorize',
        },
      }),
    } as DatabaseObject,
  };

  const { getByTestId } = render(<EmbeddedCredentialsField {...props} />);

  expect(
    getByTestId('embedded-credentials-inactive-reason'),
  ).toBeInTheDocument();
});

test('is inactive when a blank OAuth2 client is typed into the form', () => {
  const props = {
    ...defaultProps,
    db: {
      ...defaultProps.db,
      masked_encrypted_extra: '{}',
      parameters: { oauth2_client_info: { id: '', secret: '' } },
    } as unknown as DatabaseObject,
  };

  const { getByTestId } = render(<EmbeddedCredentialsField {...props} />);

  expect(
    getByTestId('embedded-credentials-inactive-reason'),
  ).toBeInTheDocument();
});

test.each([
  [{ id: 'client', secret: 'secret' }, true],
  [{ id: 'client', secret: 'XXXXXXXXXX' }, true],
  [{ id: 'client', secret: '' }, false],
  [{ id: ' ', secret: 'secret' }, false],
  [{ id: 'client' }, false],
  [{ id: 'client', secret: null }, false],
  [{}, false],
  [null, false],
  ['client', false],
])('oauth2ClientInfoConfigured(%j) is %s', (clientInfo, configured) => {
  expect(oauth2ClientInfoConfigured(clientInfo)).toBe(configured);
});
