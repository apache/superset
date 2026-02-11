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
import { GenericDataType } from '@apache-superset/core/api/core';
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
  userEvent.click(metricButton);

  // Expand the metric row
  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  userEvent.click(expandToggles[0]);

  // Wait for currency section to be visible
  await screen.findByText('Metric currency');
};

beforeEach(() => {
  fetchMock.get(DATASOURCE_ENDPOINT, [], { name: DATASOURCE_ENDPOINT });
  setupDatasourceEditorMocks();
});

afterEach(async () => {
  await cleanupAsyncOperations();
  fetchMock.clearHistory().removeRoutes();
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
    expect(testProps.onChange).toHaveBeenCalled();
  });

  // Verify the exact call arguments - check the latest call
  const lastCallIndex = testProps.onChange.mock.calls.length - 1;
  const callArg = testProps.onChange.mock.calls[lastCallIndex][0];
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
    expect(testProps.onChange).toHaveBeenCalled();
  });

  // Verify the exact call arguments - check the latest call
  const lastCallIndex = testProps.onChange.mock.calls.length - 1;
  const callArg = testProps.onChange.mock.calls[lastCallIndex][0];
  const metrics = callArg.metrics || [];
  const updatedMetric = metrics.find(
    (m: MetricType) => m.currency?.symbol === 'GBP',
  );
  expect(updatedMetric?.currency?.symbolPosition).toBe('prefix');
}, 60000);

test('currency code column dropdown shows string and untyped calculated columns but excludes numeric and typed non-string calculated columns', async () => {
  const baseProps = createProps();
  const testProps = {
    ...baseProps,
    datasource: {
      ...baseProps.datasource,
      columns: [
        {
          id: 100,
          type: 'VARCHAR(255)',
          type_generic: GenericDataType.String,
          filterable: true,
          is_dttm: false,
          is_active: true,
          expression: '',
          groupby: true,
          column_name: 'currency_code',
        },
        {
          id: 101,
          type: 'DECIMAL',
          type_generic: GenericDataType.Numeric,
          filterable: false,
          is_dttm: false,
          is_active: true,
          expression: '',
          groupby: false,
          column_name: 'amount',
        },
        {
          id: 102,
          type: '',
          type_generic: null,
          filterable: true,
          is_dttm: false,
          is_active: true,
          expression: "CASE WHEN country = 'US' THEN 'USD' ELSE 'EUR' END",
          groupby: true,
          column_name: 'derived_currency',
        },
        {
          id: 103,
          type: 'NUMERIC',
          type_generic: GenericDataType.Numeric,
          filterable: true,
          is_dttm: false,
          is_active: true,
          expression: 'price * quantity',
          groupby: false,
          column_name: 'total_amount',
        },
        ...baseProps.datasource.columns,
      ],
    },
    onChange: jest.fn(),
  };

  fastRender(testProps);
  await dismissDatasourceWarning();

  // Navigate to columns tab
  const columnsTab = await screen.findByTestId('collection-tab-Columns');
  await userEvent.click(columnsTab);

  // Find the currency code column dropdown
  const currencyCodeDropdown = await screen.findByRole('combobox', {
    name: 'Currency code column',
  });

  await userEvent.click(currencyCodeDropdown);

  // Verify STRING column is available
  await waitFor(() => {
    const options = document.querySelectorAll('.ant-select-item-option');
    const currencyCodeOption = Array.from(options).find(o =>
      o.textContent?.includes('currency_code'),
    );
    expect(currencyCodeOption).toBeDefined();
  });

  // Verify CALCULATED column is available despite null type_generic
  const options = document.querySelectorAll('.ant-select-item-option');
  const derivedCurrencyOption = Array.from(options).find(o =>
    o.textContent?.includes('derived_currency'),
  );
  expect(derivedCurrencyOption).toBeDefined();

  // Verify NUMERIC columns (physical and calculated) are NOT available
  const numericOptions = Array.from(options).filter(o =>
    ['amount', 'total_amount'].includes(o.textContent?.trim() ?? ''),
  );
  expect(numericOptions).toHaveLength(0);
}, 60000);
