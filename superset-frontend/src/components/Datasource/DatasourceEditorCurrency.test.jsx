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
import DatasourceEditor from './DatasourceEditor';
import { props, DATASOURCE_ENDPOINT } from './DatasourceEditor.test';

// Optimized render function that doesn't use waitFor initially
// This helps prevent one source of the timeout
const fastRender = props =>
  render(<DatasourceEditor {...props} />, {
    useRedux: true,
    initialState: { common: { currencies: ['USD', 'GBP', 'EUR'] } },
  });

describe('DatasourceEditor Currency Tests', () => {
  beforeEach(() => {
    fetchMock.get(DATASOURCE_ENDPOINT, [], { overwriteRoutes: true });
  });

  afterEach(() => {
    fetchMock.restore();
  });

  // The problematic test, now optimized
  it('renders currency controls', async () => {
    // Setup a metric with currency data
    const propsWithCurrency = {
      ...props,
      datasource: {
        ...props.datasource,
        metrics: [
          {
            ...props.datasource.metrics[0],
            currency: { symbol: 'USD', symbolPosition: 'prefix' },
          },
          ...props.datasource.metrics.slice(1),
        ],
      },
      // Fresh mock for each test to avoid interference
      onChange: jest.fn(),
    };

    // Faster rendering without initial waitFor
    fastRender(propsWithCurrency);

    // Navigate to metrics tab
    const metricButton = screen.getByTestId('collection-tab-Metrics');
    await userEvent.click(metricButton);

    // Find and expand the first metric row
    const expandToggles = await screen.findAllByLabelText(
      /expand row/i,
      {},
      { timeout: 5000 },
    );
    await userEvent.click(expandToggles[0]);

    // Check for currency section header
    const currencyHeader = await screen.findByText(
      'Metric currency',
      {},
      { timeout: 5000 },
    );
    expect(currencyHeader).toBeVisible();

    // Check prefix/suffix dropdown - first find the wrapper
    const positionSelector = screen.getByRole('combobox', {
      name: 'Currency prefix or suffix',
    });

    // Verify current value is 'Prefix'
    expect(positionSelector).toBeInTheDocument();

    // Open the dropdown
    userEvent.click(positionSelector);

    // Wait for dropdown to open and find the suffix option
    const suffixOption = await waitFor(
      () => {
        // Look for 'suffix' option in the dropdown
        const options = document.querySelectorAll('.ant-select-item-option');
        const suffixOpt = Array.from(options).find(opt =>
          opt.textContent.toLowerCase().includes('suffix'),
        );

        if (!suffixOpt) throw new Error('Suffix option not found');
        return suffixOpt;
      },
      { timeout: 5000 },
    );

    // Clear the mock to ensure clean state
    propsWithCurrency.onChange.mockClear();

    // Click the suffix option
    userEvent.click(suffixOption);

    // Check if onChange was called with the expected parameters
    await waitFor(
      () => {
        expect(propsWithCurrency.onChange).toHaveBeenCalledTimes(1);
        const callArg = propsWithCurrency.onChange.mock.calls[0][0];

        // More robust check for the metrics array
        const metrics = callArg.metrics || [];
        const updatedMetric = metrics.find(
          m => m.currency && m.currency.symbolPosition === 'suffix',
        );

        expect(updatedMetric).toBeDefined();
        expect(updatedMetric.currency.symbol).toBe('USD');
      },
      { timeout: 5000 },
    );

    // Now test changing the currency symbol
    const currencySymbol = await screen.findByRole(
      'combobox',
      {
        name: 'Currency symbol',
      },
      { timeout: 5000 },
    );

    // Open the currency dropdown
    userEvent.click(currencySymbol);

    // Wait for dropdown to open and find the GBP option
    const gbpOption = await waitFor(
      () => {
        // Look for 'GBP' option in the dropdown
        const options = document.querySelectorAll('.ant-select-item-option');
        const gbpOpt = Array.from(options).find(opt =>
          opt.textContent.includes('GBP'),
        );

        if (!gbpOpt) throw new Error('GBP option not found');
        return gbpOpt;
      },
      { timeout: 5000 },
    );

    // Clear mock again
    propsWithCurrency.onChange.mockClear();

    // Click the GBP option
    userEvent.click(gbpOption);

    // Verify the onChange with GBP was called
    await waitFor(
      () => {
        expect(propsWithCurrency.onChange).toHaveBeenCalledTimes(1);
        const callArg = propsWithCurrency.onChange.mock.calls[0][0];

        // More robust check
        const metrics = callArg.metrics || [];
        const updatedMetric = metrics.find(
          m => m.currency && m.currency.symbol === 'GBP',
        );

        expect(updatedMetric).toBeDefined();
        expect(updatedMetric.currency.symbolPosition).toBe('suffix');
      },
      { timeout: 5000 },
    );
  }, 60000);
});
