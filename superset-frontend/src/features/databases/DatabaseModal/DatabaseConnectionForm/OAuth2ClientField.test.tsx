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
import { OAuth2ClientField } from './OAuth2ClientField';

describe('OAuth2ClientField', () => {
  const mockChangeMethods = {
    onEncryptedExtraInputChange: jest.fn(),
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
    field: 'test',
    db: {
      configuration_method: 'dynamic_form',
      database_name: 'test',
      driver: 'test',
      id: 1,
      name: 'test',
      is_managed_externally: false,
      engine_information: {
        supports_oauth2: true,
      },
      masked_encrypted_extra: JSON.stringify({
        oauth2_client_info: {
          id: 'test-id',
          secret: 'test-secret',
          authorization_request_uri: 'https://auth-uri',
          token_request_uri: 'https://token-uri',
          scope: 'test-scope',
        },
      }),
    } as DatabaseObject,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not show input fields until the collapse trigger is clicked', () => {
    const { getByText, getByTestId, queryByTestId } = render(
      <OAuth2ClientField {...defaultProps} />,
    );

    expect(queryByTestId('client-id')).not.toBeInTheDocument();
    expect(queryByTestId('client-secret')).not.toBeInTheDocument();
    expect(
      queryByTestId('client-authorization-request-uri'),
    ).not.toBeInTheDocument();
    expect(queryByTestId('client-token-request-uri')).not.toBeInTheDocument();
    expect(queryByTestId('client-scope')).not.toBeInTheDocument();

    const collapseTrigger = getByText('OAuth2 client information');
    fireEvent.click(collapseTrigger);

    expect(getByTestId('client-id')).toBeInTheDocument();
    expect(getByTestId('client-secret')).toBeInTheDocument();
    expect(getByTestId('client-authorization-request-uri')).toBeInTheDocument();
    expect(getByTestId('client-token-request-uri')).toBeInTheDocument();
    expect(getByTestId('client-scope')).toBeInTheDocument();
  });

  it('renders the OAuth2ClientField component with initial values', () => {
    const { getByTestId, getByText } = render(
      <OAuth2ClientField {...defaultProps} />,
    );

    const collapseTrigger = getByText('OAuth2 client information');
    fireEvent.click(collapseTrigger);

    expect(getByTestId('client-id')).toHaveValue('test-id');
    expect(getByTestId('client-secret')).toHaveValue('test-secret');
    expect(getByTestId('client-authorization-request-uri')).toHaveValue(
      'https://auth-uri',
    );
    expect(getByTestId('client-token-request-uri')).toHaveValue(
      'https://token-uri',
    );
    expect(getByTestId('client-scope')).toHaveValue('test-scope');
  });

  it('handles input changes and triggers onEncryptedExtraInputChange', () => {
    const { getByTestId, getByText } = render(
      <OAuth2ClientField {...defaultProps} />,
    );

    const collapseTrigger = getByText('OAuth2 client information');
    fireEvent.click(collapseTrigger);

    const clientIdInput = getByTestId('client-id');
    fireEvent.change(clientIdInput, { target: { value: 'new-id' } });

    expect(mockChangeMethods.onParametersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          name: 'oauth2_client_info',
          type: 'object',
          value: {
            authorization_request_uri: 'https://auth-uri',
            id: 'new-id',
            scope: 'test-scope',
            secret: 'test-secret',
            token_request_uri: 'https://token-uri',
          },
        },
      }),
    );
  });

  it('does not render when supports_oauth2 is false', () => {
    const props = {
      ...defaultProps,
      db: {
        ...defaultProps.db,
        engine_information: {
          supports_oauth2: false,
        },
      },
    };

    const { queryByTestId } = render(<OAuth2ClientField {...props} />);

    expect(queryByTestId('client-id')).not.toBeInTheDocument();
  });

  it('renders empty fields when masked_encrypted_extra is empty', () => {
    const props = {
      ...defaultProps,
      db: {
        ...defaultProps.db,
        engine_information: {
          supports_oauth2: true,
        },
        masked_encrypted_extra: '{}',
      },
    };

    const { getByTestId, getByText } = render(<OAuth2ClientField {...props} />);

    const collapseTrigger = getByText('OAuth2 client information');
    fireEvent.click(collapseTrigger);

    expect(getByTestId('client-id')).toHaveValue('');
    expect(getByTestId('client-secret')).toHaveValue('');
    expect(getByTestId('client-authorization-request-uri')).toHaveValue('');
    expect(getByTestId('client-token-request-uri')).toHaveValue('');
    expect(getByTestId('client-scope')).toHaveValue('');
  });
});
