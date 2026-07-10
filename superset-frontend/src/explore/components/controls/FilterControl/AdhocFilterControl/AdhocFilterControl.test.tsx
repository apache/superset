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
import { useSortable } from '@dnd-kit/sortable';
import AdhocFilterControl from '.';
import AdhocFilter from '../AdhocFilter';
import { Clauses, ExpressionTypes } from '../types';
import {
  CapturedSortables,
  captureSortableData,
  simulateReorder,
} from '../../DndColumnSelectControl/dndTestUtils';

jest.mock('@dnd-kit/sortable', () => ({
  ...jest.requireActual('@dnd-kit/sortable'),
  useSortable: jest.fn(),
}));

const sortables: CapturedSortables = { items: [] };

beforeEach(() => {
  sortables.items = [];
  (useSortable as jest.Mock).mockImplementation(captureSortableData(sortables));
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

  test('reorder commits the new filter order to onChange, not the stale order', () => {
    // Pins the fast-drag persistence fix: resolveDragEnd fires the reorder
    // callback and the drop-commit in the same tick. A drop-commit closing over
    // the pre-drag `values` would re-commit the old order and revert the reorder
    // on reload. Assert the COMMITTED array, not just the rendered order.
    const filterA = new AdhocFilter({
      expressionType: ExpressionTypes.Sql,
      sqlExpression: 'expr_a',
      clause: Clauses.Having,
    });
    const filterB = new AdhocFilter({
      expressionType: ExpressionTypes.Sql,
      sqlExpression: 'expr_b',
      clause: Clauses.Having,
    });
    const filterC = new AdhocFilter({
      expressionType: ExpressionTypes.Sql,
      sqlExpression: 'expr_c',
      clause: Clauses.Having,
    });
    const onChange = jest.fn();

    renderComponent({ value: [filterA, filterB, filterC], onChange });

    // Move the first filter to the end: a multi-index move a swap would corrupt.
    simulateReorder(sortables, 0, 2);

    expect(onChange).toHaveBeenCalledTimes(1);
    const committed = (onChange.mock.calls[0][0] as AdhocFilter[]).map(
      filter => filter.sqlExpression,
    );
    expect(committed).toEqual(['expr_b', 'expr_c', 'expr_a']);
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
});
