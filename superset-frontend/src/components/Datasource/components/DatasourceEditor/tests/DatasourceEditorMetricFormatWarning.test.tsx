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
import { screen, userEvent, within } from 'spec/helpers/testing-library';
import { Constants } from '@superset-ui/core/components';
import { isCountExpression, isPercentD3Format } from '../DatasourceEditor';
import {
  createProps,
  DATASOURCE_ENDPOINT,
  setupDatasourceEditorMocks,
  cleanupAsyncOperations,
  fastRender,
  dismissDatasourceWarning,
} from './DatasourceEditor.test.utils';

beforeEach(() => {
  fetchMock.get(DATASOURCE_ENDPOINT, [], { name: DATASOURCE_ENDPOINT });
  setupDatasourceEditorMocks();
});

afterEach(async () => {
  await cleanupAsyncOperations();
  fetchMock.clearHistory().removeRoutes();
});

const WARNING_TEXT = /D3 format is a percentage/i;

// Selecting the expand toggle by its position in the list is brittle: any
// change to the fixture or the table's sort order would expand a different
// row and negative assertions would keep passing against the wrong metric.
// Look up the toggle via the row that actually contains the metric name.
const expandMetricRow = async (metricName: string) => {
  const nameCell = await screen.findByText(metricName);
  const row = nameCell.closest('tr');
  if (!row) {
    throw new Error(`Could not find a table row for metric "${metricName}"`);
  }
  await userEvent.click(within(row).getByLabelText(/expand row/i));
};

// Negative assertions must wait past TextControl's debounce, or they pass
// before the value even commits.
const waitPastDebounce = () =>
  new Promise(resolve => {
    setTimeout(resolve, Constants.FAST_DEBOUNCE + 50);
  });

test('isCountExpression matches a COUNT(...) call, including nested calls', () => {
  expect(isCountExpression('COUNT(*)')).toBe(true);
  expect(isCountExpression('count( * )')).toBe(true);
  expect(isCountExpression('COUNT (*)')).toBe(true);
  expect(isCountExpression('COUNT(DISTINCT name)')).toBe(true);
  expect(isCountExpression('COUNT(DISTINCT COALESCE(a, b))')).toBe(true);
  expect(isCountExpression('COUNT(*) / COUNT(*)')).toBe(false);
  expect(isCountExpression('COUNT(*) * 100')).toBe(false);
  expect(isCountExpression('SUM(num)')).toBe(false);
  expect(isCountExpression(undefined)).toBe(false);
});

test('isPercentD3Format accepts only a valid D3 percent/p spec', () => {
  expect(isPercentD3Format('.0%')).toBe(true);
  expect(isPercentD3Format(',.2%')).toBe(true);
  expect(isPercentD3Format('.1p')).toBe(true);
  expect(isPercentD3Format('foo%')).toBe(false);
  expect(isPercentD3Format('.0%garbage%')).toBe(false);
  expect(isPercentD3Format(',.0f')).toBe(false);
  expect(isPercentD3Format(undefined)).toBe(false);
});

// A '%' format is valid syntax, so it never hits the "Invalid format" fallback.
test('warns when a percent D3 format is set on a COUNT metric', async () => {
  const testProps = createProps();
  fastRender(testProps);
  await dismissDatasourceWarning();

  await userEvent.click(await screen.findByTestId('collection-tab-Metrics'));
  await expandMetricRow('count');

  expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();

  await userEvent.type(await screen.findByPlaceholderText('%y/%m/%d'), '.0%');

  expect(await screen.findByText(WARNING_TEXT)).toBeInTheDocument();
});

test('does not warn for a non-percent format on a COUNT metric', async () => {
  const testProps = createProps();
  fastRender(testProps);
  await dismissDatasourceWarning();

  await userEvent.click(await screen.findByTestId('collection-tab-Metrics'));
  await expandMetricRow('count');

  await userEvent.type(await screen.findByPlaceholderText('%y/%m/%d'), ',.0f');

  await waitPastDebounce();
  expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
});

test('does not warn for a percent format on a non-COUNT metric', async () => {
  const testProps = createProps();
  fastRender(testProps);
  await dismissDatasourceWarning();

  await userEvent.click(await screen.findByTestId('collection-tab-Metrics'));
  await expandMetricRow('sum__num');

  await userEvent.type(await screen.findByPlaceholderText('%y/%m/%d'), '.0%');

  await waitPastDebounce();
  expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
});

test('does not warn for a ratio built from COUNT, e.g. COUNT(*) / COUNT(*)', async () => {
  const baseProps = createProps();
  const testProps = {
    ...baseProps,
    datasource: {
      ...baseProps.datasource,
      metrics: [
        ...baseProps.datasource.metrics,
        {
          id: 99,
          uuid: 'metric-99-uuid',
          expression: 'COUNT(*) / COUNT(*)',
          verbose_name: 'ratio',
          metric_name: 'ratio',
          metric_type: 'count',
        },
      ],
    },
  };
  fastRender(testProps);
  await dismissDatasourceWarning();

  await userEvent.click(await screen.findByTestId('collection-tab-Metrics'));
  await expandMetricRow('ratio');

  await userEvent.type(await screen.findByPlaceholderText('%y/%m/%d'), '.0%');

  await waitPastDebounce();
  expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
});

test('does not warn for a garbage format string that merely ends in %', async () => {
  const testProps = createProps();
  fastRender(testProps);
  await dismissDatasourceWarning();

  await userEvent.click(await screen.findByTestId('collection-tab-Metrics'));
  await expandMetricRow('count');

  await userEvent.type(await screen.findByPlaceholderText('%y/%m/%d'), 'foo%');

  await waitPastDebounce();
  expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
});
