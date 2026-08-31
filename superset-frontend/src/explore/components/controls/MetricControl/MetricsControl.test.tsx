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
  cleanup,
  screen,
  render,
  selectOption,
  userEvent,
} from 'spec/helpers/testing-library';
import MetricsControl from 'src/explore/components/controls/MetricControl/MetricsControl';
import AdhocMetric, {
  EXPRESSION_TYPES,
} from 'src/explore/components/controls/MetricControl/AdhocMetric';
import { AGGREGATES } from 'src/explore/constants';

// Add cleanup after each test
afterEach(async () => {
  cleanup();
  // Wait for any pending effects to complete
  await new Promise(resolve => setTimeout(resolve, 0));
});

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
  datasource: undefined,
  datasourceType: 'sqla',
};

function setup(overrides: Record<string, unknown> = {}) {
  const onChange = jest.fn();
  const props = {
    onChange,
    ...defaultProps,
    ...overrides,
  };
  const result = render(<MetricsControl {...props} />, {
    useDnd: true,
    useRedux: true,
  });
  return { onChange, ...result };
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
  await selectOption('sum__value', 'Select saved metrics');
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
  await selectOption('AVG', 'Select aggregate options');

  await screen.findByText('AVG(value)');

  userEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({
      aggregate: AGGREGATES.AVG,
      label: 'AVG(value)',
    }),
  ]);
});

test('only edits the targeted metric when two metrics share an optionName', async () => {
  // A saved chart can carry two adhoc metrics with the same optionName (e.g.
  // born from a duplicated metric). Editing one must not overwrite the other.
  // Saved charts store metrics as plain dictionaries in form_data, so mirror
  // that shape (not AdhocMetric instances) to exercise the real load path.
  const sharedOptionName = 'metric_shared_option';
  const { onChange } = setup({
    value: [
      {
        expressionType: EXPRESSION_TYPES.SIMPLE,
        column: valueColumn,
        aggregate: AGGREGATES.SUM,
        label: 'SUM(value)',
        optionName: sharedOptionName,
      },
      {
        expressionType: EXPRESSION_TYPES.SIMPLE,
        column: valueColumn,
        aggregate: AGGREGATES.AVG,
        label: 'AVG(value)',
        optionName: sharedOptionName,
      },
    ],
  });

  userEvent.click(screen.getByText('SUM(value)'));
  await screen.findByText('aggregate');
  await selectOption('MAX', 'Select aggregate options');
  await screen.findByText('MAX(value)');
  userEvent.click(screen.getByRole('button', { name: /save/i }));

  // The edit must propagate to the targeted metric (SUM → MAX) while the
  // untouched AVG(value) metric stays present and unchanged.
  expect(onChange).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        aggregate: AGGREGATES.MAX,
        label: 'MAX(value)',
      }),
      expect.objectContaining({
        aggregate: AGGREGATES.AVG,
        label: 'AVG(value)',
      }),
    ]),
  );
});

test('removes metrics if savedMetrics changes', async () => {
  setup({
    value: [sumValueAdhocMetric],
  });

  expect(screen.getByText('SUM(value)')).toBeInTheDocument();
  userEvent.click(screen.getByText('SUM(value)'));

  const savedTab = screen.getByRole('tab', { name: /saved/i });
  userEvent.click(savedTab);
  await selectOption('avg__value', 'Select saved metrics');

  const simpleTab = screen.getByRole('tab', { name: /simple/i });
  userEvent.click(simpleTab);
  await screen.findByText('aggregate');

  expect(screen.queryByText('SUM')).not.toBeInTheDocument();
  expect(screen.queryByText('value')).not.toBeInTheDocument();
});

test('does not remove custom SQL metric if savedMetrics changes', async () => {
  const { rerender } = render(
    <MetricsControl
      name="metrics"
      onChange={jest.fn()}
      multi
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
      datasource={undefined}
    />,
    { useDnd: true, useRedux: true },
  );

  expect(screen.getByText('old label')).toBeInTheDocument();

  // Simulate removing columns
  rerender(
    <MetricsControl
      name="metrics"
      onChange={jest.fn()}
      multi
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
      datasource={undefined}
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
