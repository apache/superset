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
  GenericDataType,
  QueryFormData,
} from '@superset-ui/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { TimeseriesDefaultFormData } from '@superset-ui/plugin-chart-echarts';

import {
  fireEvent,
  render,
  screen,
  within,
} from 'spec/helpers/testing-library';
import type { AsyncAceEditorProps } from 'src/components/AsyncAceEditor';
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
import { DndItemType } from '../../DndItemType';
import DatasourcePanelDragOption from '../../DatasourcePanel/DatasourcePanelDragOption';

jest.mock('src/components/AsyncAceEditor', () => ({
  ...jest.requireActual('src/components/AsyncAceEditor'),
  SQLEditor: (props: AsyncAceEditorProps) => (
    <div data-test="react-ace">{props.value}</div>
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
  render(setup(), { useDnd: true, store });
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
    useDnd: true,
    store,
  });
  expect(await screen.findByText('COUNT(*)')).toBeInTheDocument();
});

test('renders options with saved metric', async () => {
  render(
    setup({
      formData: {
        ...baseFormData,
        ...TimeseriesDefaultFormData,
        metrics: ['saved_metric'],
      },
    }),
    {
      useDnd: true,
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
      useDnd: true,
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
        ...TimeseriesDefaultFormData,
        metrics: [adhocMetric],
      },
    }),
    {
      useDnd: true,
      store,
    },
  );
  expect(
    await screen.findByText('Drop columns/metrics here or click'),
  ).toBeInTheDocument();
});

test('cannot drop a column that is not part of the simple column selection', () => {
  const adhocMetric = new AdhocMetric({
    expression: 'AVG(birth_names.num)',
    metric_name: 'avg__num',
  });
  const { getByTestId, getAllByTestId } = render(
    <>
      <DatasourcePanelDragOption
        value={{ column_name: 'order_date' }}
        type={DndItemType.Column}
      />
      <DatasourcePanelDragOption
        value={{ column_name: 'address_line1' }}
        type={DndItemType.Column}
      />
      <DatasourcePanelDragOption
        value={{ metric_name: 'metric_a', expression: 'AGG(metric_a)' }}
        type={DndItemType.Metric}
      />
      {setup({
        formData: {
          ...baseFormData,
          ...TimeseriesDefaultFormData,
          metrics: [adhocMetric],
        },
        columns: [{ column_name: 'order_date' }],
      })}
    </>,
    {
      useDnd: true,
      store,
    },
  );

  const selections = getAllByTestId('DatasourcePanelDragOption');
  const acceptableColumn = selections[0];
  const unacceptableColumn = selections[1];
  const metricType = selections[2];
  const currentMetric = getByTestId('dnd-labels-container');

  fireEvent.dragStart(unacceptableColumn);
  fireEvent.dragOver(currentMetric);
  fireEvent.drop(currentMetric);

  expect(screen.queryByTestId('filter-edit-popover')).not.toBeInTheDocument();

  fireEvent.dragStart(acceptableColumn);
  fireEvent.dragOver(currentMetric);
  fireEvent.drop(currentMetric);

  const filterConfigPopup = screen.getByTestId('filter-edit-popover');
  expect(within(filterConfigPopup).getByText('order_date')).toBeInTheDocument();

  fireEvent.keyDown(filterConfigPopup, {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27,
    charCode: 27,
  });
  expect(screen.queryByTestId('filter-edit-popover')).not.toBeInTheDocument();

  fireEvent.dragStart(metricType);
  fireEvent.dragOver(currentMetric);
  fireEvent.drop(currentMetric);

  expect(
    within(screen.getByTestId('filter-edit-popover')).getByTestId('react-ace'),
  ).toHaveTextContent('AGG(metric_a)');
});

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
    useDnd: true,
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
    useDnd: true,
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
    useDnd: true,
    store,
  });
  fireEvent.click(screen.getAllByTestId('remove-control-button')[0]);
  expect(canDelete).toHaveBeenCalled();
  expect(defaultProps.onChange).not.toHaveBeenCalled();
  expect(await screen.findByText('Test warning')).toBeInTheDocument();
});

describe('when disallow_adhoc_metrics is set', () => {
  test('can drop a column type from the simple column selection', () => {
    const adhocMetric = new AdhocMetric({
      expression: 'AVG(birth_names.num)',
      metric_name: 'avg__num',
    });
    const { getByTestId } = render(
      <>
        <DatasourcePanelDragOption
          value={{ column_name: 'column_b' }}
          type={DndItemType.Column}
        />
        {setup({
          formData: {
            ...baseFormData,
            ...TimeseriesDefaultFormData,
            metrics: [adhocMetric],
          },
          datasource: {
            ...PLACEHOLDER_DATASOURCE,
            extra: '{ "disallow_adhoc_metrics": true }',
          },
          columns: [{ column_name: 'column_a' }, { column_name: 'column_b' }],
        })}
      </>,
      {
        useDnd: true,
        store,
      },
    );

    const acceptableColumn = getByTestId('DatasourcePanelDragOption');
    const currentMetric = getByTestId('dnd-labels-container');

    fireEvent.dragStart(acceptableColumn);
    fireEvent.dragOver(currentMetric);
    fireEvent.drop(currentMetric);

    const filterConfigPopup = screen.getByTestId('filter-edit-popover');
    expect(within(filterConfigPopup).getByText('column_b')).toBeInTheDocument();
  });

  test('cannot drop any other types of selections apart from simple column selection', () => {
    const adhocMetric = new AdhocMetric({
      expression: 'AVG(birth_names.num)',
      metric_name: 'avg__num',
    });
    const { getByTestId, getAllByTestId } = render(
      <>
        <DatasourcePanelDragOption
          value={{ column_name: 'column_c' }}
          type={DndItemType.Column}
        />
        <DatasourcePanelDragOption
          value={{ metric_name: 'metric_a' }}
          type={DndItemType.Metric}
        />
        <DatasourcePanelDragOption
          value={{ metric_name: 'avg__num' }}
          type={DndItemType.AdhocMetricOption}
        />
        {setup({
          formData: {
            ...baseFormData,
            ...TimeseriesDefaultFormData,
            metrics: [adhocMetric],
          },
          datasource: {
            ...PLACEHOLDER_DATASOURCE,
            extra: '{ "disallow_adhoc_metrics": true }',
          },
          columns: [{ column_name: 'column_a' }, { column_name: 'column_c' }],
        })}
      </>,
      {
        useDnd: true,
        store,
      },
    );

    const selections = getAllByTestId('DatasourcePanelDragOption');
    const acceptableColumn = selections[0];
    const unacceptableMetric = selections[1];
    const unacceptableType = selections[2];
    const currentMetric = getByTestId('dnd-labels-container');

    fireEvent.dragStart(unacceptableMetric);
    fireEvent.dragOver(currentMetric);
    fireEvent.drop(currentMetric);

    expect(screen.queryByTestId('filter-edit-popover')).not.toBeInTheDocument();

    fireEvent.dragStart(unacceptableType);
    fireEvent.dragOver(currentMetric);
    fireEvent.drop(currentMetric);

    expect(screen.queryByTestId('filter-edit-popover')).not.toBeInTheDocument();

    fireEvent.dragStart(acceptableColumn);
    fireEvent.dragOver(currentMetric);
    fireEvent.drop(currentMetric);

    const filterConfigPopup = screen.getByTestId('filter-edit-popover');
    expect(within(filterConfigPopup).getByText('column_c')).toBeInTheDocument();
  });
});
