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
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import { DndColumnMetricSelect } from 'src/explore/components/controls/DndColumnSelectControl/DndColumnMetricSelect';
import { DndItemType } from 'src/explore/components/DndItemType';
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
    useDndKit: true,
    useRedux: true,
  });
  expect(
    screen.getByText('Drop columns/metrics here or click'),
  ).toBeInTheDocument();
});

test('renders with default props and multi = true', () => {
  render(<DndColumnMetricSelect {...defaultProps} multi />, {
    useDndKit: true,
    useRedux: true,
  });
  expect(
    screen.getByText('Drop columns/metrics here or click'),
  ).toBeInTheDocument();
});

test('render selected columns and metrics correctly', () => {
  const values = ['column_a', 'metric_a'];
  render(<DndColumnMetricSelect {...defaultProps} value={values} multi />, {
    useDndKit: true,
    useRedux: true,
  });
  expect(screen.getByText('column_a')).toBeVisible();
  expect(screen.getByText('metric_a')).toBeVisible();
});

// Drop behavior is exercised through `resolveDragEnd` (the production drag-end
// dispatcher) because @dnd-kit's PointerSensor needs real layout that jsdom
// cannot provide. See ./dndTestUtils and ExploreDndContext.test.tsx.

test('can drop columns and metrics', () => {
  const onChange = jest.fn();
  render(
    <DndColumnMetricSelect
      {...defaultProps}
      value={['column_a', 'metric_a']}
      onChange={onChange}
      multi
    />,
    { useDndKit: true, useRedux: true },
  );

  simulateDrop(captured, {
    type: DndItemType.Column,
    value: { column_name: 'column_b' } as any,
  });
  expect(onChange).toHaveBeenLastCalledWith([
    'column_a',
    'metric_a',
    'column_b',
  ]);

  simulateDrop(captured, {
    type: DndItemType.Metric,
    value: { metric_name: 'metric_b' } as any,
  });
  expect(onChange).toHaveBeenLastCalledWith([
    'column_a',
    'metric_a',
    'metric_b',
  ]);
});

test('cannot drop duplicate items', () => {
  const onChange = jest.fn();
  render(
    <DndColumnMetricSelect
      {...defaultProps}
      value={['column_a', 'metric_a']}
      onChange={onChange}
      multi
    />,
    { useDndKit: true, useRedux: true },
  );

  simulateDrop(captured, {
    type: DndItemType.Column,
    value: { column_name: 'column_a' } as any,
  });
  simulateDrop(captured, {
    type: DndItemType.Metric,
    value: { metric_name: 'metric_a' } as any,
  });

  expect(onChange).not.toHaveBeenCalled();
});

test('can drop only selected metrics', () => {
  const onChange = jest.fn();
  render(
    <DndColumnMetricSelect
      {...defaultProps}
      value={['column_a']}
      onChange={onChange}
      multi
    />,
    { useDndKit: true, useRedux: true },
  );

  // metric_c is not in selectedMetrics -> rejected
  simulateDrop(captured, {
    type: DndItemType.Metric,
    value: { metric_name: 'metric_c' } as any,
  });
  expect(onChange).not.toHaveBeenCalled();

  // metric_a is in selectedMetrics -> accepted
  simulateDrop(captured, {
    type: DndItemType.Metric,
    value: { metric_name: 'metric_a' } as any,
  });
  expect(onChange).toHaveBeenLastCalledWith(['column_a', 'metric_a']);
});

test('can drag and reorder items', () => {
  const onChange = jest.fn();
  render(
    <DndColumnMetricSelect
      {...defaultProps}
      value={['column_a', 'metric_a', 'column_b']}
      onChange={onChange}
      multi
    />,
    { useDndKit: true, useRedux: true },
  );

  // Reorder is dispatched via the active sortable item's onShiftOptions,
  // which the control registers on each OptionWrapper. Drag index 0
  // (column_a) onto index 2 (column_b) and verify the arrayMove: column_a is
  // removed from the front and reinserted at index 2, shifting the rest left.
  simulateReorder(sortables, 0, 2);
  expect(onChange).toHaveBeenLastCalledWith([
    'metric_a',
    'column_b',
    'column_a',
  ]);
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
    { useDndKit: true, useRedux: true },
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
    { useDndKit: true, useRedux: true },
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
    { useDndKit: true, useRedux: true },
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
    { useDndKit: true, useRedux: true },
  );

  // Use testId instead of role selector - @dnd-kit sortable wrapper adds extra button elements
  const closeButtons = screen.getAllByTestId('remove-control-button');
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
    useDndKit: true,
    useRedux: true,
  });

  const metricItem = screen.getByText('error_metric');
  expect(metricItem).toBeVisible();
});

test('handles adhoc column values', () => {
  const values = ['column_a'];

  render(<DndColumnMetricSelect {...defaultProps} value={values} multi />, {
    useDndKit: true,
    useRedux: true,
  });

  expect(screen.getByText('column_a')).toBeVisible();
});

test('handles mixed value types correctly', () => {
  const mixedValues = ['column_a', 'metric_a'];

  render(
    <DndColumnMetricSelect {...defaultProps} value={mixedValues} multi />,
    { useDndKit: true, useRedux: true },
  );

  expect(screen.getByText('column_a')).toBeVisible();
  expect(screen.getByText('metric_a')).toBeVisible();
});
