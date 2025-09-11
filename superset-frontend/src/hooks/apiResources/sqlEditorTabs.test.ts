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
import { act, renderHook } from '@testing-library/react-hooks';
import {
  createWrapper,
  defaultStore as store,
} from 'spec/helpers/testing-library';
import { api } from 'src/hooks/apiResources/queryApi';
import { LatestQueryEditorVersion } from 'src/SqlLab/types';
import {
  useDeleteSqlEditorTabMutation,
  useUpdateCurrentSqlEditorTabMutation,
  useUpdateSqlEditorTabMutation,
} from './sqlEditorTabs';

const expectedQueryEditor = {
  version: LatestQueryEditorVersion,
  id: '123',
  dbId: 456,
  name: 'tab 1',
  sql: 'SELECT * from example_table',
  schema: 'my_schema',
  templateParams: '{"a": 1, "v": "str"}',
  queryLimit: 1000,
  remoteId: null,
  autorun: false,
  hideLeftBar: false,
  updatedAt: Date.now(),
};

afterEach(() => {
  fetchMock.reset();
  act(() => {
    store.dispatch(api.util.resetApiState());
  });
});

test('puts api request with formData', async () => {
  const tabStateMutationApiRoute = `glob:*/tabstateview/${expectedQueryEditor.id}`;
  fetchMock.put(tabStateMutationApiRoute, 200);
  const { result, waitFor } = renderHook(
    () => useUpdateSqlEditorTabMutation(),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );
  act(() => {
    result.current[0]({
      queryEditor: expectedQueryEditor,
    });
  });
  await waitFor(() =>
    expect(fetchMock.calls(tabStateMutationApiRoute).length).toBe(1),
  );
  const formData = fetchMock.calls(tabStateMutationApiRoute)[0][1]
    ?.body as FormData;
  expect(formData.get('database_id')).toBe(`${expectedQueryEditor.dbId}`);
  expect(formData.get('schema')).toBe(
    JSON.stringify(`${expectedQueryEditor.schema}`),
  );
  expect(formData.get('sql')).toBe(
    JSON.stringify(`${expectedQueryEditor.sql}`),
  );
  expect(formData.get('label')).toBe(
    JSON.stringify(`${expectedQueryEditor.name}`),
  );
  expect(formData.get('query_limit')).toBe(`${expectedQueryEditor.queryLimit}`);
  expect(formData.has('latest_query_id')).toBe(false);
  expect(formData.get('template_params')).toBe(
    JSON.stringify(`${expectedQueryEditor.templateParams}`),
  );
  expect(formData.get('hide_left_bar')).toBe(
    `${expectedQueryEditor.hideLeftBar}`,
  );
  expect(formData.get('extra_json')).toBe(
    JSON.stringify(
      JSON.stringify({
        updatedAt: expectedQueryEditor.updatedAt,
        version: LatestQueryEditorVersion,
      }),
    ),
  );
});

test('posts activate request with queryEditorId', async () => {
  const tabStateMutationApiRoute = `glob:*/tabstateview/${expectedQueryEditor.id}/activate`;
  fetchMock.post(tabStateMutationApiRoute, 200);
  const { result, waitFor } = renderHook(
    () => useUpdateCurrentSqlEditorTabMutation(),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );
  act(() => {
    result.current[0](expectedQueryEditor.id);
  });
  await waitFor(() =>
    expect(fetchMock.calls(tabStateMutationApiRoute).length).toBe(1),
  );
});

test('deletes destoryed query editors', async () => {
  const tabStateMutationApiRoute = `glob:*/tabstateview/${expectedQueryEditor.id}`;
  fetchMock.delete(tabStateMutationApiRoute, 200);
  const { result, waitFor } = renderHook(
    () => useDeleteSqlEditorTabMutation(),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );
  act(() => {
    result.current[0](expectedQueryEditor.id);
  });
  await waitFor(() =>
    expect(fetchMock.calls(tabStateMutationApiRoute).length).toBe(1),
  );
});
