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
import { validatedInputField } from './ValidatedInputField';

const renderField = (field: string, required: boolean) => {
  const props = {
    required,
    field,
    changeMethods: { onParametersChange: jest.fn() },
    getValidation: jest.fn(),
    validationErrors: null,
    db: {
      configuration_method: ConfigurationMethod.DynamicForm,
      database_name: 'athena',
      driver: 'rest',
      engine: 'awsathena',
      parameters: {},
    },
    isValidating: false,
    isEditMode: false,
  } as unknown as FieldPropTypes;
  return render(validatedInputField(props));
};

test('labels the Athena S3 field as the query results location', () => {
  renderField('s3_staging_dir', false);

  expect(screen.getByText('S3 query results location')).toBeInTheDocument();
  expect(screen.queryByText('S3 Staging Directory')).not.toBeInTheDocument();
  expect(
    screen.getByPlaceholderText('e.g. s3://my-bucket/athena-results/'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Optional if your workgroup sets a result location.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('textbox')).not.toBeRequired();
});
