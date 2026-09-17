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
import userEvent from '@testing-library/user-event';
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { DndMetricSelect } from 'src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { AGGREGATES } from 'src/explore/constants';
import { EXPRESSION_TYPES } from '../MetricControl/AdhocMetric';
import DatasourcePanelDragOption from '../../DatasourcePanel/DatasourcePanelDragOption';
import { DndItemType } from '../../DndItemType';

const defaultProps = {
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
  onChange: () => {},
};

const adhocMetricA = {
  expressionType: EXPRESSION_TYPES.SIMPLE,
  column: defaultProps.columns[0],
  aggregate: AGGREGATES.SUM,
  optionName: 'abc',
};
const adhocMetricB = {
  expressionType: EXPRESSION_TYPES.SIMPLE,
  column: defaultProps.columns[1],
  aggregate: AGGREGATES.SUM,
  optionName: 'def',
};

test('renders with default props', () => {
  render(<DndMetricSelect {...defaultProps} />, { useDnd: true });
  expect(
    screen.getByText('Drop a column/metric here or click'),
  ).toBeInTheDocument();
});

test('renders with default props and multi = true', () => {
  render(<DndMetricSelect {...defaultProps} multi />, { useDnd: true });
  expect(
    screen.getByText('Drop columns/metrics here or click'),
  ).toBeInTheDocument();
});

test('render selected metrics correctly', () => {
  const metricValues = ['metric_a', 'metric_b', adhocMetricB];
  render(<DndMetricSelect {...defaultProps} value={metricValues} multi />, {
    useDnd: true,
  });
  expect(screen.getByText('metric_a')).toBeVisible();
  expect(screen.getByText('Metric B')).toBeVisible();
  expect(screen.getByText('SUM(Column B)')).toBeVisible();
});

test('warn selected custom metric when metric gets removed from dataset', async () => {
  let metricValues = ['metric_a', 'metric_b', adhocMetricA, adhocMetricB];
  const onChange = (val: any[]) => {
    metricValues = val;
  };

  const { rerender, container } = render(
    <DndMetricSelect
      {...defaultProps}
      value={metricValues}
      onChange={onChange}
      multi
    />,
    {
      useDnd: true,
    },
  );

  const newPropsWithRemovedMetric = {
    ...defaultProps,
    savedMetrics: [
      {
        metric_name: 'metric_a',
        expression: 'expression_a',
      },
    ],
  };
  rerender(
    <DndMetricSelect
      {...newPropsWithRemovedMetric}
      value={metricValues}
      onChange={onChange}
      multi
    />,
  );
  expect(screen.getByText('metric_a')).toBeVisible();
  expect(screen.queryByText('Metric B')).not.toBeInTheDocument();
  expect(screen.queryByText('metric_b')).toBeInTheDocument();
  const warningIcon = within(
    screen.getByText('metric_b').parentElement ?? container,
  ).getByRole('button');
  expect(warningIcon).toBeInTheDocument();
  userEvent.hover(warningIcon);
  const warningTooltip = await screen.findByText(
    'This metric might be incompatible with current dataset',
  );
  expect(warningTooltip).toBeInTheDocument();
  expect(screen.getByText('SUM(column_a)')).toBeVisible();
  expect(screen.getByText('SUM(Column B)')).toBeVisible();
});

test('warn selected custom metric when metric gets removed from dataset for single-select metric control', async () => {
  let metricValue = 'metric_b';

  const onChange = (val: any) => {
    metricValue = val;
  };

  const { rerender, container } = render(
    <DndMetricSelect
      {...defaultProps}
      value={metricValue}
      onChange={onChange}
      multi={false}
    />,
    {
      useDnd: true,
    },
  );

  expect(screen.getByText('Metric B')).toBeVisible();
  expect(
    screen.queryByText('Drop a column/metric here or click'),
  ).not.toBeInTheDocument();

  const newPropsWithRemovedMetric = {
    ...defaultProps,
    savedMetrics: [
      {
        metric_name: 'metric_a',
        expression: 'expression_a',
      },
    ],
  };

  rerender(
    <DndMetricSelect
      {...newPropsWithRemovedMetric}
      value={metricValue}
      onChange={onChange}
      multi={false}
    />,
  );

  expect(screen.queryByText('Metric B')).not.toBeInTheDocument();
  expect(
    screen.queryByText('Drop a column/metric here or click'),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('metric_b')).toBeInTheDocument();
  const warningIcon = within(
    screen.getByText('metric_b').parentElement ?? container,
  ).getByRole('button');
  expect(warningIcon).toBeInTheDocument();
  userEvent.hover(warningIcon);
  const warningTooltip = await screen.findByText(
    'This metric might be incompatible with current dataset',
  );
  expect(warningTooltip).toBeInTheDocument();
});

test('remove selected adhoc metric when column gets removed from dataset', async () => {
  let metricValues = ['metric_a', 'metric_b', adhocMetricA, adhocMetricB];
  const onChange = (val: any[]) => {
    metricValues = val;
  };

  const { rerender } = render(
    <DndMetricSelect
      {...defaultProps}
      value={metricValues}
      onChange={onChange}
      multi
    />,
    {
      useDnd: true,
    },
  );

  const newPropsWithRemovedColumn = {
    ...defaultProps,
    columns: [
      {
        column_name: 'column_a',
      },
    ],
  };

  rerender(
    <DndMetricSelect
      {...newPropsWithRemovedColumn}
      value={metricValues}
      onChange={onChange}
      multi
    />,
  );

  expect(screen.getByText('metric_a')).toBeVisible();
  expect(screen.getByText('Metric B')).toBeVisible();
  expect(screen.getByText('SUM(column_a)')).toBeVisible();
  expect(screen.queryByText('SUM(Column B)')).not.toBeInTheDocument();
});

test('update adhoc metric name when column label in dataset changes', () => {
  let metricValues = ['metric_a', 'metric_b', adhocMetricA, adhocMetricB];
  const onChange = (val: any[]) => {
    metricValues = val;
  };

  const { rerender } = render(
    <DndMetricSelect
      {...defaultProps}
      value={metricValues}
      onChange={onChange}
      multi
    />,
    {
      useDnd: true,
    },
  );

  const newPropsWithUpdatedColNames = {
    ...defaultProps,
    columns: [
      {
        column_name: 'column_a',
        verbose_name: 'new col A name',
      },
      {
        column_name: 'column_b',
        verbose_name: 'new col B name',
      },
    ],
  };

  // rerender twice - first to update columns, second to update value
  rerender(
    <DndMetricSelect
      {...newPropsWithUpdatedColNames}
      value={metricValues}
      onChange={onChange}
      multi
    />,
  );
  rerender(
    <DndMetricSelect
      {...newPropsWithUpdatedColNames}
      value={metricValues}
      onChange={onChange}
      multi
    />,
  );

  expect(screen.getByText('metric_a')).toBeVisible();
  expect(screen.getByText('Metric B')).toBeVisible();
  expect(screen.getByText('SUM(new col A name)')).toBeVisible();
  expect(screen.getByText('SUM(new col B name)')).toBeVisible();
});

test('can drag metrics', async () => {
  const metricValues = ['metric_a', 'metric_b', adhocMetricB];
  render(<DndMetricSelect {...defaultProps} value={metricValues} multi />, {
    useDnd: true,
  });

  expect(screen.getByText('metric_a')).toBeVisible();
  expect(screen.getByText('Metric B')).toBeVisible();

  const container = screen.getByTestId('dnd-labels-container');
  expect(container.childElementCount).toBe(4);

  const firstMetric = container.children[0] as HTMLElement;
  const lastMetric = container.children[2] as HTMLElement;
  expect(within(firstMetric).getByText('metric_a')).toBeVisible();
  expect(within(lastMetric).getByText('SUM(Column B)')).toBeVisible();

  fireEvent.mouseOver(within(firstMetric).getByText('metric_a'));
  expect(await screen.findByText('Metric name')).toBeInTheDocument();

  fireEvent.dragStart(firstMetric);
  fireEvent.dragEnter(lastMetric);
  fireEvent.dragOver(lastMetric);
  fireEvent.drop(lastMetric);

  expect(within(firstMetric).getByText('SUM(Column B)')).toBeVisible();
  expect(within(lastMetric).getByText('metric_a')).toBeVisible();
});

test('cannot drop a duplicated item', () => {
  const metricValues = ['metric_a'];
  const { getByTestId } = render(
    <>
      <DatasourcePanelDragOption
        value={{ metric_name: 'metric_a' }}
        type={DndItemType.Metric}
      />
      <DndMetricSelect {...defaultProps} value={metricValues} multi />
    </>,
    {
      useDnd: true,
    },
  );

  const acceptableMetric = getByTestId('DatasourcePanelDragOption');
  const currentMetric = getByTestId('dnd-labels-container');

  const currentMetricSelection = currentMetric.children.length;

  fireEvent.dragStart(acceptableMetric);
  fireEvent.dragOver(currentMetric);
  fireEvent.drop(currentMetric);

  expect(currentMetric.children).toHaveLength(currentMetricSelection);
  expect(currentMetric).toHaveTextContent('metric_a');
});

test('can drop a saved metric when disallow_adhoc_metrics', () => {
  const metricValues = ['metric_b'];
  const { getByTestId } = render(
    <>
      <DatasourcePanelDragOption
        value={{ metric_name: 'metric_a' }}
        type={DndItemType.Metric}
      />
      <DndMetricSelect
        {...defaultProps}
        value={metricValues}
        multi
        datasource={{ extra: '{ "disallow_adhoc_metrics": true }' }}
      />
    </>,
    {
      useDnd: true,
    },
  );

  const acceptableMetric = getByTestId('DatasourcePanelDragOption');
  const currentMetric = getByTestId('dnd-labels-container');

  const currentMetricSelection = currentMetric.children.length;

  fireEvent.dragStart(acceptableMetric);
  fireEvent.dragOver(currentMetric);
  fireEvent.drop(currentMetric);

  expect(currentMetric.children).toHaveLength(currentMetricSelection + 1);
  expect(currentMetric.children[1]).toHaveTextContent('metric_a');
});

test('cannot drop non-saved metrics when disallow_adhoc_metrics', () => {
  const metricValues = ['metric_b'];
  const { getByTestId, getAllByTestId } = render(
    <>
      <DatasourcePanelDragOption
        value={{ metric_name: 'metric_a' }}
        type={DndItemType.Metric}
      />
      <DatasourcePanelDragOption
        value={{ metric_name: 'metric_c' }}
        type={DndItemType.Metric}
      />
      <DatasourcePanelDragOption
        value={{ column_name: 'column_1' }}
        type={DndItemType.Column}
      />
      <DndMetricSelect
        {...defaultProps}
        value={metricValues}
        multi
        datasource={{ extra: '{ "disallow_adhoc_metrics": true }' }}
      />
    </>,
    {
      useDnd: true,
    },
  );

  const selections = getAllByTestId('DatasourcePanelDragOption');
  const acceptableMetric = selections[0];
  const unacceptableMetric = selections[1];
  const unacceptableType = selections[2];
  const currentMetric = getByTestId('dnd-labels-container');

  const currentMetricSelection = currentMetric.children.length;

  fireEvent.dragStart(unacceptableMetric);
  fireEvent.dragOver(currentMetric);
  fireEvent.drop(currentMetric);

  expect(currentMetric.children).toHaveLength(currentMetricSelection);
  expect(currentMetric).not.toHaveTextContent('metric_c');

  fireEvent.dragStart(unacceptableType);
  fireEvent.dragOver(currentMetric);
  fireEvent.drop(currentMetric);

  expect(currentMetric.children).toHaveLength(currentMetricSelection);
  expect(currentMetric).not.toHaveTextContent('column_1');

  fireEvent.dragStart(acceptableMetric);
  fireEvent.dragOver(currentMetric);
  fireEvent.drop(currentMetric);

  expect(currentMetric.children).toHaveLength(currentMetricSelection + 1);
  expect(currentMetric).toHaveTextContent('metric_a');
});

test('title changes on custom SQL text change', async () => {
  let metricValues = [adhocMetricA, 'metric_b'];
  const onChange = (val: any[]) => {
    metricValues = [...val];
  };

  const { rerender } = render(
    <DndMetricSelect
      {...defaultProps}
      value={metricValues}
      onChange={onChange}
      multi
    />,
    {
      useDnd: true,
    },
  );

  expect(screen.getByText('SUM(column_a)')).toBeVisible();

  metricValues = [adhocMetricA, 'metric_b', 'metric_a'];
  rerender(
    <DndMetricSelect
      {...defaultProps}
      value={metricValues}
      onChange={onChange}
      multi
    />,
  );

  expect(screen.getByText('SUM(column_a)')).toBeVisible();
  expect(screen.getByText('metric_a')).toBeVisible();

  fireEvent.click(screen.getByText('metric_a'));
  expect(await screen.findByText('Custom SQL')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Custom SQL'));
  expect(screen.getByText('Custom SQL').parentElement).toHaveClass(
    'ant-tabs-tab-active',
  );

  const container = screen.getByTestId('adhoc-metric-edit-tabs');
  await waitFor(() => {
    const textArea = container.getElementsByClassName(
      'ace_text-input',
    ) as HTMLCollectionOf<HTMLTextAreaElement>;
    expect(textArea.length).toBe(1);
    expect(textArea[0].value).toBe('');
  });

  expect(screen.getByTestId('AdhocMetricEditTitle#trigger')).toHaveTextContent(
    'metric_a',
  );

  const textArea = container.getElementsByClassName(
    'ace_text-input',
  )[0] as HTMLTextAreaElement;

  // Changing the ACE editor via pasting, since the component
  // handles the textarea value internally, and changing it doesn't
  // trigger the onChange
  await userEvent.paste(textArea, 'New metric');

  await waitFor(() => {
    expect(
      screen.getByTestId('AdhocMetricEditTitle#trigger'),
    ).toHaveTextContent('New metric');
  });

  // Ensure the title does not reset on mouse over
  fireEvent.mouseEnter(screen.getByTestId('AdhocMetricEditTitle#trigger'));
  fireEvent.mouseOut(screen.getByTestId('AdhocMetricEditTitle#trigger'));

  expect(screen.getByTestId('AdhocMetricEditTitle#trigger')).toHaveTextContent(
    'New metric',
  );
});
