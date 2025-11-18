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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import type { DatasetObject } from 'src/features/datasets/types';
import DatasourceEditor from '..';
import {
  props,
  DATASOURCE_ENDPOINT,
  setupDatasourceEditorMocks,
  cleanupAsyncOperations,
} from './DatasourceEditor.test.utils';

type MetricType = DatasetObject['metrics'][number];

// Optimized render function that doesn't use waitFor initially
// This helps prevent one source of the timeout
const fastRender = (renderProps: typeof props) =>
  render(<DatasourceEditor {...renderProps} />, {
    useRedux: true,
    initialState: { common: { currencies: ['USD', 'GBP', 'EUR'] } },
  });

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
  const metricButton = screen.getByTestId('collection-tab-Metrics');
  await userEvent.click(metricButton);

  // Find and expand the metric row with currency
  // Metrics are sorted by ID descending, so metric with id=1 (which has currency)
  // is at position 6 (last). Expand that one.
  const expandToggles = await screen.findAllByLabelText(
    /expand row/i,
    {},
    { timeout: 5000 },
  );
  await userEvent.click(expandToggles[6]);

  // Check for currency section header
  const currencyHeader = await screen.findByText(
    'Metric currency',
    {},
    { timeout: 5000 },
  );
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
  const metricButton = screen.getByTestId('collection-tab-Metrics');
  await userEvent.click(metricButton);

  // Expand the metric with currency
  const expandToggles = await screen.findAllByLabelText(
    /expand row/i,
    {},
    { timeout: 5000 },
  );
  await userEvent.click(expandToggles[6]);

  // Find position selector
  const positionSelector = screen.getByRole('combobox', {
    name: 'Currency prefix or suffix',
  });

  // Open the dropdown
  await userEvent.click(positionSelector);

  // Wait for dropdown to open and find the suffix option
  const suffixOption = await waitFor(
    () => {
      const options = document.querySelectorAll('.ant-select-item-option');
      const suffixOpt = Array.from(options).find(opt =>
        opt.textContent?.toLowerCase().includes('suffix'),
      );

      if (!suffixOpt) throw new Error('Suffix option not found');
      return suffixOpt;
    },
    { timeout: 5000 },
  );

  // Click the suffix option
  await userEvent.click(suffixOption);

  // Verify onChange was called with suffix position
  await waitFor(
    () => {
      expect(testProps.onChange).toHaveBeenCalledTimes(1);
      const callArg = testProps.onChange.mock.calls[0][0];

      const metrics = callArg.metrics || [];
      const updatedMetric = metrics.find(
        (m: MetricType) => m.currency && m.currency.symbolPosition === 'suffix',
      );

      expect(updatedMetric).toBeDefined();
      expect(updatedMetric?.currency?.symbol).toBe('USD');
    },
    { timeout: 5000 },
  );
}, 60000);

test('changes currency symbol from USD to GBP', async () => {
  const testProps = createPropsWithCurrency();

  fastRender(testProps);

  // Navigate to metrics tab
  const metricButton = screen.getByTestId('collection-tab-Metrics');
  await userEvent.click(metricButton);

  // Expand the metric with currency
  const expandToggles = await screen.findAllByLabelText(
    /expand row/i,
    {},
    { timeout: 5000 },
  );
  await userEvent.click(expandToggles[6]);

  // Find currency symbol selector
  const currencySymbol = await screen.findByRole(
    'combobox',
    {
      name: 'Currency symbol',
    },
    { timeout: 5000 },
  );

  // Open the currency dropdown
  await userEvent.click(currencySymbol);

  // Wait for dropdown to open and find the GBP option
  const gbpOption = await waitFor(
    () => {
      const options = document.querySelectorAll('.ant-select-item-option');
      const gbpOpt = Array.from(options).find(opt =>
        opt.textContent?.includes('GBP'),
      );

      if (!gbpOpt) throw new Error('GBP option not found');
      return gbpOpt;
    },
    { timeout: 5000 },
  );

  // Click the GBP option
  await userEvent.click(gbpOption);

  // Verify onChange was called with GBP
  await waitFor(
    () => {
      expect(testProps.onChange).toHaveBeenCalledTimes(1);
      const callArg = testProps.onChange.mock.calls[0][0];

      const metrics = callArg.metrics || [];
      const updatedMetric = metrics.find(
        (m: MetricType) => m.currency && m.currency.symbol === 'GBP',
      );

      expect(updatedMetric).toBeDefined();
      expect(updatedMetric?.currency?.symbolPosition).toBe('prefix');
    },
    { timeout: 5000 },
  );
}, 60000);
