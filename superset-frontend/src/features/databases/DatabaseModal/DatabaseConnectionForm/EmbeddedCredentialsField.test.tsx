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
import { EmbeddedCredentialsField } from './EmbeddedCredentialsField';

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

test('renders nothing when the connection does not use OAuth2', () => {
  const props = {
    ...defaultProps,
    db: { ...defaultProps.db, masked_encrypted_extra: '{}' },
  };

  const { queryByText } = render(<EmbeddedCredentialsField {...props} />);

  expect(queryByText('Embedded guest credentials')).not.toBeInTheDocument();
});

test('renders when OAuth2 client info is being typed into the form', () => {
  const props = {
    ...defaultProps,
    db: {
      ...defaultProps.db,
      masked_encrypted_extra: '{}',
      parameters: { oauth2_client_info: OAUTH2_CLIENT_INFO },
    } as unknown as DatabaseObject,
  };

  const { getByText } = render(<EmbeddedCredentialsField {...props} />);

  expect(getByText('Embedded guest credentials')).toBeInTheDocument();
});

test('renders when the engine has a deployment-wide OAuth2 client', () => {
  const props = {
    ...defaultProps,
    db: { ...defaultProps.db, masked_encrypted_extra: '{}' },
    default_value: { engine_oauth2_client_configured: true },
  };

  const { getByText } = render(<EmbeddedCredentialsField {...props} />);

  expect(getByText('Embedded guest credentials')).toBeInTheDocument();
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

test('warns when impersonation is off and a credential is set', () => {
  const props = {
    ...defaultProps,
    db: { ...defaultProps.db, impersonate_user: false } as DatabaseObject,
  };

  const { getByText, getByTestId } = render(
    <EmbeddedCredentialsField {...props} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));

  expect(
    getByTestId('embedded-credentials-impersonation-warning'),
  ).toHaveTextContent('Impersonate logged in user');
});

test('warns about impersonation for a key-pair credential too', () => {
  const props = {
    ...defaultProps,
    db: {
      ...defaultProps.db,
      impersonate_user: false,
      masked_encrypted_extra: JSON.stringify({
        oauth2_client_info: OAUTH2_CLIENT_INFO,
        embedded_credentials: {
          username: 'embedded_svc',
          auth_method: 'keypair',
          privatekey_body: 'XXXXXXXXXX',
        },
      }),
    } as DatabaseObject,
  };

  const { getByText, getByTestId } = render(
    <EmbeddedCredentialsField {...props} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));

  expect(
    getByTestId('embedded-credentials-impersonation-warning'),
  ).toBeInTheDocument();
});

test('does not warn about impersonation when it is on', () => {
  const { getByText, queryByTestId } = render(
    <EmbeddedCredentialsField {...defaultProps} />,
  );

  fireEvent.click(getByText('Embedded guest credentials'));

  expect(
    queryByTestId('embedded-credentials-impersonation-warning'),
  ).not.toBeInTheDocument();
});

test('does not warn about impersonation when no credential is set', () => {
  const props = {
    ...defaultProps,
    db: {
      ...defaultProps.db,
      impersonate_user: false,
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
    queryByTestId('embedded-credentials-impersonation-warning'),
  ).not.toBeInTheDocument();
});
