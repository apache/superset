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

import React from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import userEvent from '@testing-library/user-event';
import TableSelector from '.';

const SupersetClientGet = jest.spyOn(SupersetClient, 'get');

const createProps = () => ({
  database: {
    id: 1,
    database_name: 'main',
    backend: 'sqlite',
    allow_multi_schema_metadata_fetch: false,
  },
  schema: 'test_schema',
  handleError: jest.fn(),
});

beforeAll(() => {
  SupersetClientGet.mockImplementation(
    async () =>
      ({
        json: {
          options: [
            { label: 'table_a', value: 'table_a' },
            { label: 'table_b', value: 'table_b' },
          ],
        },
      } as any),
  );
});

test('renders with default props', async () => {
  const props = createProps();
  render(<TableSelector {...props} />);
  const databaseSelect = screen.getByRole('combobox', {
    name: 'Select database or type database name',
  });
  const schemaSelect = screen.getByRole('combobox', {
    name: 'Select schema or type schema name',
  });
  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type table name',
  });
  await waitFor(() => {
    expect(databaseSelect).toBeInTheDocument();
    expect(schemaSelect).toBeInTheDocument();
    expect(tableSelect).toBeInTheDocument();
  });
});

test('renders table options', async () => {
  const props = createProps();
  render(<TableSelector {...props} />);
  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type table name',
  });
  userEvent.click(tableSelect);
  expect(
    await screen.findByRole('option', { name: 'table_a' }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('option', { name: 'table_b' }),
  ).toBeInTheDocument();
});

test('renders disabled without schema', async () => {
  const props = createProps();
  render(<TableSelector {...props} schema={undefined} />);
  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type table name',
  });
  await waitFor(() => {
    expect(tableSelect).toBeDisabled();
  });
});
