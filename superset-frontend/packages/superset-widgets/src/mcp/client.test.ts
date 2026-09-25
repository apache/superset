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
  createMcpWidgetClient,
  extractPayload,
  getArtifactMcp,
  type ArtifactMcp,
} from './client';
import { WidgetMcpError } from './errors';

const SERVER = 'Superset';

const chart = {
  type: 'echarts',
  props: {
    dataBinding: {
      datasetId: 17,
      metrics: ['sum__num'],
      dimensions: ['state'],
      rowLimit: 10,
      filters: [
        {
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'gender',
          operator: '==',
          comparator: 'girl',
        },
      ],
    },
  },
};

const stubMcp = (...results: unknown[]) => {
  const callTool = jest.fn();
  results.forEach(result =>
    result instanceof Error || (result as { code?: string })?.code
      ? callTool.mockRejectedValueOnce(result)
      : callTool.mockResolvedValueOnce(result),
  );
  return { callTool } satisfies ArtifactMcp;
};

test('widget-tools sends inline widgets and host filters to get_widget_data', async () => {
  const mcp = stubMcp({
    payload: { columns: ['state', 'sum__num'], rows: [{ state: 'CA' }] },
  });
  const client = createMcpWidgetClient({ mcp, server: SERVER });

  const result = await client.fetchData({
    instanceId: 'bar',
    widget: chart,
    filters: [
      { column: 'state', operator: 'IN', value: ['CA'], datasource: 17 },
    ],
  });

  expect(mcp.callTool).toHaveBeenCalledWith(SERVER, 'get_widget_data', {
    request: {
      widget: chart,
      filters: [{ column: 'state', operator: 'IN', value: ['CA'] }],
    },
  });
  expect(result).toEqual({
    columns: ['state', 'sum__num'],
    rows: [{ state: 'CA' }],
  });
});

test('widget-tools addresses saved widgets by id', async () => {
  const mcp = stubMcp(
    { payload: { uuid: 'w1', widget_type: 'echarts', props: {} } },
    { payload: { values: ['boy', 'girl'] } },
  );
  const client = createMcpWidgetClient({ mcp, server: SERVER });

  await expect(client.getSavedWidget?.('w1')).resolves.toMatchObject({
    uuid: 'w1',
  });
  await expect(
    client.fetchValues({
      instanceId: 'f',
      widget: { id: 'w2', type: 'filter.select', props: {} },
    }),
  ).resolves.toEqual(['boy', 'girl']);

  expect(mcp.callTool).toHaveBeenNthCalledWith(1, SERVER, 'get_saved_widget', {
    request: { id: 'w1' },
  });
  expect(mcp.callTool).toHaveBeenNthCalledWith(2, SERVER, 'get_widget_values', {
    request: { id: 'w2' },
  });
});

test('proxy mode goes through call_tool and unwraps the nested tool result', async () => {
  const inner = { columns: ['state'], rows: [{ state: 'NY' }] };
  const mcp = stubMcp({
    payload: { content: [{ type: 'text', text: JSON.stringify(inner) }] },
  });
  const client = createMcpWidgetClient({ mcp, server: SERVER, proxy: true });

  const result = await client.fetchData({
    instanceId: 'bar',
    widget: chart,
    filters: [],
  });

  expect(mcp.callTool).toHaveBeenCalledWith(SERVER, 'call_tool', {
    name: 'get_widget_data',
    arguments: { request: { widget: chart, filters: [] } },
  });
  expect(result).toEqual(inner);
});

test('query-dataset maps the binding, authored filters and host filters', async () => {
  const mcp = stubMcp({
    payload: {
      columns: [{ name: 'state' }, { name: 'sum__num' }],
      data: [{ state: 'CA', sum__num: 1 }],
    },
  });
  const client = createMcpWidgetClient({
    mcp,
    server: SERVER,
    strategy: 'query-dataset',
  });

  const result = await client.fetchData({
    instanceId: 'bar',
    widget: chart,
    filters: [
      { column: 'state', operator: 'NOT_EQUALS', value: 'TX' },
      { column: 'num', operator: 'RANGE', value: { min: 5, max: 10 } },
      { column: 'ds', operator: 'TIME_RANGE', value: { start: '2020' } },
    ],
  });

  expect(mcp.callTool).toHaveBeenCalledWith(SERVER, 'query_dataset', {
    request: {
      dataset_id: 17,
      metrics: ['sum__num'],
      columns: ['state'],
      filters: [
        { col: 'gender', op: '==', val: 'girl' },
        { col: 'state', op: '!=', val: 'TX' },
        { col: 'num', op: '>=', val: 5 },
        { col: 'num', op: '<=', val: 10 },
        { col: 'ds', op: '>=', val: '2020' },
      ],
      row_limit: 10,
    },
  });
  expect(result).toEqual({
    columns: ['state', 'sum__num'],
    rows: [{ state: 'CA', sum__num: 1 }],
  });
});

test('query-dataset rejects what only the widget tools can run', async () => {
  const mcp = stubMcp();
  const client = createMcpWidgetClient({
    mcp,
    server: SERVER,
    strategy: 'query-dataset',
  });
  const adhocMetric = {
    ...chart,
    props: {
      dataBinding: { datasetId: 17, metrics: [{ expressionType: 'SQL' }] },
    },
  };
  const sqlFilter = {
    ...chart,
    props: {
      dataBinding: {
        datasetId: 17,
        metrics: ['count'],
        filters: [{ expressionType: 'SQL', sqlExpression: '1=1' }],
      },
    },
  };

  await expect(
    client.fetchData({ instanceId: 'a', widget: adhocMetric, filters: [] }),
  ).rejects.toMatchObject({ code: 'unsupported' });
  await expect(
    client.fetchData({ instanceId: 'b', widget: sqlFilter, filters: [] }),
  ).rejects.toMatchObject({ code: 'unsupported' });
  await expect(
    client.fetchData({
      instanceId: 'c',
      widget: { id: 'w1', ...chart },
      filters: [],
    }),
  ).rejects.toMatchObject({ code: 'unsupported' });
  await expect(client.getSavedWidget?.('w1')).rejects.toMatchObject({
    code: 'unsupported',
  });
  expect(mcp.callTool).not.toHaveBeenCalled();
});

test('query-dataset reads filter values as distinct column values', async () => {
  const mcp = stubMcp({
    payload: {
      columns: [{ name: 'gender' }],
      data: [{ gender: 'boy' }, { gender: 'girl' }, { gender: 'boy' }],
    },
  });
  const client = createMcpWidgetClient({
    mcp,
    server: SERVER,
    strategy: 'query-dataset',
  });

  const values = await client.fetchValues({
    instanceId: 'f',
    widget: {
      type: 'filter.select',
      props: { datasetId: 17, column: 'gender' },
    },
  });

  expect(values).toEqual(['boy', 'girl']);
  expect(mcp.callTool).toHaveBeenCalledWith(SERVER, 'query_dataset', {
    request: { dataset_id: 17, columns: ['gender'], row_limit: 1000 },
  });
});

test('widget-tools reads payloads wrapped as {result}', async () => {
  const mcp = stubMcp(
    {
      payload: {
        result: { columns: ['state'], rows: [{ state: 'CA' }] },
      },
    },
    {
      structuredContent: {
        result: {
          uuid: 'w1',
          widget_type: 'echarts',
          title: null,
          props: {},
          dataset_id: 17,
          changed_on: null,
        },
      },
      content: [],
    },
  );
  const client = createMcpWidgetClient({ mcp, server: SERVER });

  await expect(
    client.fetchData({ instanceId: 'bar', widget: chart, filters: [] }),
  ).resolves.toEqual({ columns: ['state'], rows: [{ state: 'CA' }] });
  await expect(client.getSavedWidget?.('w1')).resolves.toMatchObject({
    uuid: 'w1',
    dataset_id: 17,
  });
});

test.each([
  ['NotFound', 'not_found', 'Not found in Superset: Widget w1 not found'],
  ['Forbidden', 'forbidden', 'does not have access'],
  [
    'ValidationError',
    'invalid_widget',
    'Superset rejected this widget definition: Widget w1 not found; metrics: required',
  ],
  ['CommandError', 'tool_error', 'Widget w1 not found'],
  ['UnexpectedError', 'tool_error', 'Widget w1 not found'],
])('an in-band %s result becomes %s', async (errorType, code, message) => {
  const mcp = stubMcp({
    payload: {
      result: {
        error: 'Widget w1 not found',
        error_type: errorType,
        errors: [{ message: 'metrics: required' }],
        timestamp: '2026-09-15T00:00:00Z',
      },
    },
  });
  const client = createMcpWidgetClient({ mcp, server: SERVER });

  const error = await client
    .fetchData({ instanceId: 'bar', widget: chart, filters: [] })
    .catch((caught: unknown) => caught);

  expect(error).toMatchObject({ code });
  expect((error as Error).message).toContain(message);
});

test('query-dataset surfaces in-band tool errors too', async () => {
  const mcp = stubMcp({
    payload: { error: 'Dataset 17 not found', error_type: 'NotFound' },
  });
  const client = createMcpWidgetClient({
    mcp,
    server: SERVER,
    strategy: 'query-dataset',
  });

  await expect(
    client.fetchData({ instanceId: 'bar', widget: chart, filters: [] }),
  ).rejects.toMatchObject({ code: 'not_found' });
});

test.each([
  ['needs_reauth', 'Reconnect the Superset connector'],
  ['server_not_connected', 'Add the Superset connector'],
  ['server_not_found', 'Add the Superset connector'],
  ['selection_required', 'Choose which Superset connector'],
  ['not_in_manifest', 'not allowed to call Superset'],
  ['approval_required', 'Approve access to Superset'],
  ['consent_required', 'Approve access to Superset'],
  ['not_granted', 'Approve access to Superset'],
  ['blocked_by_policy', 'policy blocks Superset'],
  ['upstream_error', 'Superset is not responding'],
  ['rate_limited', 'Superset is not responding'],
  ['cancelled', 'cancelled'],
  ['capability_disabled', 'Reload the page'],
  ['capability_removed', 'Reload the page'],
  ['user_changed', 'Reload the page'],
  ['transform_error', 'Could not read the response from Superset'],
  ['bad_request', 'input rejected'],
  ['tool_error', 'input rejected'],
  ['something_new', 'Superset is not responding'],
])('%s rejections map to a viewer-facing message', async (code, text) => {
  const mcp = stubMcp({ code, server: SERVER, message: 'input rejected' });
  const client = createMcpWidgetClient({ mcp, server: SERVER });

  const error = await client
    .fetchData({ instanceId: 'bar', widget: chart, filters: [] })
    .catch((caught: unknown) => caught);

  expect(error).toBeInstanceOf(WidgetMcpError);
  expect((error as WidgetMcpError).message).toContain(text);
  expect(mcp.callTool).toHaveBeenCalledTimes(1);
});

test('a retryable failure is retried once', async () => {
  const mcp = stubMcp(
    { code: 'server_unavailable', message: 'timeout', retryable: true },
    { payload: { columns: ['state'], rows: [] } },
  );
  const client = createMcpWidgetClient({
    mcp,
    server: SERVER,
    retryDelayMs: 0,
  });

  await expect(
    client.fetchData({ instanceId: 'bar', widget: chart, filters: [] }),
  ).resolves.toEqual({ columns: ['state'], rows: [] });
  expect(mcp.callTool).toHaveBeenCalledTimes(2);
});

test('a missing runtime rejects with capability_unavailable', async () => {
  const client = createMcpWidgetClient({ mcp: null, server: SERVER });

  await expect(
    client.fetchData({ instanceId: 'bar', widget: chart, filters: [] }),
  ).rejects.toMatchObject({ code: 'capability_unavailable' });
});

test('getArtifactMcp is null outside an artifact', async () => {
  await expect(getArtifactMcp()).resolves.toBeNull();
});

test('extractPayload reads structuredContent, text blocks and {result} wrappers', () => {
  expect(extractPayload({ structuredContent: { result: [1, 2] } })).toEqual([
    1, 2,
  ]);
  expect(
    extractPayload({ content: [{ type: 'text', text: '{"a":1}' }] }),
  ).toEqual({ a: 1 });
  expect(extractPayload({ payload: 'plain text' })).toBe('plain text');
});
