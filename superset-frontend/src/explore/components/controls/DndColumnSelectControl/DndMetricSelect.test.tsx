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
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { Metric } from '@superset-ui/core';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import {
  DndMetricSelect,
  coerceMetrics,
} from 'src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { AGGREGATES } from 'src/explore/constants';
import AdhocMetric, { EXPRESSION_TYPES } from '../MetricControl/AdhocMetric';
import { DndItemType } from '../../DndItemType';
import {
  CapturedDroppable,
  CapturedSortables,
  captureDroppableData,
  captureSortableData,
  simulateDrop,
  simulateReorder,
} from './dndTestUtils';

const captured: CapturedDroppable = { current: undefined };
const sortables: CapturedSortables = { items: [] };

jest.mock('@dnd-kit/core', () => ({
  ...jest.requireActual('@dnd-kit/core'),
  useDroppable: jest.fn(),
}));

jest.mock('@dnd-kit/sortable', () => ({
  ...jest.requireActual('@dnd-kit/sortable'),
  useSortable: jest.fn(),
}));

beforeEach(() => {
  captured.current = undefined;
  sortables.items = [];
  (useDroppable as jest.Mock).mockImplementation(
    captureDroppableData(captured),
  );
  (useSortable as jest.Mock).mockImplementation(captureSortableData(sortables));
});

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

test('coerceMetrics regenerates duplicate optionNames so each metric stays unique', () => {
  // A saved chart can carry two adhoc metrics with the same optionName (e.g.
  // born from a duplicated metric). Since edits are matched by optionName, the
  // duplicates must be split apart on load or editing one overwrites the other.
  const dup = 'shared_option';
  const result = coerceMetrics(
    [
      {
        expressionType: EXPRESSION_TYPES.SIMPLE,
        column: defaultProps.columns[0],
        aggregate: AGGREGATES.SUM,
        optionName: dup,
      },
      {
        expressionType: EXPRESSION_TYPES.SIMPLE,
        column: defaultProps.columns[1],
        aggregate: AGGREGATES.AVG,
        optionName: dup,
      },
    ] as any,
    defaultProps.savedMetrics as unknown as Metric[],
    defaultProps.columns,
  ) as AdhocMetric[];

  expect(result).toHaveLength(2);
  // First keeps the optionName, second is regenerated to avoid the collision.
  expect(result[0].optionName).toBe(dup);
  expect(result[1].optionName).not.toBe(dup);
  // Each metric definition is otherwise preserved.
  expect(result[0].aggregate).toBe(AGGREGATES.SUM);
  expect(result[1].aggregate).toBe(AGGREGATES.AVG);
});

test('coerceMetrics regenerates duplicate optionNames for SQL adhoc metrics too', () => {
  // The same collision can happen with custom SQL metrics, which take a
  // different code path than column-backed metrics but must dedupe the same way.
  const dup = 'shared_option';
  const result = coerceMetrics(
    [
      {
        expressionType: EXPRESSION_TYPES.SQL,
        sqlExpression: 'COUNT(*)',
        label: 'count',
        optionName: dup,
      },
      {
        expressionType: EXPRESSION_TYPES.SQL,
        sqlExpression: 'SUM(value)',
        label: 'total',
        optionName: dup,
      },
    ] as any,
    defaultProps.savedMetrics as unknown as Metric[],
    defaultProps.columns,
  ) as AdhocMetric[];

  expect(result).toHaveLength(2);
  expect(result[0].optionName).toBe(dup);
  expect(result[1].optionName).not.toBe(dup);
  // Each metric definition is otherwise preserved.
  expect(result[0].sqlExpression).toBe('COUNT(*)');
  expect(result[1].sqlExpression).toBe('SUM(value)');
});

test('renders with default props', () => {
  render(<DndMetricSelect {...defaultProps} />, {
    useDndKit: true,
    useRedux: true,
  });
  expect(
    screen.getByText('Drop a column/metric here or click'),
  ).toBeInTheDocument();
});

test('renders with default props and multi = true', () => {
  render(<DndMetricSelect {...defaultProps} multi />, {
    useDndKit: true,
    useRedux: true,
  });
  expect(
    screen.getByText('Drop columns/metrics here or click'),
  ).toBeInTheDocument();
});

test('render selected metrics correctly', () => {
  const metricValues = ['metric_a', 'metric_b', adhocMetricB];
  render(<DndMetricSelect {...defaultProps} value={metricValues} multi />, {
    useDndKit: true,
    useRedux: true,
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
      useDndKit: true,
      useRedux: true,
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
      useDndKit: true,
      useRedux: true,
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
      useDndKit: true,
      useRedux: true,
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
      useDndKit: true,
      useRedux: true,
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

// Drop behavior is exercised through `resolveDragEnd` (the production drag-end
// dispatcher) because @dnd-kit's PointerSensor needs real layout that jsdom
// cannot provide. See ./dndTestUtils and ExploreDndContext.test.tsx.

test('can drag metrics (reorder dispatches through the reorder + drop path)', () => {
  const onChange = jest.fn();
  render(
    <DndMetricSelect
      {...defaultProps}
      value={['metric_a', 'metric_b', adhocMetricB]}
      onChange={onChange}
      multi
    />,
    { useDndKit: true, useRedux: true },
  );

  // DndMetricSelect reorders via moveLabel, which arrayMoves the metrics and
  // commits the new order itself through onChange (onDropLabel no longer
  // persists anything). Verify the reorder callback is registered and that a
  // non-adjacent drag (0 -> 2) commits the fully moved order, not a swap.
  expect(sortables.items.length).toBeGreaterThanOrEqual(3);
  expect(typeof sortables.items[0].onMoveLabel).toBe('function');

  simulateReorder(sortables, 0, 2);
  expect(onChange).toHaveBeenCalledTimes(1);
  const committed = onChange.mock.calls[0][0];
  // arrayMove(['metric_a','metric_b',adhoc], 0, 2) => ['metric_b',adhoc,'metric_a']
  expect(committed[0]).toBe('metric_b');
  expect(committed[committed.length - 1]).toBe('metric_a');
});

test('cannot drop a duplicated item', () => {
  const onChange = jest.fn();
  render(
    <DndMetricSelect
      {...defaultProps}
      value={['metric_a']}
      onChange={onChange}
      multi
    />,
    { useDndKit: true, useRedux: true },
  );

  simulateDrop(captured, {
    type: DndItemType.Metric,
    value: { metric_name: 'metric_a' } as any,
  });

  expect(onChange).not.toHaveBeenCalled();
});

test('can drop a saved metric when disallow_adhoc_metrics', () => {
  const onChange = jest.fn();
  render(
    <DndMetricSelect
      {...defaultProps}
      value={['metric_b']}
      onChange={onChange}
      multi
      datasource={{ extra: '{ "disallow_adhoc_metrics": true }' } as any}
    />,
    { useDndKit: true, useRedux: true },
  );

  simulateDrop(captured, {
    type: DndItemType.Metric,
    value: { metric_name: 'metric_a' } as any,
  });

  expect(onChange).toHaveBeenLastCalledWith(['metric_b', 'metric_a']);
});

test('cannot drop non-saved metrics when disallow_adhoc_metrics', () => {
  const onChange = jest.fn();
  render(
    <DndMetricSelect
      {...defaultProps}
      value={['metric_b']}
      onChange={onChange}
      multi
      datasource={{ extra: '{ "disallow_adhoc_metrics": true }' } as any}
    />,
    { useDndKit: true, useRedux: true },
  );

  // Non-saved metric -> rejected.
  simulateDrop(captured, {
    type: DndItemType.Metric,
    value: { metric_name: 'metric_c' } as any,
  });
  expect(onChange).not.toHaveBeenCalled();

  // Column type -> rejected when adhoc metrics are disallowed.
  simulateDrop(captured, {
    type: DndItemType.Column,
    value: { column_name: 'column_a' } as any,
  });
  expect(onChange).not.toHaveBeenCalled();

  // Saved metric -> accepted.
  simulateDrop(captured, {
    type: DndItemType.Metric,
    value: { metric_name: 'metric_a' } as any,
  });
  expect(onChange).toHaveBeenLastCalledWith(['metric_b', 'metric_a']);
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
      useDndKit: true,
      useRedux: true,
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

  // Wait for the editor to render after tab switch
  const textArea = (await screen.findByRole('textbox')) as HTMLTextAreaElement;

  expect(screen.getByTestId('AdhocMetricEditTitle#trigger')).toHaveTextContent(
    'metric_a',
  );

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
