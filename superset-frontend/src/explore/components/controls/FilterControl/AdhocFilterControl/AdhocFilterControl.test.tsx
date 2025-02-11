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
import userEvent from '@testing-library/user-event';
import AdhocFilterControl from '.';
import AdhocFilter from '../AdhocFilter';
import { Clauses, ExpressionTypes } from '../types';

interface Column {
  column_name: string;
  type: string;
}

interface Database {
  id: number;
}

interface Datasource {
  type: string;
  database: Database;
  schema: string;
  datasource_name: string;
}

interface Props {
  name: string;
  label: string;
  value: AdhocFilter[];
  datasource: Datasource;
  columns: Column[];
  onChange: jest.Mock;
  sections: string[];
  operators: string[];
}

const createProps = (): Props => ({
  name: 'filter_control',
  label: 'Filters',
  value: [],
  datasource: {
    type: 'table',
    database: { id: 1 },
    schema: 'test_schema',
    datasource_name: 'test_table',
  },
  columns: [
    { column_name: 'column1', type: 'STRING' },
    { column_name: 'column2', type: 'NUMBER' },
  ],
  onChange: jest.fn(),
  sections: ['WHERE', 'HAVING'],
  operators: ['==', '>', '<'],
});

const renderComponent = (props: Partial<Props> = {}) =>
  render(<AdhocFilterControl {...createProps()} {...props} />, {
    useDnd: true,
  });

describe('AdhocFilterControl', () => {
  it('should render with default props', () => {
    renderComponent();
    expect(screen.getByText('Add filter')).toBeInTheDocument();
    expect(screen.getByTestId('adhoc-filter-control')).toBeInTheDocument();
  });

  test('should render existing filters', () => {
    const existingFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'column1',
      operator: '==',
      comparator: 'test',
      clause: Clauses.Where,
    });

    renderComponent({ value: [existingFilter] });
    expect(screen.getByText("column1 = 'test'")).toBeInTheDocument();
  });

  test('should call onChange when removing a filter', async () => {
    const existingFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'column1',
      operator: '==',
      comparator: 'test',
      clause: Clauses.Where,
    });
    const onChange = jest.fn();

    renderComponent({ value: [existingFilter], onChange });

    const removeButton = screen.getByTestId('remove-control-button');
    await userEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('should show add filter button when no filters exist', () => {
    renderComponent();
    const addButton = screen.getByTestId('add-filter-button');
    expect(addButton).toBeInTheDocument();
  });

  it('should handle partition column data', async () => {
    const mockPartitionColumn = 'date_column';
    const mockResponse = {
      partitions: {
        cols: [mockPartitionColumn],
      },
    };

    const createMockResponse = () => {
      const response = new Response(JSON.stringify(mockResponse), {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      });

      jest
        .spyOn(response, 'json')
        .mockImplementation(() => Promise.resolve(mockResponse));
      return response;
    };

    global.fetch = jest
      .fn()
      .mockImplementation(() => Promise.resolve(createMockResponse()));

    renderComponent();

    await screen.findByTestId('adhoc-filter-control');

    const component = screen.getByTestId('adhoc-filter-control');
    expect(component).toBeInTheDocument();
  });
});
