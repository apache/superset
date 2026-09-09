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

// Certifying a metric fills two adjacent fields in one visit to the expanded
// row. Both are committed through TextControl's debounce, so the second one
// used to land on the item as it looked before the first had been applied,
// leaving the saved metric with details but no certifier.
test('certifying a metric keeps both certified_by and certification_details', async () => {
  const testProps = createProps();
  fastRender(testProps);
  await dismissDatasourceWarning();

  await userEvent.click(await screen.findByTestId('collection-tab-Metrics'));
  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  await userEvent.click(expandToggles[0]);

  await userEvent.type(
    await screen.findByPlaceholderText('Certified by'),
    'Metric Certifier',
  );
  await userEvent.type(
    await screen.findByPlaceholderText('Certification details'),
    'Metric cert details',
  );

  await waitFor(() => {
    const { calls } = testProps.onChange.mock;
    const savedMetrics = calls[calls.length - 1]?.[0]?.metrics ?? [];
    const saved = savedMetrics.find(metric => metric.metric_name === 'count');
    expect(saved).toEqual(
      expect.objectContaining({
        certified_by: 'Metric Certifier',
        certification_details: 'Metric cert details',
      }),
    );
  });
});
