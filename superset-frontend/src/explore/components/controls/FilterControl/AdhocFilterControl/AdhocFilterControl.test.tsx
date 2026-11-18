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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { Operators } from 'src/explore/constants';
import AdhocFilterControl from '.';
import AdhocFilter from '../AdhocFilter';
import { Clauses, ExpressionTypes } from '../types';

// The real editor is an Ace instance that loads asynchronously and exposes no
// DOM input, so a plain textarea stands in for it.
jest.mock('src/core/editors', () => {
  const React = require('react');
  return {
    EditorHost: React.forwardRef(
      (
        {
          value,
          onChange,
        }: {
          value: string;
          onChange: (v: string) => void;
        },
        ref: React.Ref<{ resize: () => void }>,
      ) => {
        React.useImperativeHandle(ref, () => ({ resize: jest.fn() }));
        return (
          <textarea
            defaultValue={value}
            onChange={e => onChange?.(e.target.value)}
          />
        );
      },
    ),
  };
});

interface TestProps {
  name: string;
  label: string;
  value: AdhocFilter[];
  datasource: {
    type: string;
    database: { id: number };
    schema: string;
    datasource_name: string;
    [key: string]: unknown;
  };
  columns: Array<{
    column_name: string;
    type?: string;
    [key: string]: unknown;
  }>;
  onChange: jest.Mock;
  sections: string[];
  operators: string[];
  [key: string]: unknown;
}

const createProps = (): TestProps => ({
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

const renderComponent = (props: Partial<TestProps> = {}) =>
  render(
    <AdhocFilterControl
      {...(createProps() as Record<string, unknown>)}
      {...props}
    />,
    {
      useDnd: true,
      useRedux: true,
    },
  );

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('AdhocFilterControl', () => {
  test('should render with default props', () => {
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

  test('should show add filter button when no filters exist', () => {
    renderComponent();
    const addButton = screen.getByTestId('add-filter-button');
    expect(addButton).toBeInTheDocument();
  });

  test('should handle partition column data', async () => {
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

  test('should save a new simple filter built in the popover', async () => {
    const onChange = jest.fn();
    renderComponent({
      onChange,
      operators: [Operators.Equals, Operators.GreaterThan],
    });

    await userEvent.click(screen.getByTestId('add-filter-button'));
    expect(screen.getByRole('tab', { name: /simple/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await userEvent.click(await screen.findByTestId('select-element'));
    await userEvent.click(
      await screen.findByRole('option', { name: 'column1' }),
    );
    await userEvent.click(await screen.findByLabelText('Select operator'));
    await userEvent.click(
      await screen.findByRole('option', { name: /Equal to/ }),
    );
    await userEvent.type(
      screen.getByTestId('adhoc-filter-simple-value'),
      'abc',
    );
    await userEvent.click(
      screen.getByTestId('adhoc-filter-edit-popover-save-button'),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    const [[savedFilters]] = onChange.mock.calls;
    expect(savedFilters).toHaveLength(1);
    expect(savedFilters[0]).toEqual(
      expect.objectContaining({
        expressionType: ExpressionTypes.Simple,
        subject: 'column1',
        operator: '==',
        comparator: 'abc',
      }),
    );
    expect(await screen.findByText("column1 = 'abc'")).toBeInTheDocument();
  });

  test('should save a new custom SQL filter built in the popover', async () => {
    const onChange = jest.fn();
    renderComponent({ onChange });

    await userEvent.click(screen.getByTestId('add-filter-button'));
    await userEvent.click(screen.getByRole('tab', { name: /custom sql/i }));

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste('column2 > 5');
    await userEvent.click(
      screen.getByTestId('adhoc-filter-edit-popover-save-button'),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    const [[savedFilters]] = onChange.mock.calls;
    expect(savedFilters).toHaveLength(1);
    expect(savedFilters[0]).toEqual(
      expect.objectContaining({
        expressionType: ExpressionTypes.Sql,
        sqlExpression: 'column2 > 5',
        clause: Clauses.Where,
      }),
    );
    expect(await screen.findByText('column2 > 5')).toBeInTheDocument();
  });
});
