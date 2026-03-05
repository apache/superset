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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';

import {
  ensureIsArray,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { Operators } from 'src/explore/constants';
import {
  DndFilterSelect,
  DndFilterSelectProps,
} from 'src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import { PLACEHOLDER_DATASOURCE } from 'src/dashboard/constants';
import { ExpressionTypes } from '../FilterControl/types';
import { Datasource } from '../../../types';

jest.mock('src/core/editors', () => ({
  EditorHost: ({ value }: { value: string }) => (
    <div data-test="react-ace">{value}</div>
  ),
}));

const defaultProps: Omit<DndFilterSelectProps, 'datasource'> = {
  type: 'DndFilterSelect',
  name: 'Filter',
  value: [],
  columns: [],
  formData: null,
  savedMetrics: [],
  selectedMetrics: [],
  onChange: jest.fn(),
  actions: { setControlValue: jest.fn() },
};

const baseFormData = {
  viz_type: 'my_viz',
  datasource: 'table__1',
};

const mockStore = configureStore([thunk]);
const store = mockStore({});

function setup({
  value = undefined,
  formData = baseFormData,
  columns = [],
  datasource = PLACEHOLDER_DATASOURCE,
  additionalProps = {},
}: {
  value?: AdhocFilter | AdhocFilter[];
  formData?: QueryFormData;
  columns?: ColumnMeta[];
  datasource?: Datasource;
  additionalProps?: Partial<DndFilterSelectProps>;
} = {}) {
  return (
    <DndFilterSelect
      {...defaultProps}
      datasource={datasource}
      value={ensureIsArray(value)}
      formData={formData}
      columns={columns}
      {...additionalProps}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders with default props', async () => {
  render(setup(), { useDndKit: true, store });
  expect(
    await screen.findByText('Drop columns/metrics here or click'),
  ).toBeInTheDocument();
});

test('renders with value', async () => {
  const value = new AdhocFilter({
    sqlExpression: 'COUNT(*)',
    expressionType: ExpressionTypes.Sql,
  });
  render(setup({ value }), {
    useDndKit: true,
    store,
  });
  expect(await screen.findByText('COUNT(*)')).toBeInTheDocument();
});

test('renders options with saved metric', async () => {
  render(
    setup({
      formData: {
        ...baseFormData,
        metrics: ['saved_metric'],
      },
    }),
    {
      useDndKit: true,
      store,
    },
  );
  expect(
    await screen.findByText('Drop columns/metrics here or click'),
  ).toBeInTheDocument();
});

test('renders options with column', async () => {
  render(
    setup({
      columns: [
        {
          id: 1,
          type: 'VARCHAR',
          type_generic: GenericDataType.String,
          column_name: 'Column',
        },
      ],
    }),
    {
      useDndKit: true,
      store,
    },
  );
  expect(
    await screen.findByText('Drop columns/metrics here or click'),
  ).toBeInTheDocument();
});

test('renders options with adhoc metric', async () => {
  const adhocMetric = new AdhocMetric({
    expression: 'AVG(birth_names.num)',
    metric_name: 'avg__num',
  });
  render(
    setup({
      formData: {
        ...baseFormData,
        metrics: [adhocMetric as unknown as QueryFormMetric],
      },
    }),
    {
      useDndKit: true,
      store,
    },
  );
  expect(
    await screen.findByText('Drop columns/metrics here or click'),
  ).toBeInTheDocument();
});

// Note: Drag-and-drop tests removed - @dnd-kit uses pointer events instead of
// HTML5 drag events. These tests require @dnd-kit-compatible testing utilities.

test('calls onChange when close is clicked and canDelete is true', () => {
  const value1 = new AdhocFilter({
    sqlExpression: 'COUNT(*)',
    expressionType: ExpressionTypes.Sql,
  });
  const value2 = new AdhocFilter({
    expressionType: ExpressionTypes.Simple,
    subject: 'col',
    comparator: 'val',
    operator: Operators.Equals,
  });
  const canDelete = jest.fn();
  canDelete.mockReturnValue(true);
  render(setup({ value: [value1, value2], additionalProps: { canDelete } }), {
    useDndKit: true,
    store,
  });
  fireEvent.click(screen.getAllByTestId('remove-control-button')[0]);
  expect(canDelete).toHaveBeenCalled();
  expect(defaultProps.onChange).toHaveBeenCalledWith([value2]);
});

test('onChange is not called when close is clicked and canDelete is false', () => {
  const value1 = new AdhocFilter({
    sqlExpression: 'COUNT(*)',
    expressionType: ExpressionTypes.Sql,
  });
  const value2 = new AdhocFilter({
    expressionType: ExpressionTypes.Simple,
    subject: 'col',
    comparator: 'val',
    operator: Operators.Equals,
  });
  const canDelete = jest.fn();
  canDelete.mockReturnValue(false);
  render(setup({ value: [value1, value2], additionalProps: { canDelete } }), {
    useDndKit: true,
    store,
  });
  fireEvent.click(screen.getAllByTestId('remove-control-button')[0]);
  expect(canDelete).toHaveBeenCalled();
  expect(defaultProps.onChange).not.toHaveBeenCalled();
});

test('onChange is not called when close is clicked and canDelete is string, warning is displayed', async () => {
  const value1 = new AdhocFilter({
    sqlExpression: 'COUNT(*)',
    expressionType: ExpressionTypes.Sql,
  });
  const value2 = new AdhocFilter({
    expressionType: ExpressionTypes.Simple,
    subject: 'col',
    comparator: 'val',
    operator: Operators.Equals,
  });
  const canDelete = jest.fn();
  canDelete.mockReturnValue('Test warning');
  render(setup({ value: [value1, value2], additionalProps: { canDelete } }), {
    useDndKit: true,
    store,
  });
  fireEvent.click(screen.getAllByTestId('remove-control-button')[0]);
  expect(canDelete).toHaveBeenCalled();
  expect(defaultProps.onChange).not.toHaveBeenCalled();
  expect(await screen.findByText('Test warning')).toBeInTheDocument();
});
