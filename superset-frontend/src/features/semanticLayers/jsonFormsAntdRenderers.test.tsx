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
import {
  fireEvent,
  render,
  screen,
  selectOption,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { JsonForms } from '@jsonforms/react';
import type { JsonSchema } from '@jsonforms/core';
import { cellRegistryEntries } from '@great-expectations/jsonforms-antd-renderers';
import { renderers, buildUiSchema, sanitizeSchema } from './jsonFormsHelpers';

/**
 * Real-render smoke test for @great-expectations/jsonforms-antd-renderers.
 *
 * The package has NO antd 6 release — it is pinned onto antd 6 via a
 * package.json override — and it renders forms from runtime schemas, so a
 * breaking antd change in its renderers is invisible to TypeScript. The
 * SemanticLayerModal tests mock <JsonForms /> away, leaving this the only
 * coverage that the vendor's renderers actually mount against antd 6.
 * Renders exactly the way the modal does (same renderers, cells, and
 * uischema builder).
 */

const schema = sanitizeSchema({
  type: 'object',
  properties: {
    account: {
      type: 'string',
      title: 'Account',
    },
    warehouse: {
      type: 'string',
      title: 'Warehouse',
      enum: ['wh_small', 'wh_large'],
    },
    use_ssl: {
      type: 'boolean',
      title: 'Use SSL',
    },
    port: {
      type: 'number',
      title: 'Port',
    },
  },
  required: ['account'],
} as JsonSchema);

const setup = (data: Record<string, unknown> = {}) => {
  const onChange = jest.fn();
  render(
    <JsonForms
      schema={schema}
      uischema={buildUiSchema(schema)}
      data={data}
      renderers={renderers}
      cells={cellRegistryEntries}
      validationMode="ValidateAndHide"
      onChange={onChange}
    />,
  );
  return onChange;
};

test('renders string, enum, boolean, and number controls from a schema', () => {
  setup();

  // string + number → real inputs with their schema titles as labels
  expect(screen.getByLabelText('Account')).toBeInTheDocument();
  expect(screen.getByLabelText('Port')).toBeInTheDocument();
  // enum → an antd select (combobox role)
  expect(screen.getByRole('combobox', { name: 'Warehouse' })).toBeVisible();
  // boolean control renders with its title
  expect(screen.getByText('Use SSL')).toBeInTheDocument();
});

test('typing into a text control propagates through onChange', async () => {
  const onChange = setup();

  const input = screen.getByLabelText('Account');
  await userEvent.type(input, 'acme');
  // commit the value; avoid userEvent.tab() — the vendor's checkbox id
  // ("#/properties/use_ssl-input") breaks nwsapi's focusable-element scan
  fireEvent.blur(input);
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ account: 'acme' }),
      }),
    ),
  );
});

test('enum control opens an antd 6 dropdown and selects an option', async () => {
  const onChange = setup();

  await selectOption('wh_large', 'Warehouse');

  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ warehouse: 'wh_large' }),
      }),
    ),
  );
});

const pemPlaceholder =
  '-----BEGIN PRIVATE KEY-----\nMIIEv…\n-----END PRIVATE KEY-----';

test('ordinary string controls retain the vendor default display', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      schema: { type: 'string', title: 'Schema', default: 'PUBLIC' },
    },
  };
  render(
    <JsonForms
      schema={schema}
      uischema={buildUiSchema(schema)}
      data={{}}
      renderers={renderers}
      cells={cellRegistryEntries}
    />,
  );
  expect(screen.getByRole('textbox', { name: 'Schema' })).toHaveValue('PUBLIC');
});

test.each([false, true])(
  'manual fields remain typeable when discovery is pending: %s',
  refreshingSchema => {
    const schema = {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          title: 'Database',
          'x-dynamic': true,
          'x-dependsOn': ['account'],
        },
      },
    } as JsonSchema;
    render(
      <JsonForms
        schema={schema}
        uischema={buildUiSchema(schema)}
        data={{}}
        renderers={renderers}
        cells={cellRegistryEntries}
        config={{ refreshingSchema, formData: { account: 'synthetic' } }}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Database' })).toBeEnabled();
  },
);
const keyHelp = 'Paste the whole key, including the BEGIN and END lines.';
const passwordHelp = 'Leave blank for an unencrypted key.';
// Pydantic's SecretStr | None inside a discriminated auth union.
const credentialSchema = {
  type: 'object',
  $defs: {
    PrivateKey: {
      type: 'object',
      title: 'Private key',
      properties: {
        username: {
          type: 'string',
          title: 'Username',
          description: 'Snowflake user.',
        },
        private_key: {
          type: 'string',
          title: 'Private key',
          format: 'password',
          writeOnly: true,
          'x-input-type': 'pem',
          description: keyHelp,
          examples: [pemPlaceholder],
        },
        private_key_password: {
          title: 'Private key password',
          description: passwordHelp,
          default: null,
          anyOf: [
            { type: 'string', format: 'password', writeOnly: true },
            { type: 'null' },
          ],
        },
      },
      required: ['username', 'private_key'],
    },
    Password: {
      type: 'object',
      title: 'Password',
      properties: {
        password: { type: 'string', format: 'password', title: 'Password' },
      },
      required: ['password'],
    },
  },
  properties: {
    auth: {
      title: 'Authentication',
      oneOf: [{ $ref: '#/$defs/PrivateKey' }, { $ref: '#/$defs/Password' }],
    },
  },
} as JsonSchema;

function setupCredentials(privateKey = '', password?: string | null) {
  const onChange = jest.fn();
  render(
    <JsonForms
      schema={credentialSchema}
      uischema={buildUiSchema(credentialSchema)}
      data={{
        auth: {
          username: 'synthetic_user',
          private_key: privateKey,
          ...(password === undefined ? {} : { private_key_password: password }),
        },
      }}
      renderers={renderers}
      cells={cellRegistryEntries}
      onChange={onChange}
    />,
  );
  return onChange;
}

test.each([null, undefined, '', 'XXXXXXXXXX'])(
  'nullable password is one optional input for %s',
  async password => {
    const onChange = setupCredentials('XXXXXXXXXX', password);
    const input = screen.getByLabelText('Private key password');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autoComplete', 'new-password');
    expect(input).toHaveValue(password ?? '');
    expect(screen.queryByText('anyOf-0')).not.toBeInTheDocument();
    expect(screen.queryByText('anyOf-1')).not.toBeInTheDocument();
    expect(screen.getByText(passwordHelp)).toBeVisible();
    // The real auth union remains selectable.
    expect(screen.getByRole('radio', { name: 'Password' })).toBeInTheDocument();
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)[0].data.auth.private_key_password).toBe(
      password,
    );
    fireEvent.change(input, { target: { value: 'synthetic-passphrase' } });
    await waitFor(() =>
      expect(onChange.mock.calls.at(-1)[0].data.auth.private_key_password).toBe(
        'synthetic-passphrase',
      ),
    );
    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() =>
      expect(onChange.mock.calls.at(-1)[0].data.auth.private_key_password).toBe(
        '',
      ),
    );
  },
);

test('PEM control preserves newlines and shows its shape and help', async () => {
  const onChange = setupCredentials();
  const input = screen.getByRole('textbox', { name: 'Private key' });
  expect(input.tagName).toBe('TEXTAREA');
  expect(input).toHaveAttribute('placeholder', pemPlaceholder);
  expect(input).toHaveAttribute('autoComplete', 'new-password');
  expect(screen.getByText(keyHelp)).toBeVisible();
  expect(screen.getByText('Snowflake user.')).toBeVisible();
  const value =
    '-----BEGIN PRIVATE KEY-----\nSYNTHETIC\n-----END PRIVATE KEY-----';
  fireEvent.change(input, { target: { value } });
  await waitFor(() =>
    expect(onChange.mock.calls.at(-1)[0].data.auth.private_key).toBe(value),
  );
  expect(input).toHaveValue(value);
});

test.each([
  'SYNTHETIC',
  '-----BEGIN PRIVATE KEY-----\nSYNTHETIC',
  '-----BEGIN PRIVATE KEY-----\nSYNTHETIC\n-----END RSA PRIVATE KEY-----',
])('PEM control explains missing or mismatched boundaries: %s', privateKey => {
  setupCredentials(privateKey);
  expect(
    screen.getByText('Include matching BEGIN and END private key lines.'),
  ).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Private key' })).toBeEnabled();
});

test('saved masked key does not gain a PEM error or change its value', async () => {
  const onChange = setupCredentials('XXXXXXXXXX');
  expect(
    screen.queryByText('Include matching BEGIN and END private key lines.'),
  ).not.toBeInTheDocument();
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(onChange.mock.calls.at(-1)[0].data.auth.private_key).toBe(
    'XXXXXXXXXX',
  );
  expect(onChange.mock.calls.at(-1)[0].errors).toEqual([]);
});
