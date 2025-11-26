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
import fetchMock from 'fetch-mock';
import {
  screen,
  waitFor,
  userEvent,
  selectOption,
} from 'spec/helpers/testing-library';
import type { DatasetObject } from 'src/features/datasets/types';
import {
  createProps,
  DATASOURCE_ENDPOINT,
  setupDatasourceEditorMocks,
  cleanupAsyncOperations,
  asyncRender,
  dismissDatasourceWarning,
} from './DatasourceEditor.test.utils';

type MetricType = DatasetObject['metrics'][number];

// Factory function for currency props - returns fresh copy to prevent test pollution
// Using single metric to minimize DOM size for faster test execution while still validating currency functionality
const createPropsWithCurrency = () => {
  const baseProps = createProps();
  return {
    ...baseProps,
    datasource: {
      ...baseProps.datasource,
      metrics: [
        {
          ...baseProps.datasource.metrics[0],
          currency: { symbol: 'USD', symbolPosition: 'prefix' },
        },
      ],
    },
    onChange: jest.fn(),
  };
};

beforeEach(() => {
  fetchMock.get(DATASOURCE_ENDPOINT, [], { overwriteRoutes: true });
  setupDatasourceEditorMocks();
});

afterEach(async () => {
  await cleanupAsyncOperations();
  fetchMock.restore();
});

test('renders currency section in metrics tab', async () => {
  const testProps = createPropsWithCurrency();
  await asyncRender(testProps);

  await dismissDatasourceWarning();

  // Navigate to metrics tab
  const metricButton = await screen.findByTestId('collection-tab-Metrics');
  await userEvent.click(metricButton);

  // Expand the single metric row with currency
  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  await userEvent.click(expandToggles[0]);

  // Check for currency section header
  const currencyHeader = await screen.findByText('Metric currency');
  expect(currencyHeader).toBeVisible();

  // Verify currency position selector exists
  const positionSelector = screen.getByRole('combobox', {
    name: 'Currency prefix or suffix',
  });
  expect(positionSelector).toBeInTheDocument();

  // Verify currency symbol selector exists
  const symbolSelector = screen.getByRole('combobox', {
    name: 'Currency symbol',
  });
  expect(symbolSelector).toBeInTheDocument();
});

test('changes currency position from prefix to suffix', async () => {
  const testProps = createPropsWithCurrency();

  await asyncRender(testProps);

  await dismissDatasourceWarning();

  // Navigate to metrics tab
  const metricButton = await screen.findByTestId('collection-tab-Metrics');
  await userEvent.click(metricButton);

  // Expand the metric with currency
  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  await userEvent.click(expandToggles[0]);

  // Select suffix option via shared helper (rc-virtual-list aware)
  await selectOption('Suffix', 'Currency prefix or suffix');
  await cleanupAsyncOperations();

  // Verify onChange was called with suffix position
  await waitFor(() => {
    expect(testProps.onChange).toHaveBeenCalledTimes(1);
    const callArg = testProps.onChange.mock.calls[0][0];

    const metrics = callArg.metrics || [];
    const updatedMetric = metrics.find(
      (m: MetricType) => m.currency && m.currency.symbolPosition === 'suffix',
    );

    expect(updatedMetric?.currency?.symbol).toBe('USD');
  });
});

test('changes currency symbol from USD to GBP', async () => {
  const testProps = createPropsWithCurrency();

  await asyncRender(testProps);

  await dismissDatasourceWarning();

  // Navigate to metrics tab
  const metricButton = await screen.findByTestId('collection-tab-Metrics');
  await userEvent.click(metricButton);

  // Expand the metric with currency
  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  await userEvent.click(expandToggles[0]);

  // Select GBP option via shared helper (rc-virtual-list aware)
  await selectOption('£ (GBP)', 'Currency symbol');
  await cleanupAsyncOperations();

  // Verify onChange was called with GBP
  await waitFor(() => {
    expect(testProps.onChange).toHaveBeenCalledTimes(1);
    const callArg = testProps.onChange.mock.calls[0][0];

    const metrics = callArg.metrics || [];
    const updatedMetric = metrics.find(
      (m: MetricType) => m.currency && m.currency.symbol === 'GBP',
    );

    expect(updatedMetric?.currency?.symbolPosition).toBe('prefix');
  });
});
