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
  buildQueryContext,
  QueryFormData,
  SupersetClient,
} from '@superset-ui/core';
import fetchTreeTableData from './fetchTreeTableData';

const CHART_DATA_ENDPOINT = 'glob:*/api/v1/chart/data';

const formData = {
  datasource: '1__table',
  viz_type: 'ag-grid-table',
  slice_id: 7,
  dashboardId: 3,
} as QueryFormData;

const buildQuery = (fd: QueryFormData) => buildQueryContext(fd);

const result = [
  {
    data: [{ parent: 'S1', child: 'a' }],
    colnames: ['parent', 'child'],
    coltypes: [1, 1],
    rowcount: 1,
    sql_rowcount: 1,
  },
];

const lastRequestBody = () =>
  JSON.parse(
    fetchMock.callHistory.lastCall(CHART_DATA_ENDPOINT)?.options.body as string,
  );

beforeAll(() => {
  fetchMock.mockGlobal();
  fetchMock.get('glob:*api/v1/security/csrf_token/*', { result: '1234' });
  SupersetClient.reset();
  SupersetClient.configure().init();
});

afterAll(() => fetchMock.hardReset());

afterEach(() => fetchMock.clearHistory().removeRoute(CHART_DATA_ENDPOINT));

test('sends results type, force, slice_id and dashboardId, returns result', async () => {
  fetchMock.post(
    CHART_DATA_ENDPOINT,
    { result },
    { name: CHART_DATA_ENDPOINT },
  );

  const data = await fetchTreeTableData({ formData, buildQuery, force: true });

  expect(data).toEqual(result);
  const body = lastRequestBody();
  expect(body.result_type).toBe('results');
  expect(body.result_format).toBe('json');
  expect(body.force).toBe(true);
  expect(body.form_data.slice_id).toBe(7);
  expect(body.form_data.dashboardId).toBe(3);
});

test('passes ownState to buildQuery and defaults force to false', async () => {
  fetchMock.post(
    CHART_DATA_ENDPOINT,
    { result },
    { name: CHART_DATA_ENDPOINT },
  );
  const spy = jest.fn(buildQuery);
  const ownState = { treeChildren: { parentIds: ['S1'] } };

  await fetchTreeTableData({ formData, buildQuery: spy, ownState });

  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({ force: false, result_type: 'results' }),
    { ownState },
  );
  expect(lastRequestBody().force).toBe(false);
});

test.each([400, 500])('rejects with message and status on %s', async status => {
  fetchMock.post(
    CHART_DATA_ENDPOINT,
    { status, body: { message: 'Query failed' } },
    { name: CHART_DATA_ENDPOINT },
  );

  await expect(
    fetchTreeTableData({ formData, buildQuery }),
  ).rejects.toMatchObject({ message: 'Query failed', status });
});

test('passes an abort through as AbortError', async () => {
  fetchMock.post(
    CHART_DATA_ENDPOINT,
    { result },
    { name: CHART_DATA_ENDPOINT, delay: 1000 },
  );
  const controller = new AbortController();
  const promise = fetchTreeTableData({
    formData,
    buildQuery,
    signal: controller.signal,
  });
  controller.abort();

  await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
});

test('parses the answer as json-bigint, as the chart data request does', async () => {
  fetchMock.post(
    CHART_DATA_ENDPOINT,
    {
      body: '{"result":[{"data":[{"pid":9007199254740993,"cid":5}],"colnames":["pid","cid"],"coltypes":[0,0],"rowcount":1}]}',
      headers: { 'Content-Type': 'application/json' },
    },
    { name: CHART_DATA_ENDPOINT },
  );
  const post = jest.spyOn(SupersetClient, 'post');

  const [answer] = await fetchTreeTableData({ formData, buildQuery });

  expect(post).toHaveBeenCalledWith(
    expect.objectContaining({ parseMethod: 'json-bigint' }),
  );
  expect(answer.data[0].pid).toBe(BigInt('9007199254740993'));
  expect(answer.data[0].cid).toBe(5);
  post.mockRestore();
});
