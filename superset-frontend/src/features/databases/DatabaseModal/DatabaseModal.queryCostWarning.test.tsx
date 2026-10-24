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
import { FeatureFlag } from '@superset-ui/core';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import DatabaseModal from './index';
import { DatabaseObject, ExtraJson, QueryCostWarningMetric } from '../types';

const databaseEndpoint = 'glob:*/api/v1/database/10';
const connectionEndpoint = 'glob:*/api/v1/database/10/connection';

beforeEach(() => {
  window.featureFlags = {
    [FeatureFlag.EstimateQueryCost]: true,
    [FeatureFlag.SqlLabQueryCostWarnings]: true,
  };
  fetchMock.get('glob:*/api/v1/database/available*', { databases: [] });
});
afterEach(() => fetchMock.clearHistory().removeRoutes());

test.each([
  {
    engine: 'postgresql',
    metric: 'total_cost' as QueryCostWarningMetric,
    threshold: 12.5,
    input: '14.125',
    saved: 14.125,
    reopened: 14.125,
    label: 'Warning threshold (planner cost)',
  },
  {
    engine: 'bigquery',
    metric: 'bytes_processed' as QueryCostWarningMetric,
    threshold: 2000000000,
    input: '1.25',
    saved: 1250000000,
    reopened: 1250,
    label: 'Warning threshold (bytes processed)',
  },
])(
  'saves and reopens disabled settings for $engine',
  async ({ engine, metric, threshold, input, saved, reopened, label }) => {
    const initialExtra = {
      cost_estimate_enabled: true,
      allows_virtual_table_explore: true,
      query_cost_warning: { enabled: true, metric, threshold },
    };
    let database = {
      id: 10,
      database_name: 'Warning connection',
      backend: engine,
      expose_in_sqllab: true,
      configuration_method: 'sqlalchemy_form',
      sqlalchemy_uri: `${engine}://localhost/test`,
      engine_information: { query_cost_warning_metric: metric },
      extra: JSON.stringify(initialExtra),
    };
    fetchMock.get(connectionEndpoint, () => ({ result: database }));
    fetchMock.put(
      databaseEndpoint,
      { id: 10, result: database },
      { name: 'database-update' },
    );
    const view = render(
      <DatabaseModal show databaseId={10} onHide={jest.fn()} />,
      { useRedux: true },
    );
    await userEvent.click(await screen.findByRole('tab', { name: 'Advanced' }));
    await userEvent.click(await screen.findByText('SQL Lab'));
    const amount = await screen.findByLabelText(label);
    fireEvent.change(amount, { target: { value: input } });
    await userEvent.click(
      screen.getByLabelText('Enable pre-run cost warnings'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() =>
      expect(fetchMock.callHistory.calls('database-update')).toHaveLength(1),
    );
    const request = JSON.parse(
      fetchMock.callHistory.calls('database-update')[0].options.body as string,
    ) as DatabaseObject;
    const extra = JSON.parse(request.extra || '{}') as ExtraJson;
    expect(extra).toMatchObject({
      ...initialExtra,
      query_cost_warning: { enabled: false, metric, threshold: saved },
    });
    view.unmount();
    database = { ...database, extra: request.extra || '{}' };
    render(<DatabaseModal show databaseId={10} onHide={jest.fn()} />, {
      useRedux: true,
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Advanced' }));
    await userEvent.click(await screen.findByText('SQL Lab'));
    expect(await screen.findByLabelText(label)).toHaveValue(reopened);
    expect(
      screen.getByLabelText('Enable pre-run cost warnings'),
    ).not.toBeChecked();
  },
);

test('the modal blocks an invalid byte amount and allows correcting it', async () => {
  fetchMock.get(connectionEndpoint, {
    result: {
      id: 10,
      database_name: 'Byte validation',
      backend: 'bigquery',
      expose_in_sqllab: true,
      configuration_method: 'sqlalchemy_form',
      engine_information: { query_cost_warning_metric: 'bytes_processed' },
      extra: JSON.stringify({
        cost_estimate_enabled: true,
        query_cost_warning: {
          enabled: true,
          metric: 'bytes_processed',
          threshold: 1000000,
        },
      }),
    },
  });
  fetchMock.put(
    databaseEndpoint,
    { id: 10, result: {} },
    { name: 'database-update' },
  );
  render(<DatabaseModal show databaseId={10} onHide={jest.fn()} />, {
    useRedux: true,
  });
  await userEvent.click(await screen.findByRole('tab', { name: 'Advanced' }));
  await userEvent.click(await screen.findByText('SQL Lab'));
  const amount = await screen.findByLabelText(
    'Warning threshold (bytes processed)',
  );
  fireEvent.change(amount, { target: { value: '0.0000001' } });
  expect(screen.getByRole('button', { name: 'Finish' })).toBeDisabled();
  expect(
    screen.getByText(/amount that equals positive whole bytes/),
  ).toBeInTheDocument();
  fireEvent.change(amount, { target: { value: '1.000001' } });
  expect(screen.getByRole('button', { name: 'Finish' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('database-update')).toHaveLength(1),
  );
  const request = JSON.parse(
    fetchMock.callHistory.calls('database-update')[0].options.body as string,
  ) as DatabaseObject;
  expect(JSON.parse(request.extra || '{}').query_cost_warning).toEqual({
    enabled: true,
    metric: 'bytes_processed',
    threshold: 1000001,
  });
});

test('saving untouched settings leaves an absent warning rule absent', async () => {
  const extra = {
    cost_estimate_enabled: true,
    allows_virtual_table_explore: true,
  };
  fetchMock.get(connectionEndpoint, {
    result: {
      id: 10,
      database_name: 'No warning rule',
      backend: 'bigquery',
      expose_in_sqllab: true,
      configuration_method: 'sqlalchemy_form',
      sqlalchemy_uri: 'bigquery://project',
      engine_information: { query_cost_warning_metric: 'bytes_processed' },
      extra: JSON.stringify(extra),
    },
  });
  fetchMock.put(
    databaseEndpoint,
    { id: 10, result: {} },
    { name: 'database-update' },
  );
  render(<DatabaseModal show databaseId={10} onHide={jest.fn()} />, {
    useRedux: true,
  });
  await userEvent.click(await screen.findByRole('tab', { name: 'Advanced' }));
  await userEvent.click(await screen.findByText('SQL Lab'));
  expect(
    screen.getByLabelText('Enable pre-run cost warnings'),
  ).not.toBeChecked();
  await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('database-update')).toHaveLength(1),
  );
  const request = JSON.parse(
    fetchMock.callHistory.calls('database-update')[0].options.body as string,
  ) as DatabaseObject;
  expect(JSON.parse(request.extra || '{}')).toEqual(extra);
});
