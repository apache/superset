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
import { SupersetClient } from '@superset-ui/core';
import { render, screen } from 'spec/helpers/testing-library';
import LeftPanel from 'src/views/CRUD/data/dataset/AddDataset/LeftPanel';

describe('LeftPanel', () => {
  const mockFun = jest.fn();

  const SupersetClientGet = jest.spyOn(SupersetClient, 'get');

  const getSchemaMockFunction = async () =>
    ({
      json: {
        result: ['schema_a', 'schema_b'],
      },
    } as any);

  const getTableMockFunction = async () =>
    ({
      json: {
        options: [
          { label: 'table_a', value: 'table_a' },
          { label: 'table_b', value: 'table_b' },
          { label: 'table_c', value: 'table_c' },
          { label: 'table_d', value: 'table_d' },
        ],
      },
    } as any);

  it('should render', () => {
    const { container } = render(<LeftPanel setDataset={mockFun} />, {
      useRedux: true,
    });
    expect(container).toBeInTheDocument();
  });

  it('should render tableselector and databaselector container and selects', () => {
    render(<LeftPanel setDataset={mockFun} />, { useRedux: true });

    expect(screen.getByText(/select database & schema/i)).toBeVisible();

    const databaseSelect = screen.getByRole('combobox', {
      name: 'Select database or type database name',
    });
    const schemaSelect = screen.getByRole('combobox', {
      name: 'Select schema or type schema name',
    });
    expect(databaseSelect).toBeInTheDocument();
    expect(schemaSelect).toBeInTheDocument();
  });
  it('renders a blank state LeftPanel if there is no schema selected', () => {
    render(<LeftPanel setDataset={mockFun} />, { useRedux: true });

    expect(screen.getByRole('img', { name: /empty/i })).toBeVisible();
    expect(screen.getByText(/no database tables found/i)).toBeVisible();
    expect(screen.getByText(/try selecting a different schema/i)).toBeVisible();
  });
  it('renders list of options when user clicks on schema', () => {
    render(<LeftPanel setDataset={mockFun} schema="schema_a" dbId={1} />, {
      useRedux: true,
    });
    // screen.debug('container', container)
    SupersetClientGet.mockImplementation(getSchemaMockFunction);
    SupersetClientGet.mockImplementation(getTableMockFunction);
    expect(screen.getByTestId('options-list')).toBeInTheDocument();
  });
});
