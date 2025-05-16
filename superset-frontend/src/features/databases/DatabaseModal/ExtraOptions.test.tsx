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
import { t } from '@superset-ui/core';
import * as ace from 'ace-builds';

import ExtraOptions from './ExtraOptions';
import { DatabaseObject } from '../types';

const defaultDb = {
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
  });

  it('renders all main panels', () => {
    renderComponent();

    expect(screen.getByText(t('SQL Lab'))).toBeInTheDocument();
    expect(screen.getByText(t('Performance'))).toBeInTheDocument();
    expect(screen.getByText(t('Security'))).toBeInTheDocument();
    expect(screen.getByText(t('Other'))).toBeInTheDocument();
  });

  it('calls onInputChange when "Expose database in SQL Lab" checkbox is clicked', () => {
    renderComponent();
    const sqlLabText = screen.getByText(t('SQL Lab'));
    fireEvent.click(sqlLabText);

    const checkbox = screen.getByLabelText(t('Expose database in SQL Lab'));
    fireEvent.click(checkbox);
    expect(onInputChange).toHaveBeenCalled();
  });

  it('calls onExtraInputChange when "Enable query cost estimation" checkbox is clicked', () => {
    renderComponent();
    const sqlLabText = screen.getByText(t('SQL Lab'));
    fireEvent.click(sqlLabText);
    const checkbox = screen.getByLabelText(t('Enable query cost estimation'));
    fireEvent.click(checkbox);
    expect(onExtraInputChange).toHaveBeenCalled();
  });

  it('calls onExtraEditorChange when metadata_params json editor changes', async () => {
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

  it('calls onTextChange when server certificate textarea is changed', () => {
    renderComponent();
    // Click to open the security tab/section
    const securityHeader = screen.getByText(t('Security'));
    fireEvent.click(securityHeader);

    const textarea = screen.getByPlaceholderText(t('Enter CA_BUNDLE'));
    fireEvent.change(textarea, { target: { value: 'new cert' } });
    expect(onTextChange).toHaveBeenCalled();
  });

  it('handles input change for schema cache timeout', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('schema-cache-timeout-test');
    fireEvent.change(input, { target: { value: '500' } });
    expect(onExtraInputChange).toHaveBeenCalled();
  });

  it('handles input change for table cache timeout', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('table-cache-timeout-test');
    fireEvent.change(input, { target: { value: '1000' } });
    expect(onExtraInputChange).toHaveBeenCalled();
  });
});
