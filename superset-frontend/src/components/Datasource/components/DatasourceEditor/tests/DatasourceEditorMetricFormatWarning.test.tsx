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

const WARNING_TEXT = /D3 format is a percentage/i;

// A '%' format is valid syntax, so it never hits the "Invalid format" fallback.
test('warns when a percent D3 format is set on a COUNT metric', async () => {
  const testProps = createProps();
  fastRender(testProps);
  await dismissDatasourceWarning();

  await userEvent.click(await screen.findByTestId('collection-tab-Metrics'));
  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  // Rows sort by metric id descending, so `COUNT(*)` (id 7) is first.
  await userEvent.click(expandToggles[0]);

  expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();

  await userEvent.type(await screen.findByPlaceholderText('%y/%m/%d'), '.0%');

  expect(await screen.findByText(WARNING_TEXT)).toBeInTheDocument();
});

test('does not warn for a non-percent format on a COUNT metric', async () => {
  const testProps = createProps();
  fastRender(testProps);
  await dismissDatasourceWarning();

  await userEvent.click(await screen.findByTestId('collection-tab-Metrics'));
  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  await userEvent.click(expandToggles[0]);

  await userEvent.type(await screen.findByPlaceholderText('%y/%m/%d'), ',.0f');

  await waitFor(() =>
    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument(),
  );
});

test('does not warn for a percent format on a non-COUNT metric', async () => {
  const testProps = createProps();
  fastRender(testProps);
  await dismissDatasourceWarning();

  await userEvent.click(await screen.findByTestId('collection-tab-Metrics'));
  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  // Rows sort by metric id descending, so id 1 (`SUM(...)`) sorts last.
  await userEvent.click(expandToggles[6]);

  await userEvent.type(await screen.findByPlaceholderText('%y/%m/%d'), '.0%');

  await waitFor(() =>
    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument(),
  );
});
