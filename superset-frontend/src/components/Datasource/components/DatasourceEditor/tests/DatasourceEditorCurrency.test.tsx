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
  fireEvent,
  selectOption,
} from 'spec/helpers/testing-library';
import type { DatasetObject } from 'src/features/datasets/types';
import {
  props,
  DATASOURCE_ENDPOINT,
  setupDatasourceEditorMocks,
  cleanupAsyncOperations,
  fastRender,
} from './DatasourceEditor.test.utils';

type MetricType = DatasetObject['metrics'][number];

// Factory function for currency props - returns fresh copy to prevent test pollution
const createPropsWithCurrency = () => ({
  ...props,
  datasource: {
    ...props.datasource,
    metrics: [
      {
        ...props.datasource.metrics[0],
        currency: { symbol: 'USD', symbolPosition: 'prefix' },
      },
      ...props.datasource.metrics.slice(1).map(m => ({ ...m })),
    ],
  },
  onChange: jest.fn(),
});

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

  fastRender(testProps);

  // Navigate to metrics tab
  const metricButton = await screen.findByTestId('collection-tab-Metrics');
  fireEvent.click(metricButton);

  // Find and expand the metric row with currency
  // Metrics are sorted by ID descending, so metric with id=1 (which has currency)
  // is at position 6 (last). Expand that one.
  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  fireEvent.click(expandToggles[6]);

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

  fastRender(testProps);

  // Navigate to metrics tab
  const metricButton = await screen.findByTestId('collection-tab-Metrics');
  fireEvent.click(metricButton);

  // Expand the metric with currency
  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  fireEvent.click(expandToggles[6]);

  // Select suffix option using helper
  await selectOption('Suffix', 'Currency prefix or suffix');

  // Verify onChange was called with suffix position
  await waitFor(() => {
    expect(testProps.onChange).toHaveBeenCalledTimes(1);
    const callArg = testProps.onChange.mock.calls[0][0];

    const metrics = callArg.metrics || [];
    const updatedMetric = metrics.find(
      (m: MetricType) => m.currency && m.currency.symbolPosition === 'suffix',
    );

    expect(updatedMetric).toBeDefined();
    expect(updatedMetric?.currency?.symbol).toBe('USD');
  });
}, 25000); // Extended timeout: selectOption uses userEvent internally, plus render/nav/expansion overhead

test('changes currency symbol from USD to GBP', async () => {
  const testProps = createPropsWithCurrency();

  fastRender(testProps);

  // Navigate to metrics tab
  const metricButton = await screen.findByTestId('collection-tab-Metrics');
  fireEvent.click(metricButton);

  // Expand the metric with currency
  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  fireEvent.click(expandToggles[6]);

  // Select GBP option using helper (text includes symbol: "£ (GBP)")
  await selectOption('£ (GBP)', 'Currency symbol');

  // Verify onChange was called with GBP
  await waitFor(() => {
    expect(testProps.onChange).toHaveBeenCalledTimes(1);
    const callArg = testProps.onChange.mock.calls[0][0];

    const metrics = callArg.metrics || [];
    const updatedMetric = metrics.find(
      (m: MetricType) => m.currency && m.currency.symbol === 'GBP',
    );

    expect(updatedMetric).toBeDefined();
    expect(updatedMetric?.currency?.symbolPosition).toBe('prefix');
  });
}, 25000); // Extended timeout: selectOption uses userEvent internally, plus render/nav/expansion overhead
