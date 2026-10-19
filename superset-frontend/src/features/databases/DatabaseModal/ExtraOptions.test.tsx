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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import { t } from '@apache-superset/core/translation';
import { FeatureFlag } from '@superset-ui/core';
import * as ace from 'ace-builds';

import ExtraOptions from './ExtraOptions';
import { DatabaseObject, QueryCostWarningMetric } from '../types';

const defaultDb = {
  backend: 'sqlite',
  expose_in_sqllab: true,
  allow_ctas: false,
  allow_cvas: false,
  allow_dml: false,
  allow_run_async: false,
  cache_timeout: 300,
  force_ctas_schema: 'public',
  masked_encrypted_extra: '',
  server_cert: '',
  impersonate_user: false,
  extra: JSON.stringify({
    cost_estimate_enabled: false,
    allows_virtual_table_explore: true,
    disable_data_preview: false,
    schema_options: { expand_rows: false },
    metadata_cache_timeout: {
      schema_cache_timeout: 600,
      table_cache_timeout: 1200,
    },
    disable_drill_to_detail: false,
    metadata_params: {},
    engine_params: {},
    version: '',
    cancel_query_on_windows_unload: false,
  }),
  engine_information: {
    query_cost_warning_metric: undefined as QueryCostWarningMetric | undefined,
    supports_file_upload: true,
    supports_dynamic_catalog: true,
  },
  configuration_method: '', // added dummy value for configuration_method
  database_name: 'Test Database', // added dummy value for database_name
  driver: 'sqlite', // added dummy value for driver
  id: 1, // added dummy value for id
  sqlalchemy_uri: 'sqlite:///:memory:', // added dummy value for sqlalchemy_uri
  parameters: {}, // added dummy value for parameters
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ExtraOptions Component', () => {
  const onInputChange = jest.fn();
  const onTextChange = jest.fn();
  const onEditorChange = jest.fn();
  const onExtraInputChange = jest.fn();
  const onExtraEditorChange = jest.fn();

  const renderComponent = (dbProps = defaultDb, extension = undefined) =>
    render(
      <ExtraOptions
        db={dbProps as unknown as DatabaseObject}
        onInputChange={onInputChange}
        onTextChange={onTextChange}
        onEditorChange={onEditorChange}
        onExtraInputChange={onExtraInputChange}
        onExtraEditorChange={onExtraEditorChange}
        extraExtension={extension}
      />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    window.featureFlags = {
      [FeatureFlag.EstimateQueryCost]: true,
      [FeatureFlag.SqlLabQueryCostWarnings]: true,
    };
  });

  test('renders all main panels', () => {
    renderComponent();

    expect(screen.getByText(t('SQL Lab'))).toBeInTheDocument();
    expect(screen.getByText(t('Performance'))).toBeInTheDocument();
    expect(screen.getByText(t('Security'))).toBeInTheDocument();
    expect(screen.getByText(t('Other'))).toBeInTheDocument();
  });

  test('calls onInputChange when "Expose database in SQL Lab" checkbox is clicked', () => {
    renderComponent();
    const sqlLabText = screen.getByText(t('SQL Lab'));
    fireEvent.click(sqlLabText);

    const checkbox = screen.getByLabelText(t('Expose database in SQL Lab'));
    fireEvent.click(checkbox);
    expect(onInputChange).toHaveBeenCalled();
  });

  test('calls onExtraInputChange when "Enable query cost estimation" checkbox is clicked', () => {
    renderComponent();
    const sqlLabText = screen.getByText(t('SQL Lab'));
    fireEvent.click(sqlLabText);
    const checkbox = screen.getByLabelText(t('Enable query cost estimation'));
    fireEvent.click(checkbox);
    expect(onExtraInputChange).toHaveBeenCalled();
  });

  test.each([false, true])(
    'pre-run warnings require connection estimation (%s)',
    estimationEnabled => {
      renderComponent({
        ...defaultDb,
        backend: 'bigquery',
        engine_information: {
          ...defaultDb.engine_information,
          query_cost_warning_metric: 'bytes_processed',
        },
        extra: JSON.stringify({ cost_estimate_enabled: estimationEnabled }),
      });
      fireEvent.click(screen.getByText('SQL Lab'));
      const checkbox = screen.getByRole('checkbox', {
        name: 'Enable pre-run cost warnings',
      });
      expect(checkbox).not.toBeChecked();
      if (estimationEnabled) {
        expect(checkbox).toBeEnabled();
        fireEvent.click(checkbox);
        expect(onExtraInputChange).toHaveBeenCalledWith(
          expect.objectContaining({
            target: expect.objectContaining({
              name: 'query_cost_warning_enabled',
              checked: true,
            }),
          }),
        );
      } else {
        expect(checkbox).toBeDisabled();
      }
      expect(
        screen.queryByLabelText('Warning threshold (bytes processed)'),
      ).not.toBeInTheDocument();
    },
  );

  test.each([
    {
      backend: 'bigquery',
      metric: 'bytes_processed' as const,
      label: 'Warning threshold (bytes processed)',
      threshold: 100000000,
      display: 100,
      updated: '123500000',
    },
    {
      backend: 'postgresql',
      metric: 'total_cost' as const,
      label: 'Warning threshold (planner cost)',
      threshold: 12.5,
      display: 12.5,
      updated: '123.5',
    },
  ])(
    'warning thresholds retain native units for $backend',
    ({ backend, metric, label, threshold, display, updated }) => {
      renderComponent({
        ...defaultDb,
        backend,
        engine_information: {
          ...defaultDb.engine_information,
          query_cost_warning_metric: metric,
        },
        extra: JSON.stringify({
          cost_estimate_enabled: true,
          query_cost_warning: { enabled: true, metric, threshold },
        }),
      });
      fireEvent.click(screen.getByText('SQL Lab'));
      const amount = screen.getByLabelText(label);
      expect(amount).toHaveValue(display);
      fireEvent.change(amount, { target: { value: '123.5' } });
      expect(onExtraInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            name: 'query_cost_warning_threshold',
            value: updated,
          }),
        }),
      );
    },
  );

  test('enabled warnings remain disableable after estimation is turned off', () => {
    renderComponent({
      ...defaultDb,
      engine_information: {
        ...defaultDb.engine_information,
        query_cost_warning_metric: 'total_cost',
      },
      extra: JSON.stringify({
        cost_estimate_enabled: false,
        query_cost_warning: {
          enabled: true,
          metric: 'total_cost',
          threshold: 12.5,
        },
      }),
    });
    fireEvent.click(screen.getByText('SQL Lab'));
    const checkbox = screen.getByLabelText('Enable pre-run cost warnings');
    expect(checkbox).toBeEnabled();
    expect(checkbox).toBeChecked();
    expect(
      screen.getByLabelText('Warning threshold (planner cost)'),
    ).toBeDisabled();
    fireEvent.click(checkbox);
    expect(onExtraInputChange).toHaveBeenCalled();
  });

  test('warning settings explain when the warning flag is off', () => {
    window.featureFlags = { [FeatureFlag.EstimateQueryCost]: true };
    renderComponent({
      ...defaultDb,
      engine_information: {
        ...defaultDb.engine_information,
        query_cost_warning_metric: 'total_cost',
      },
    });
    fireEvent.click(screen.getByText('SQL Lab'));
    expect(
      screen.getByLabelText('Enable pre-run cost warnings'),
    ).toBeDisabled();
    expect(
      screen.getByText(/SQLLAB_QUERY_COST_WARNINGS is off/),
    ).toBeInTheDocument();
  });

  test('warnings cannot be enabled when the global estimate flag is off', () => {
    window.featureFlags = { [FeatureFlag.SqlLabQueryCostWarnings]: true };
    renderComponent({
      ...defaultDb,
      engine_information: {
        ...defaultDb.engine_information,
        query_cost_warning_metric: 'total_cost',
      },
      extra: JSON.stringify({ cost_estimate_enabled: true }),
    });
    fireEvent.click(screen.getByText('SQL Lab'));
    expect(
      screen.getByLabelText('Enable pre-run cost warnings'),
    ).toBeDisabled();
  });

  test('a saved rule can be disabled after changing to an unsupported engine', () => {
    renderComponent({
      ...defaultDb,
      extra: JSON.stringify({
        query_cost_warning: {
          enabled: true,
          metric: 'bytes_processed',
          threshold: 100,
        },
      }),
    });
    fireEvent.click(screen.getByText('SQL Lab'));
    const checkbox = screen.getByLabelText('Enable pre-run cost warnings');
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeEnabled();
    fireEvent.click(checkbox);
    expect(onExtraInputChange).toHaveBeenCalled();
  });

  test('calls onExtraEditorChange when metadata_params json editor changes', async () => {
    renderComponent();

    // Click to open the editor tab/section
    const otherHeader = screen.getByText(t('Other'));
    fireEvent.click(otherHeader);

    // Wait for Ace to initialize (in case it's async)
    await waitFor(() => {
      expect(document.querySelector('#metadata_params')).toBeInTheDocument();
    });

    // Grab editor instance by ID or name
    const editorInstance = ace.edit('metadata_params');

    act(() => {
      editorInstance.setValue('{"key":"value"}');
    });

    expect(onExtraEditorChange).toHaveBeenCalledWith({
      json: '{"key":"value"}',
      name: 'metadata_params',
    });

    act(() => {
      editorInstance.setValue('foo');
    });

    expect(onExtraEditorChange).toHaveBeenCalledWith({
      json: 'foo',
      name: 'metadata_params',
    });

    // it accepts invalid json strings
    act(() => {
      editorInstance.setValue('{"key":"value');
    });

    expect(onExtraEditorChange).toHaveBeenCalledWith({
      json: '{"key":"value',
      name: 'metadata_params',
    });
  });

  test('calls onTextChange when server certificate textarea is changed', () => {
    renderComponent();
    // Click to open the security tab/section
    const securityHeader = screen.getByText(t('Security'));
    fireEvent.click(securityHeader);

    const textarea = screen.getByPlaceholderText(t('Enter CA_BUNDLE'));
    fireEvent.change(textarea, { target: { value: 'new cert' } });
    expect(onTextChange).toHaveBeenCalled();
  });

  test('handles input change for schema cache timeout', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('schema-cache-timeout-test');
    fireEvent.change(input, { target: { value: '500' } });
    expect(onExtraInputChange).toHaveBeenCalled();
  });

  test('schema cache timeout input has min=0 to prevent negative values', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('schema-cache-timeout-test');
    expect(input).toHaveAttribute('min', '0');
  });

  test('schema cache timeout rejects negative values', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('schema-cache-timeout-test');
    fireEvent.change(input, {
      target: { value: '-4', name: 'schema_cache_timeout' },
    });
    expect(onExtraInputChange).not.toHaveBeenCalled();
  });

  test('handles input change for table cache timeout', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('table-cache-timeout-test');
    fireEvent.change(input, { target: { value: '1000' } });
    expect(onExtraInputChange).toHaveBeenCalled();
  });

  test('table cache timeout input has min=0 to prevent negative values', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('table-cache-timeout-test');
    expect(input).toHaveAttribute('min', '0');
  });

  test('table cache timeout rejects negative values', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('table-cache-timeout-test');
    fireEvent.change(input, {
      target: { value: '-1', name: 'table_cache_timeout' },
    });
    expect(onExtraInputChange).not.toHaveBeenCalled();
  });

  test('chart cache timeout input has min=-1', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('cache-timeout-test');
    expect(input).toHaveAttribute('min', '-1');
  });

  test('chart cache timeout allows -1 (bypass cache)', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('cache-timeout-test');
    fireEvent.change(input, {
      target: { value: '-1', name: 'cache_timeout' },
    });
    expect(onInputChange).toHaveBeenCalled();
  });

  test('chart cache timeout rejects values less than -1', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('cache-timeout-test');
    fireEvent.change(input, {
      target: { value: '-5', name: 'cache_timeout' },
    });
    expect(onInputChange).not.toHaveBeenCalled();
  });

  test('renders the collaps tab correctly and resets to default tab after closing', () => {
    const { rerender } = renderComponent();
    const sqlLabTab = screen.getByRole('tab', {
      name: /SQL Lab./i,
    });

    expect(sqlLabTab).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(sqlLabTab);
    expect(sqlLabTab).toHaveAttribute('aria-expanded', 'true');
    const customDb = {
      ...defaultDb,
      expose_in_sqllab: false,
    };

    rerender(
      <ExtraOptions
        db={customDb as unknown as DatabaseObject}
        onInputChange={onInputChange}
        onTextChange={onTextChange}
        onEditorChange={onEditorChange}
        onExtraInputChange={onExtraInputChange}
        onExtraEditorChange={onExtraEditorChange}
        extraExtension={undefined}
      />,
    );
    expect(sqlLabTab).toHaveAttribute('aria-expanded', 'false');
  });

  test('all collapse panels should expand when clicking anywhere on the header', () => {
    renderComponent();
    const allPanelTabs = screen.getAllByRole('tab');
    expect(allPanelTabs.length).toBeGreaterThanOrEqual(4); // At least 4 main panels

    allPanelTabs.forEach(panelTab => {
      // Initially should be collapsed
      expect(panelTab).toHaveAttribute('aria-expanded', 'false');
      // Click on the panel tab (entire header should be clickable)
      fireEvent.click(panelTab);
      expect(panelTab).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(panelTab);
      // Panel should collapse back
      expect(panelTab).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
