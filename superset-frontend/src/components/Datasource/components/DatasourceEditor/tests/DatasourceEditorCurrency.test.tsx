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
  fastRender,
  dismissDatasourceWarning,
} from './DatasourceEditor.test.utils';

type MetricType = DatasetObject['metrics'][number];

// Factory function for currency props - returns fresh copy to prevent test pollution
// Using single metric to minimize DOM size for faster test execution
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

// Shared setup to navigate to expanded currency section
const setupCurrencySection = async () => {
  await dismissDatasourceWarning();

  // Navigate to metrics tab - use findBy which has built-in waiting
  const metricButton = await screen.findByTestId('collection-tab-Metrics');
  await userEvent.click(metricButton);

  // Expand the metric row
  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  await userEvent.click(expandToggles[0]);

  // Wait for currency section to be visible
  await screen.findByText('Metric currency');
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
  fastRender(testProps);

  await setupCurrencySection();

  // Verify currency selectors exist
  expect(
    screen.getByRole('combobox', { name: 'Currency prefix or suffix' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('combobox', { name: 'Currency symbol' }),
  ).toBeInTheDocument();
});

test('changes currency position from prefix to suffix', async () => {
  const testProps = createPropsWithCurrency();
  fastRender(testProps);

  await setupCurrencySection();

  await selectOption('Suffix', 'Currency prefix or suffix');

  await waitFor(() => {
    expect(testProps.onChange).toHaveBeenCalledTimes(1);
  });

  // Verify the exact call arguments
  const callArg = testProps.onChange.mock.calls[0][0];
  const metrics = callArg.metrics || [];
  const updatedMetric = metrics.find(
    (m: MetricType) => m.currency?.symbolPosition === 'suffix',
  );
  expect(updatedMetric?.currency?.symbol).toBe('USD');
}, 60000);

test('changes currency symbol from USD to GBP', async () => {
  const testProps = createPropsWithCurrency();
  fastRender(testProps);

  await setupCurrencySection();

  await selectOption('£ (GBP)', 'Currency symbol');

  await waitFor(() => {
    expect(testProps.onChange).toHaveBeenCalledTimes(1);
  });

  // Verify the exact call arguments
  const callArg = testProps.onChange.mock.calls[0][0];
  const metrics = callArg.metrics || [];
  const updatedMetric = metrics.find(
    (m: MetricType) => m.currency?.symbol === 'GBP',
  );
  expect(updatedMetric?.currency?.symbolPosition).toBe('prefix');
}, 60000);
