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
    masked_encrypted_extra: JSON.stringify({
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
        },
      },
    }),
  );
});

test('renders empty fields when no credential is stored', () => {
  const props = {
    ...defaultProps,
    db: { ...defaultProps.db, masked_encrypted_extra: '{}' },
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
  };

  expect(() => render(<EmbeddedCredentialsField {...props} />)).not.toThrow();
});
