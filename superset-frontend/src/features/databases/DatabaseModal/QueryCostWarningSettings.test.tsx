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
import { useReducer } from 'react';
import { FeatureFlag } from '@superset-ui/core';
import {
  fireEvent,
  render,
  screen,
  selectOption,
  userEvent,
} from 'spec/helpers/testing-library';
import QueryCostWarningSettings from './QueryCostWarningSettings';
import { ActionType, dbReducer } from './index';
import {
  getQueryCostWarning,
  getQueryCostWarningError,
} from '../queryCostWarning';
import { ExtraJson, QueryCostWarningMetric } from '../types';

/** Exercise the settings with the actual database modal reducer. */
function SettingsHarness({
  extra,
  metric = 'bytes_processed',
  engine = 'bigquery',
}: {
  extra: ExtraJson;
  metric?: QueryCostWarningMetric | null;
  engine?: string;
}) {
  const [db, dispatch] = useReducer(dbReducer, {
    backend: engine,
    engine_information: { query_cost_warning_metric: metric },
    extra: JSON.stringify(extra),
  });
  const currentExtra: ExtraJson = JSON.parse(db?.extra || '{}');
  const hasError = !!getQueryCostWarningError(
    getQueryCostWarning(currentExtra),
    metric,
  );
  return (
    <>
      <QueryCostWarningSettings
        extra={currentExtra}
        metric={metric}
        onChange={rule =>
          dispatch({
            type: ActionType.ExtraEditorChange,
            payload: { name: 'query_cost_warning', json: JSON.stringify(rule) },
          })
        }
      />
      <button type="button" disabled={hasError}>
        Save
      </button>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: ActionType.ExtraInputChange,
            payload: {
              name: 'cost_estimate_enabled',
              type: 'checkbox',
              checked: false,
            },
          })
        }
      >
        Turn estimation off
      </button>
      <output data-test="saved-extra">{db?.extra}</output>
    </>
  );
}

/** Read only the serialized settings that the database modal would submit. */
function savedExtra(): ExtraJson {
  return JSON.parse(
    screen.getByTestId('saved-extra').textContent || '{}',
  ) as ExtraJson;
}

beforeEach(() => {
  window.featureFlags = {
    [FeatureFlag.EstimateQueryCost]: true,
    [FeatureFlag.SqlLabQueryCostWarnings]: true,
  };
});

test('unit changes preserve bytes and disabled values survive reopening', async () => {
  const initial: ExtraJson = {
    cost_estimate_enabled: true,
    allows_virtual_table_explore: true,
    query_cost_warning: {
      enabled: true,
      metric: 'bytes_processed',
      threshold: 2000000000,
    },
  };
  const view = render(<SettingsHarness extra={initial} />);
  const amount = screen.getByLabelText('Warning threshold (bytes processed)');
  expect(amount).toHaveValue(2);
  await selectOption('MB', 'Threshold size unit');
  expect(amount).toHaveValue(2000);
  expect(savedExtra()).toEqual(initial);
  await selectOption('Bytes', 'Threshold size unit');
  expect(amount).toHaveValue(2000000000);
  expect(savedExtra()).toEqual(initial);
  await selectOption('GB', 'Threshold size unit');
  fireEvent.change(amount, { target: { value: '1.25' } });
  expect(savedExtra().query_cost_warning?.threshold).toBe(1250000000);
  await userEvent.click(screen.getByLabelText('Enable pre-run cost warnings'));
  expect(amount).toHaveValue(1.25);
  expect(amount).toBeDisabled();
  const saved = savedExtra();
  expect(saved).toEqual({
    ...initial,
    query_cost_warning: {
      enabled: false,
      metric: 'bytes_processed',
      threshold: 1250000000,
    },
  });
  view.unmount();
  render(<SettingsHarness extra={saved} />);
  expect(
    screen.getByLabelText('Enable pre-run cost warnings'),
  ).not.toBeChecked();
  expect(
    screen.getByLabelText('Warning threshold (bytes processed)'),
  ).toHaveValue(1250);
  expect(savedExtra()).toEqual(saved);
});

test('fractional bytes show validation and cannot be saved or silently rounded', async () => {
  render(
    <SettingsHarness
      extra={{
        cost_estimate_enabled: true,
        query_cost_warning: {
          enabled: true,
          metric: 'bytes_processed',
          threshold: 1000000,
        },
      }}
    />,
  );
  const amount = screen.getByLabelText('Warning threshold (bytes processed)');
  fireEvent.change(amount, { target: { value: '0.0000001' } });
  expect(amount).toHaveValue(0.0000001);
  expect(
    screen.getByText(/amount that equals positive whole bytes/),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(savedExtra().query_cost_warning).not.toHaveProperty('threshold');
  fireEvent.change(amount, { target: { value: '1.000001' } });
  expect(savedExtra().query_cost_warning?.threshold).toBe(1000001);
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('large byte amounts display exactly in every unit', async () => {
  render(
    <SettingsHarness
      extra={{
        cost_estimate_enabled: true,
        query_cost_warning: {
          enabled: true,
          metric: 'bytes_processed',
          threshold: Number.MAX_SAFE_INTEGER,
        },
      }}
    />,
  );
  const amount = screen.getByLabelText('Warning threshold (bytes processed)');
  await selectOption('GB', 'Threshold size unit');
  expect(amount).toHaveAttribute('value', '9007199.254740991');
  expect(savedExtra().query_cost_warning?.threshold).toBe(
    Number.MAX_SAFE_INTEGER,
  );
  fireEvent.change(amount, { target: { value: '9007199.254740992' } });
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.change(amount, { target: { value: '9007199.254740991' } });
  expect(savedExtra().query_cost_warning?.threshold).toBe(
    Number.MAX_SAFE_INTEGER,
  );
});

test('turning connection estimation off retains the complete warning rule', async () => {
  const rule = {
    enabled: true,
    metric: 'bytes_processed' as const,
    threshold: 1500000,
  };
  render(
    <SettingsHarness
      extra={{ cost_estimate_enabled: true, query_cost_warning: rule }}
    />,
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Turn estimation off' }),
  );
  expect(screen.getByText(/Saved settings are retained/)).toBeInTheDocument();
  expect(savedExtra().query_cost_warning).toEqual(rule);
  expect(screen.getByLabelText('Enable pre-run cost warnings')).toBeChecked();
  expect(
    screen.getByLabelText('Warning threshold (bytes processed)'),
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('PostgreSQL accepts decimals and explains its relative planner cost', () => {
  render(
    <SettingsHarness
      engine="postgresql"
      metric="total_cost"
      extra={{
        cost_estimate_enabled: true,
        query_cost_warning: { enabled: true, metric: 'total_cost' },
      }}
    />,
  );
  const amount = screen.getByLabelText('Warning threshold (planner cost)');
  expect(amount).toHaveValue(null);
  expect(
    screen.getByText(/relative, not dollars or memory/),
  ).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.change(amount, { target: { value: '12.125' } });
  expect(savedExtra().query_cost_warning?.threshold).toBe(12.125);
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test.each([
  null,
  { enabled: 'invalid', metric: 'bytes_processed', threshold: 10 },
  { enabled: false, metric: 'bytes_processed', threshold: -1 },
  { enabled: true, metric: 'bytes_processed', threshold: 'invalid' },
])('broken saved rules remain disableable (%j)', rule => {
  window.featureFlags = {};
  render(<SettingsHarness extra={{ query_cost_warning: rule } as ExtraJson} />);
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.click(
    rule?.enabled === true
      ? screen.getByLabelText('Enable pre-run cost warnings')
      : screen.getByRole('button', { name: 'Disable saved rule' }),
  );
  expect(savedExtra().query_cost_warning?.enabled).toBe(false);
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('a no-longer-supported saved rule can be disabled while preserving its value', () => {
  render(
    <SettingsHarness
      engine="sqlite"
      metric={null}
      extra={{
        query_cost_warning: {
          enabled: true,
          metric: 'bytes_processed',
          threshold: 100,
        },
      }}
    />,
  );
  expect(screen.getByText(/This engine does not support/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Enable pre-run cost warnings'));
  expect(savedExtra().query_cost_warning).toEqual({
    enabled: false,
    metric: 'bytes_processed',
    threshold: 100,
  });
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test.each([
  undefined,
  { enabled: false, metric: 'bytes_processed' as const, threshold: 100 },
])(
  'enabling warnings sets the metric without reusing an incompatible threshold (%j)',
  rule => {
    render(
      <SettingsHarness
        engine="postgresql"
        metric="total_cost"
        extra={{
          cost_estimate_enabled: true,
          ...(rule && { query_cost_warning: rule }),
        }}
      />,
    );
    fireEvent.click(screen.getByLabelText('Enable pre-run cost warnings'));
    expect(savedExtra().query_cost_warning).toEqual({
      enabled: true,
      metric: 'total_cost',
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  },
);
