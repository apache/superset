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
import { render, screen } from 'spec/helpers/testing-library';
import { ConfigurationMethod, FieldPropTypes } from '../../types';
import { awsSecretAccessKeyField } from './CommonParameters';

const renderSecretField = (isEditMode: boolean, secret?: string) => {
  const props = {
    required: false,
    field: 'aws_secret_access_key',
    changeMethods: { onParametersChange: jest.fn() },
    getValidation: jest.fn(),
    validationErrors: null,
    db: {
      configuration_method: ConfigurationMethod.DynamicForm,
      database_name: 'athena',
      driver: 'rest',
      engine: 'awsathena',
      parameters: { aws_secret_access_key: secret },
    },
    isValidating: false,
    isEditMode,
  } as unknown as FieldPropTypes;
  return render(awsSecretAccessKeyField(props));
};

test.each([
  ['add', false],
  ['edit', true],
])(
  'masks the AWS secret access key in %s mode',
  (_mode: string, isEditMode: boolean) => {
    renderSecretField(isEditMode, 'wJalrXUtnFEMI/K7MDENG');

    expect(screen.getByText('AWS Secret Access Key')).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('name', 'aws_secret_access_key');
    expect(screen.getByTestId('icon-eye')).toBeInTheDocument();
  },
);
