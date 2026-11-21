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
import {
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
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
  fetchMock.get('glob:*/api/v1/time_range/*', {
    result: [{ since: '', until: '', timeRange: 'Last day' }],
  });
  setupDatasourceEditorMocks();
});

afterEach(async () => {
  await cleanupAsyncOperations();
  fetchMock.clearHistory().removeRoutes();
});

test('resets the default time filter to the instance default and keeps other metadata', async () => {
  const props = createProps();
  props.datasource.extra = JSON.stringify({
    default_time_filter: 'Last day',
    warning_markdown: 'Note',
  });
  fastRender(props);
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByTestId('collection-tab-Columns'));
  const settings = screen.getByTestId('default-column-settings');
  expect(
    within(settings).getByRole('button', { name: 'Default time filter' }),
  ).toHaveTextContent('Last day');

  await userEvent.click(
    within(settings).getByRole('button', { name: 'Use instance default' }),
  );

  await waitFor(() => {
    const { calls } = props.onChange.mock;
    const [datasource] = calls[calls.length - 1];
    expect(JSON.parse(datasource.extra ?? '')).toEqual({
      warning_markdown: 'Note',
    });
  });
  expect(
    within(settings).getByRole('button', { name: 'Default time filter' }),
  ).toHaveTextContent('Use instance default');
  expect(
    within(settings).queryByRole('button', { name: 'Use instance default' }),
  ).not.toBeInTheDocument();
});
