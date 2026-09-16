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
import { JsonObject, QueryFormData, VizType } from '@superset-ui/core';
import { getChartDataRequest } from 'src/components/Chart/chartAction';

/**
 * Integration (mocked-network) port of the deprecated Cypress spec
 * `cypress/e2e/dashboard/_skip.url_params.test.ts` (sc-107448).
 *
 * The original test loaded a dashboard with query-string params, intercepted
 * `/api/v1/chart/data`, and asserted each query in the request body carried
 * `url_params`. That assertion is request-construction logic — the form_data
 * → query-context pipeline — which is exercised here without a backend.
 *
 * Intentional narrowing: the URL-string → `form_data.url_params` hop (handled
 * in `src/dashboard/actions/hydrate.ts` via `extractUrlParams`) is not covered
 * here. This file verifies the chart-data side of the contract only; the
 * dashboard hydration side is covered by its own unit tests.
 */
const CHART_DATA_GLOB = 'glob:*/api/v1/chart/data*';
const CHART_DATA_ROUTE = 'urlParamsForwarding-chartData';
const URL_PARAMS = { param1: '123', param2: 'abc' };

type ChartDataRequestBody = {
  queries: JsonObject[];
  form_data: JsonObject;
};

const buildFormData = (
  overrides: Partial<QueryFormData> = {},
): QueryFormData => ({
  datasource: '1__table',
  granularity_sqla: 'ds',
  viz_type: VizType.Table,
  url_params: URL_PARAMS,
  ...overrides,
});

const lastChartDataBody = (): ChartDataRequestBody => {
  const calls = fetchMock.callHistory.calls(CHART_DATA_ROUTE);
  expect(calls.length).toBeGreaterThan(0);
  return JSON.parse(
    calls[calls.length - 1].options.body as string,
  ) as ChartDataRequestBody;
};

beforeEach(() => {
  fetchMock.post(
    CHART_DATA_GLOB,
    { result: [{ data: [] }] },
    {
      name: CHART_DATA_ROUTE,
    },
  );
});

// Remove only this file's route so global routes registered in
// setupSupersetClient (e.g. CSRF) survive into the next test.
afterEach(() => {
  fetchMock.clearHistory();
  fetchMock.removeRoutes({ names: [CHART_DATA_ROUTE] });
});

test('forwards url_params from form_data onto each query in the chart-data request body', async () => {
  await getChartDataRequest({ formData: buildFormData() });

  const body = lastChartDataBody();
  expect(Array.isArray(body.queries)).toBe(true);
  expect(body.queries.length).toBeGreaterThan(0);
  body.queries.forEach(query => {
    expect(query.url_params).toEqual(URL_PARAMS);
  });
});

test('preserves url_params on form_data echoed back in the chart-data request body', async () => {
  await getChartDataRequest({ formData: buildFormData() });

  const body = lastChartDataBody();
  expect(body.form_data.url_params).toEqual(URL_PARAMS);
});

// buildQueryObject defaults missing url_params to `{}` (see
// packages/superset-ui-core/src/query/buildQueryObject.ts), so the chart-data
// request body carries an empty object — not `undefined`. This test documents
// that contract; a future change that flips the default should update both.
test('emits an empty url_params object on each query when form_data has none', async () => {
  await getChartDataRequest({
    formData: buildFormData({ url_params: undefined }),
  });

  const body = lastChartDataBody();
  expect(body.queries.length).toBeGreaterThan(0);
  body.queries.forEach(query => {
    expect(query.url_params).toEqual({});
  });
});
