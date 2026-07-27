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

import { render } from 'spec/helpers/testing-library';
import {
  ConfigurationMethod,
  DatabaseObject,
} from 'src/features/databases/types';
import { TableCatalog } from './TableCatalog';

const HELPER_TEXT =
  'In order to connect to non-public sheets you need to either provide a service account or configure an OAuth2 client.';

const buildDb = (overrides: Partial<DatabaseObject> = {}): DatabaseObject => ({
  configuration_method: ConfigurationMethod.DynamicForm,
  database_name: 'test',
  driver: 'test',
  id: 1,
  name: 'test',
  is_managed_externally: false,
  engine: 'gsheets',
  catalog: [{ name: '', value: '' }],
  ...overrides,
});

const baseProps = {
  required: true,
  onParametersChange: jest.fn(),
  onParametersUploadFileChange: jest.fn(),
  changeMethods: {
    onParametersChange: jest.fn(),
    onChange: jest.fn(),
    onQueryChange: jest.fn(),
    onParametersUploadFileChange: jest.fn(),
    onAddTableCatalog: jest.fn(),
    onRemoveTableCatalog: jest.fn(),
    onExtraInputChange: jest.fn(),
    onEncryptedExtraInputChange: jest.fn(),
    onClearEncryptedExtraKey: jest.fn(),
    onSSHTunnelParametersChange: jest.fn(),
  },
  validationErrors: null,
  getValidation: jest.fn(),
  clearValidationErrors: jest.fn(),
  field: 'catalog',
  isValidating: false,
};

test('TableCatalog: hides credentials helper text for gsheets when isPublic is true', () => {
  const { queryByText } = render(
    <TableCatalog {...baseProps} db={buildDb()} isPublic />,
  );

  expect(queryByText(HELPER_TEXT)).not.toBeInTheDocument();
});

test('TableCatalog: shows credentials helper text for gsheets when isPublic is false', () => {
  const { getByText } = render(
    <TableCatalog {...baseProps} db={buildDb()} isPublic={false} />,
  );

  expect(getByText(HELPER_TEXT)).toBeInTheDocument();
});

test('TableCatalog: defaults to public (helper hidden) when isPublic is not provided', () => {
  const { queryByText } = render(
    <TableCatalog {...baseProps} db={buildDb()} />,
  );

  expect(queryByText(HELPER_TEXT)).not.toBeInTheDocument();
});
