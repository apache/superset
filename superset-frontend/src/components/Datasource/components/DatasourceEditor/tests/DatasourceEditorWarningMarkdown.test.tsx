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
import { screen, userEvent } from 'spec/helpers/testing-library';
import {
  createProps,
  DATASOURCE_ENDPOINT,
  setupDatasourceEditorMocks,
  cleanupAsyncOperations,
  fastRender,
  dismissDatasourceWarning,
} from './DatasourceEditor.test.utils';

// Stub the Ace-backed control with a plain textarea. Ace spreads its document
// across many spans and keeps only the keystroke buffer in its own textarea,
// so asserting on the value the control receives is less brittle than
// reaching into Ace's DOM.
jest.mock('src/explore/components/controls/TextAreaControl', () => ({
  __esModule: true,
  default: ({
    controlId,
    value,
    onChange,
  }: {
    controlId?: string;
    value?: string;
    onChange?: (value: string) => void;
  }) => (
    <textarea
      data-test={`mock-textarea-${controlId}`}
      value={value ?? ''}
      onChange={event => onChange?.(event.target.value)}
    />
  ),
}));

beforeEach(() => {
  fetchMock.get(DATASOURCE_ENDPOINT, [], { name: DATASOURCE_ENDPOINT });
  setupDatasourceEditorMocks();
});

afterEach(async () => {
  await cleanupAsyncOperations();
  fetchMock.clearHistory().removeRoutes();
});

// Regression test for #42704. Explore's datasource payload (SqlMetric.data on
// the backend) exposes warning_markdown as a flattened top-level field and
// omits the raw `extra` JSON string that the /api/v1/dataset/{id} endpoint
// backing the Datasets page provides. Deriving warning_markdown purely from
// `extra` therefore dropped the saved text when the modal was opened from
// Explore, leaving the Warning field blank on reopen.
test('keeps a pre-existing top-level warning_markdown when the metric has no extra', async () => {
  const baseProps = createProps();
  const testProps = {
    ...baseProps,
    datasource: {
      ...baseProps.datasource,
      metrics: [
        {
          ...baseProps.datasource.metrics[0],
          warning_markdown: 'existing warning',
          extra: undefined,
        },
      ],
    },
  };

  fastRender(testProps);
  await dismissDatasourceWarning();

  const metricsTab = await screen.findByTestId('collection-tab-Metrics');
  await userEvent.click(metricsTab);

  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  await userEvent.click(expandToggles[0]);

  expect(
    await screen.findByTestId('mock-textarea-warning_markdown'),
  ).toHaveValue('existing warning');
});
