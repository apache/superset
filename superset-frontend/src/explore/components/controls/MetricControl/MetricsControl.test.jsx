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

import { screen, render, selectOption } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import MetricsControl from 'src/explore/components/controls/MetricControl/MetricsControl';
import AdhocMetric, {
  EXPRESSION_TYPES,
} from 'src/explore/components/controls/MetricControl/AdhocMetric';
import { AGGREGATES } from 'src/explore/constants';

const defaultProps = {
  name: 'metrics',
  label: 'Metrics',
  value: undefined,
  multi: true,
  columns: [
    { type: 'VARCHAR(255)', column_name: 'source' },
    { type: 'VARCHAR(255)', column_name: 'target' },
    { type: 'DOUBLE', column_name: 'value' },
  ],
  savedMetrics: [
    { metric_name: 'sum__value', expression: 'SUM(energy_usage.value)' },
    { metric_name: 'avg__value', expression: 'AVG(energy_usage.value)' },
  ],
  datasourceType: 'sqla',
};

function setup(overrides) {
  const onChange = jest.fn();
  const props = {
    onChange,
    ...defaultProps,
    ...overrides,
  };
  render(<MetricsControl {...props} />, { useDnd: true });
  return { onChange };
}

const valueColumn = { type: 'double', column_name: 'value' };

const sumValueAdhocMetric = new AdhocMetric({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  column: valueColumn,
  aggregate: AGGREGATES.SUM,
  label: 'SUM(value)',
});

test('renders the LabelsContainer', () => {
  setup();
  expect(screen.getByText('Metrics')).toBeInTheDocument();
});

test('coerces Adhoc Metrics from form data into instances of the AdhocMetric class and leaves saved metrics', () => {
  setup({
    value: [sumValueAdhocMetric],
  });

  const adhocMetric = screen.getByText('SUM(value)');
  expect(adhocMetric).toBeInTheDocument();
});

test('handles creating a new metric', async () => {
  const { onChange } = setup();

  userEvent.click(screen.getByText(/add metric/i));
  await selectOption('sum__value', /select saved metrics/i);
  userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onChange).toHaveBeenCalledWith(['sum__value']);
});

test('accepts an edited metric from an AdhocMetricEditPopover', async () => {
  const { onChange } = setup({
    value: [sumValueAdhocMetric],
  });

  const metricLabel = screen.getByText('SUM(value)');
  userEvent.click(metricLabel);

  await screen.findByText('aggregate');
  selectOption('AVG', /select aggregate options/i);

  await screen.findByText('AVG(value)');

  userEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({
      aggregate: AGGREGATES.AVG,
      label: 'AVG(value)',
    }),
  ]);
});

test('removes metrics if savedMetrics changes', async () => {
  setup({
    value: [sumValueAdhocMetric],
  });

  expect(screen.getByText('SUM(value)')).toBeInTheDocument();
  userEvent.click(screen.getByText('SUM(value)'));

  const savedTab = screen.getByRole('tab', { name: /saved/i });
  userEvent.click(savedTab);
  await selectOption('avg__value', /select saved metrics/i);

  const simpleTab = screen.getByRole('tab', { name: /simple/i });
  userEvent.click(simpleTab);
  await screen.findByText('aggregate');

  expect(screen.queryByText('SUM')).not.toBeInTheDocument();
  expect(screen.queryByText('value')).not.toBeInTheDocument();
});

test('does not remove custom SQL metric if savedMetrics changes', async () => {
  const { rerender } = render(
    <MetricsControl
      value={[
        {
          expressionType: EXPRESSION_TYPES.SQL,
          sqlExpression: 'COUNT(*)',
          label: 'old label',
          hasCustomLabel: true,
        },
      ]}
      columns={[
        { type: 'VARCHAR(255)', column_name: 'source' },
        { type: 'VARCHAR(255)', column_name: 'target' },
        { type: 'DOUBLE', column_name: 'value' },
      ]}
      savedMetrics={[
        { metric_name: 'sum__value', expression: 'SUM(energy_usage.value)' },
        { metric_name: 'avg__value', expression: 'AVG(energy_usage.value)' },
      ]}
    />,
    { useDnd: true },
  );

  expect(screen.getByText('old label')).toBeInTheDocument();

  // Simulate removing columns
  rerender(
    <MetricsControl
      value={[
        {
          expressionType: EXPRESSION_TYPES.SQL,
          sqlExpression: 'COUNT(*)',
          label: 'old label',
          hasCustomLabel: true,
        },
      ]}
      columns={[]}
      savedMetrics={[]}
    />,
  );

  expect(screen.getByText('old label')).toBeInTheDocument();
});

test('does not fail if no columns or savedMetrics are passed', () => {
  setup({
    savedMetrics: null,
    columns: null,
  });
  expect(screen.getByText(/add metric/i)).toBeInTheDocument();
});
