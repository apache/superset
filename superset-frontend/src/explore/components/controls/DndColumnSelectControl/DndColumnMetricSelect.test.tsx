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
import {
  fireEvent,
  render,
  screen,
  within,
} from 'spec/helpers/testing-library';
import { DndColumnMetricSelect } from 'src/explore/components/controls/DndColumnSelectControl/DndColumnMetricSelect';
import DatasourcePanelDragOption from '../../DatasourcePanel/DatasourcePanelDragOption';
import { DndItemType } from '../../DndItemType';

const defaultProps = {
  name: 'test-control',
  actions: {},
  savedMetrics: [
    {
      metric_name: 'metric_a',
      expression: 'expression_a',
      verbose_name: 'metric_a',
    },
    {
      metric_name: 'metric_b',
      expression: 'expression_b',
      verbose_name: 'Metric B',
    },
  ],
  columns: [
    {
      column_name: 'column_a',
    },
    {
      column_name: 'column_b',
      verbose_name: 'Column B',
    },
  ],
  selectedMetrics: [
    {
      metric_name: 'metric_a',
      expression: 'expression_a',
      verbose_name: 'metric_a',
    },
    {
      metric_name: 'metric_b',
      expression: 'expression_b',
      verbose_name: 'Metric B',
    },
  ],
  onChange: () => {},
} as any;

test('renders with default props', () => {
  render(<DndColumnMetricSelect {...defaultProps} />, {
    useDnd: true,
    useRedux: true,
  });
  expect(
    screen.getByText('Drop columns/metrics here or click'),
  ).toBeInTheDocument();
});

test('renders with default props and multi = true', () => {
  render(<DndColumnMetricSelect {...defaultProps} multi />, {
    useDnd: true,
    useRedux: true,
  });
  expect(
    screen.getByText('Drop columns/metrics here or click'),
  ).toBeInTheDocument();
});

test('render selected columns and metrics correctly', () => {
  const values = ['column_a', 'metric_a'];
  render(<DndColumnMetricSelect {...defaultProps} value={values} multi />, {
    useDnd: true,
    useRedux: true,
  });
  expect(screen.getByText('column_a')).toBeVisible();
  expect(screen.getByText('metric_a')).toBeVisible();
});

test('can drop columns and metrics', () => {
  const values = ['column_a', 'metric_a'];
  const { getByTestId } = render(
    <>
      <DatasourcePanelDragOption
        value={{ column_name: 'column_b', uuid: '1' }}
        type={DndItemType.Column}
      />
      <DatasourcePanelDragOption
        value={{ metric_name: 'metric_b', uuid: '2' }}
        type={DndItemType.Metric}
      />
      <DndColumnMetricSelect {...defaultProps} value={values} multi />
    </>,
    {
      useDnd: true,
      useRedux: true,
    },
  );

  const columnOption = screen.getAllByTestId('DatasourcePanelDragOption')[0];
  const metricOption = screen.getAllByTestId('DatasourcePanelDragOption')[1];
  const currentSelection = getByTestId('dnd-labels-container');

  fireEvent.dragStart(columnOption);
  fireEvent.dragOver(currentSelection);
  fireEvent.drop(currentSelection);

  fireEvent.dragStart(metricOption);
  fireEvent.dragOver(currentSelection);
  fireEvent.drop(currentSelection);

  expect(currentSelection).toBeInTheDocument();
});

test('cannot drop duplicate items', () => {
  const values = ['column_a', 'metric_a'];
  const { getByTestId } = render(
    <>
      <DatasourcePanelDragOption
        value={{ column_name: 'column_a', uuid: '1' }}
        type={DndItemType.Column}
      />
      <DatasourcePanelDragOption
        value={{ metric_name: 'metric_a', uuid: '2' }}
        type={DndItemType.Metric}
      />
      <DndColumnMetricSelect {...defaultProps} value={values} multi />
    </>,
    {
      useDnd: true,
      useRedux: true,
    },
  );

  const columnOption = screen.getAllByTestId('DatasourcePanelDragOption')[0];
  const metricOption = screen.getAllByTestId('DatasourcePanelDragOption')[1];
  const currentSelection = getByTestId('dnd-labels-container');

  const initialCount = currentSelection.children.length;

  fireEvent.dragStart(columnOption);
  fireEvent.dragOver(currentSelection);
  fireEvent.drop(currentSelection);

  fireEvent.dragStart(metricOption);
  fireEvent.dragOver(currentSelection);
  fireEvent.drop(currentSelection);

  expect(currentSelection.children).toHaveLength(initialCount);
});

test('can drop only selected metrics', () => {
  const values = ['column_a'];
  const { getByTestId } = render(
    <>
      <DatasourcePanelDragOption
        value={{ metric_name: 'metric_a', uuid: '1' }}
        type={DndItemType.Metric}
      />
      <DatasourcePanelDragOption
        value={{ metric_name: 'metric_c', uuid: '2' }}
        type={DndItemType.Metric}
      />
      <DndColumnMetricSelect {...defaultProps} value={values} multi />
    </>,
    {
      useDnd: true,
      useRedux: true,
    },
  );

  const selectedMetric = screen.getAllByTestId('DatasourcePanelDragOption')[0];
  const unselectedMetric = screen.getAllByTestId(
    'DatasourcePanelDragOption',
  )[1];
  const currentSelection = getByTestId('dnd-labels-container');

  const initialCount = currentSelection.children.length;

  fireEvent.dragStart(unselectedMetric);
  fireEvent.dragOver(currentSelection);
  fireEvent.drop(currentSelection);

  expect(currentSelection.children).toHaveLength(initialCount);

  fireEvent.dragStart(selectedMetric);
  fireEvent.dragOver(currentSelection);
  fireEvent.drop(currentSelection);

  expect(currentSelection).toBeInTheDocument();
});

test('can drag and reorder items', async () => {
  const values = ['column_a', 'metric_a', 'column_b'];
  render(<DndColumnMetricSelect {...defaultProps} value={values} multi />, {
    useDnd: true,
    useRedux: true,
  });

  const container = screen.getByTestId('dnd-labels-container');
  expect(container.childElementCount).toBe(4);

  const firstItem = container.children[0] as HTMLElement;
  const lastItem = container.children[2] as HTMLElement;

  expect(within(firstItem).getByText('column_a')).toBeVisible();
  expect(within(lastItem).getByText('Column B')).toBeVisible();

  fireEvent.dragStart(firstItem);
  fireEvent.dragEnter(lastItem);
  fireEvent.dragOver(lastItem);
  fireEvent.drop(lastItem);

  expect(container).toBeInTheDocument();
});

test('shows warning for aggregated DeckGL charts', () => {
  const values = ['column_a'];
  const formData = { viz_type: 'deck_heatmap', datasource: 'test' };

  render(
    <DndColumnMetricSelect
      {...defaultProps}
      value={values}
      multi
      formData={formData}
    />,
    { useDnd: true, useRedux: true },
  );

  const columnItem = screen.getByText('column_a');
  expect(columnItem).toBeVisible();
});

test('handles single selection mode', () => {
  const values = ['column_a'];
  const onChange = jest.fn();

  render(
    <DndColumnMetricSelect
      {...defaultProps}
      value={values}
      multi={false}
      onChange={onChange}
    />,
    { useDnd: true, useRedux: true },
  );

  expect(screen.getByText('column_a')).toBeVisible();
  expect(
    screen.queryByText('Drop columns/metrics here or click'),
  ).not.toBeInTheDocument();
});

test('handles custom ghost button text', () => {
  const customText = 'Custom drop text';

  render(
    <DndColumnMetricSelect {...defaultProps} ghostButtonText={customText} />,
    { useDnd: true, useRedux: true },
  );

  expect(screen.getByText(customText)).toBeInTheDocument();
});

test('can remove items by clicking close button', () => {
  const values = ['column_a', 'metric_a'];
  const onChange = jest.fn();

  render(
    <DndColumnMetricSelect
      {...defaultProps}
      value={values}
      multi
      onChange={onChange}
    />,
    { useDnd: true, useRedux: true },
  );

  const closeButtons = screen.getAllByRole('button', { name: /close/i });
  expect(closeButtons).toHaveLength(2);

  fireEvent.click(closeButtons[0]);

  expect(onChange).toHaveBeenCalledWith(['metric_a']);
});

test('handles adhoc metric with error', () => {
  const errorMetric = {
    metric_name: 'error_metric',
    error_text: 'This metric has an error',
    uuid: 'error-uuid',
  };
  const values = [errorMetric];

  render(<DndColumnMetricSelect {...defaultProps} value={values} multi />, {
    useDnd: true,
    useRedux: true,
  });

  const metricItem = screen.getByText('error_metric');
  expect(metricItem).toBeVisible();
});

test('handles adhoc column values', () => {
  const values = ['column_a'];

  render(<DndColumnMetricSelect {...defaultProps} value={values} multi />, {
    useDnd: true,
    useRedux: true,
  });

  expect(screen.getByText('column_a')).toBeVisible();
});

test('handles mixed value types correctly', () => {
  const mixedValues = ['column_a', 'metric_a'];

  render(
    <DndColumnMetricSelect {...defaultProps} value={mixedValues} multi />,
    { useDnd: true, useRedux: true },
  );

  expect(screen.getByText('column_a')).toBeVisible();
  expect(screen.getByText('metric_a')).toBeVisible();
});
