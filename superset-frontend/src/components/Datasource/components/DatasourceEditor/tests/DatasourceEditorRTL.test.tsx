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
import { screen, userEvent, waitFor } from 'spec/helpers/testing-library';
import {
  props,
  asyncRender,
  DATASOURCE_ENDPOINT,
  setupDatasourceEditorMocks,
} from './DatasourceEditor.test';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('DatasourceEditor RTL Metrics Tests', () => {
  beforeEach(() => {
    fetchMock.get(DATASOURCE_ENDPOINT, [], { overwriteRoutes: true });
    setupDatasourceEditorMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    fetchMock.restore();
  });

  test('properly renders the metric information', async () => {
    await asyncRender(props);

    const metricButton = screen.getByTestId('collection-tab-Metrics');
    await userEvent.click(metricButton);

    const expandToggle = await screen.findAllByLabelText(/expand row/i);
    // Metrics are sorted by ID descending, so metric with id=1 (which has certification)
    // is at position 6 (last). Expand that one.
    await userEvent.click(expandToggle[6]);

    // Wait for fields to appear
    const certificationDetails = await screen.findByPlaceholderText(
      /certification details/i,
    );
    const certifiedBy = await screen.findByPlaceholderText(/certified by/i);

    expect(certificationDetails).toHaveValue('foo');
    expect(certifiedBy).toHaveValue('someone');
  });

  test('properly updates the metric information', async () => {
    await asyncRender(props);

    const metricButton = screen.getByTestId('collection-tab-Metrics');
    await userEvent.click(metricButton);

    const expandToggle = await screen.findAllByLabelText(/expand row/i);
    await userEvent.click(expandToggle[1]);

    const certifiedBy = await screen.findByPlaceholderText(/certified by/i);
    // Use userEvent.clear and userEvent.type instead of directly setting value
    await userEvent.clear(certifiedBy);
    await userEvent.type(certifiedBy, 'I am typing a new name');

    const certificationDetails = await screen.findByPlaceholderText(
      /certification details/i,
    );
    await waitFor(() => {
      expect(certifiedBy).toHaveValue('I am typing a new name');
    });

    await userEvent.clear(certificationDetails);
    await userEvent.type(certificationDetails, 'I am typing something new');

    await waitFor(() => {
      expect(certificationDetails).toHaveValue('I am typing something new');
    });
  });
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('DatasourceEditor RTL Columns Tests', () => {
  beforeEach(() => {
    fetchMock.get(DATASOURCE_ENDPOINT, [], { overwriteRoutes: true });
    setupDatasourceEditorMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    fetchMock.restore();
  });

  test('shows the default datetime column', async () => {
    await asyncRender(props);

    const columnsButton = screen.getByTestId('collection-tab-Columns');
    await userEvent.click(columnsButton);

    const dsDefaultDatetimeRadio = screen.getByTestId('radio-default-dttm-ds');
    expect(dsDefaultDatetimeRadio).toBeChecked();

    const genderDefaultDatetimeRadio = screen.getByTestId(
      'radio-default-dttm-gender',
    );
    expect(genderDefaultDatetimeRadio).not.toBeChecked();
  });

  test('allows choosing only temporal columns as the default datetime', async () => {
    await asyncRender(props);

    const columnsButton = screen.getByTestId('collection-tab-Columns');
    await userEvent.click(columnsButton);

    const dsDefaultDatetimeRadio = screen.getByTestId('radio-default-dttm-ds');
    expect(dsDefaultDatetimeRadio).toBeEnabled();

    const genderDefaultDatetimeRadio = screen.getByTestId(
      'radio-default-dttm-gender',
    );
    expect(genderDefaultDatetimeRadio).toBeDisabled();
  });
});
