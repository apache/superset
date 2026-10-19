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
import { applyMiddleware, createStore } from 'redux';
import thunk from 'redux-thunk';
import { renderHook, act } from '@testing-library/react';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import { createWrapper, waitFor } from 'spec/helpers/testing-library';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import { DEFAULT_BOOTSTRAP_DATA } from 'src/constants';
import type { SqlLabRootState } from 'src/SqlLab/types';
import useQueryCostWarning, { parseWarningResult } from './useQueryCostWarning';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));
const featureEnabled = jest.mocked(isFeatureEnabled);
const endpoint = 'glob:*/api/v1/sqllab/estimate/';
const executeEndpoint = 'glob:*/api/v1/sqllab/execute/*';
const warning = {
  status: 'exceeded',
  metric: 'total_cost',
  label: 'Estimated planner cost',
  unit: 'planner cost units',
  value: 12.5,
  threshold: 10,
  message: 'Above threshold',
};

/** Control an estimate independently of the editor and execution response. */
function setup() {
  const resolvers: Array<(result: object) => void> = [];
  const responses = [0, 1].map(
    index =>
      new Promise<object>(resolve => {
        resolvers[index] = resolve;
      }),
  );
  let requestIndex = 0;
  fetchMock.post(
    endpoint,
    () => {
      const response = responses[requestIndex];
      requestIndex += 1;
      return response;
    },
    {
      name: 'warning-check',
    },
  );
  fetchMock.post(
    executeEndpoint,
    { data: [], columns: [] },
    { name: 'warning-execute' },
  );
  const editor = {
    ...defaultQueryEditor,
    sql: 'SELECT 1',
    selectedText: '',
    templateParams: '{}',
    queryLimit: 0,
  };
  const state: SqlLabRootState = {
    ...initialState,
    localStorageUsageInKilobytes: 0,
    user: {
      ...initialState.user,
      isAnonymous: false,
      groups: [],
      roles: { Admin: [] },
    },
    common: {
      ...DEFAULT_BOOTSTRAP_DATA.common,
      conf: initialState.common.conf,
    },
    sqlLab: {
      ...initialState.sqlLab,
      dbConnect: false,
      errorMessage: null,
      editorTabLastUpdatedAt: 0,
      lastUpdatedActiveTab: '',
      queryEditors: [editor],
      unsavedQueryEditor: {},
      tabHistory: [editor.id],
      databases: {
        [editor.dbId!]: {
          id: editor.dbId,
          allow_run_async: false,
          allows_cost_estimate: true,
          query_cost_warning: {
            enabled: true,
            metric: 'total_cost',
            threshold: 10,
          },
          engine_information: { query_cost_warning_metric: 'total_cost' },
        },
      },
    },
  };
  const store = createStore(
    (
      currentState = state,
      action: { type: string; state?: SqlLabRootState },
    ): SqlLabRootState =>
      action.type === 'REPLACE' && action.state ? action.state : currentState,
    state,
    applyMiddleware(thunk),
  );
  const hook = renderHook(
    ({ limit = 1000 }) => useQueryCostWarning(editor, limit),
    {
      initialProps: { limit: 1000 },
      wrapper: createWrapper({ useRedux: true, store }),
    },
  );
  const replace = (change: (state: SqlLabRootState) => SqlLabRootState) =>
    act(() => {
      store.dispatch({ type: 'REPLACE', state: change(store.getState()) });
    });
  const finish = async (result: object, index = 0) =>
    act(async () => {
      resolvers[index]({ result });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  const start = () =>
    act(() => {
      hook.result.current.start();
    });
  const executions = () => fetchMock.callHistory.calls('warning-execute');
  return { ...hook, replace, finish, start, executions, editor, store };
}

beforeEach(() => {
  featureEnabled.mockImplementation(flag =>
    [
      FeatureFlag.EstimateQueryCost,
      FeatureFlag.SqlLabQueryCostWarnings,
    ].includes(flag),
  );
});
afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  featureEnabled.mockReset();
});

test.each(['disabled', 'unsupported', 'within_threshold'])(
  'executes a captured request once for %s',
  async status => {
    const h = setup();
    h.replace(state => ({
      ...state,
      sqlLab: {
        ...state.sqlLab,
        unsavedQueryEditor: {
          id: h.editor.id,
          sql: 'SELECT 99',
          selectedText: 'SELECT 2',
          catalog: 'catalog',
          schema: 'schema',
          templateParams: '{"x":2}',
          queryLimit: 25,
        },
      },
    }));
    h.start();
    h.start();
    expect(h.result.current.checking).toBe(true);
    await h.finish({ ...warning, status, value: 0 });
    await waitFor(() => expect(h.executions()).toHaveLength(1));
    const checked = JSON.parse(
      String(fetchMock.callHistory.calls('warning-check')[0].options.body),
    );
    const executed = JSON.parse(String(h.executions()[0].options.body));
    expect(checked).toEqual({
      check_warning: true,
      database_id: h.editor.dbId,
      sql: 'SELECT 2',
      catalog: 'catalog',
      schema: 'schema',
      template_params: { x: 2 },
      query_limit: 25,
    });
    expect(executed).toMatchObject({
      database_id: checked.database_id,
      sql: checked.sql,
      catalog: checked.catalog,
      schema: checked.schema,
      queryLimit: checked.query_limit,
      templateParams: '{"x":2}',
      runAsync: false,
    });
    expect(h.result.current.checking).toBe(false);
  },
);

test.each([
  { status: 'exceeded', runAsync: false },
  { status: 'exceeded', runAsync: true },
  { status: 'unavailable', runAsync: false },
])(
  'requires confirmation for $status with runAsync=$runAsync and continues once',
  async ({ status, runAsync }) => {
    const h = setup();
    h.replace(state => ({
      ...state,
      sqlLab: {
        ...state.sqlLab,
        databases: {
          ...state.sqlLab.databases,
          [h.editor.dbId!]: {
            ...state.sqlLab.databases[h.editor.dbId!],
            allow_run_async: runAsync,
          },
        },
        unsavedQueryEditor: {
          id: h.editor.id,
          sql: 'SELECT 42',
          catalog: 'catalog',
          schema: 'schema',
          queryLimit: 25,
        },
      },
    }));
    h.start();
    expect(h.executions()).toHaveLength(0);
    await h.finish({
      ...warning,
      status,
      value: status === 'unavailable' ? null : 12.5,
    });
    expect(h.executions()).toHaveLength(0);
    expect(h.result.current.confirmation?.status).toBe(status);
    h.start();
    expect(fetchMock.callHistory.calls('warning-check')).toHaveLength(1);
    act(() => {
      h.result.current.continueRun();
      h.result.current.continueRun();
    });
    await waitFor(() => expect(h.executions()).toHaveLength(1));
    const checked = JSON.parse(
      String(fetchMock.callHistory.calls('warning-check')[0].options.body),
    );
    expect(checked).toMatchObject({
      database_id: h.editor.dbId,
      sql: 'SELECT 42',
      catalog: 'catalog',
      schema: 'schema',
      query_limit: 25,
    });
    expect(JSON.parse(String(h.executions()[0].options.body))).toMatchObject({
      database_id: checked.database_id,
      sql: checked.sql,
      catalog: checked.catalog,
      schema: checked.schema,
      queryLimit: checked.query_limit,
      runAsync,
    });
    expect(h.result.current.confirmation).toBeUndefined();
  },
);

test.each(['checking', 'dialog'])(
  'cancels during %s and ignores late results',
  async stage => {
    const h = setup();
    h.start();
    if (stage === 'dialog') await h.finish(warning);
    act(() => h.result.current.cancel());
    if (stage === 'checking') await h.finish(warning);
    act(() => h.result.current.continueRun());
    expect(h.executions()).toHaveLength(0);
    expect(h.result.current.checking).toBe(false);
    expect(h.result.current.confirmation).toBeUndefined();
  },
);

test('an unavailable estimate with missing accuracy can be confirmed once', async () => {
  const h = setup();
  h.start();
  await h.finish({
    ...warning,
    status: 'unavailable',
    value: null,
    accuracy: null,
    row_level_security_applied: null,
  });
  expect(h.executions()).toHaveLength(0);
  expect(h.result.current.confirmation?.status).toBe('unavailable');
  act(() => {
    h.result.current.continueRun();
    h.result.current.continueRun();
  });
  await waitFor(() => expect(h.executions()).toHaveLength(1));
});

test('a cancelled response cannot replace a newer attempt', async () => {
  const h = setup();
  h.start();
  act(() => h.result.current.cancel());
  h.start();
  await h.finish({ ...warning, status: 'within_threshold' });
  expect(h.result.current.checking).toBe(true);
  expect(h.result.current.confirmation).toBeUndefined();
  expect(h.executions()).toHaveLength(0);
  await h.finish(warning, 1);
  expect(h.result.current.confirmation?.status).toBe('exceeded');
  act(() => h.result.current.continueRun());
  await waitFor(() => expect(h.executions()).toHaveLength(1));
});

test.each([
  ['sql', 'SELECT 3'],
  ['selectedText', 'SELECT 4'],
  ['dbId', 99],
  ['catalog', 'other'],
  ['schema', 'other'],
  ['templateParams', '{"x":1}'],
  ['queryLimit', 50],
])(
  'invalidates changed %s even if restored before response',
  async (field, value) => {
    const h = setup();
    h.start();
    const original = h.store.getState();
    h.replace(state => ({
      ...state,
      sqlLab: {
        ...state.sqlLab,
        unsavedQueryEditor: { id: h.editor.id, [field]: value },
      },
    }));
    h.replace(() => original);
    await h.finish(warning);
    act(() => h.result.current.continueRun());
    expect(h.executions()).toHaveLength(0);
    expect(h.result.current.confirmation).toBeUndefined();
  },
);

test.each(['async', 'rule', 'estimation', 'metric', 'tab'])(
  'invalidates %s changes',
  async field => {
    const h = setup();
    h.start();
    h.replace(state => ({
      ...state,
      sqlLab: {
        ...state.sqlLab,
        ...(field === 'tab'
          ? { tabHistory: ['other'] }
          : {
              databases: {
                ...state.sqlLab.databases,
                [h.editor.dbId!]: {
                  ...state.sqlLab.databases[h.editor.dbId!],
                  ...(field === 'async' && { allow_run_async: true }),
                  ...(field === 'rule' && {
                    query_cost_warning: { enabled: false },
                  }),
                  ...(field === 'estimation' && {
                    allows_cost_estimate: false,
                  }),
                  ...(field === 'metric' && {
                    engine_information: { query_cost_warning_metric: null },
                  }),
                },
              },
            }),
      },
    }));
    await h.finish({ ...warning, status: 'within_threshold' });
    expect(h.executions()).toHaveLength(0);
  },
);

test('invalidates a default effective limit change', async () => {
  const h = setup();
  h.start();
  h.rerender({ limit: 2000 });
  await h.finish(warning);
  expect(h.result.current.confirmation).toBeUndefined();
});

test('tab changes close an existing confirmation and invalidate its action', async () => {
  const h = setup();
  h.start();
  await h.finish(warning);
  const { continueRun } = h.result.current;
  h.replace(state => ({
    ...state,
    sqlLab: { ...state.sqlLab, tabHistory: ['other'] },
  }));
  act(() => continueRun());
  expect(h.result.current.confirmation).toBeUndefined();
  expect(h.executions()).toHaveLength(0);
});

test('unmounted editors ignore a late response', async () => {
  const h = setup();
  h.start();
  h.unmount();
  await h.finish(warning);
  expect(h.executions()).toHaveLength(0);
});

test.each([
  {},
  { status: 'bogus' },
  { ...warning, value: '12' },
  { ...warning, value: NaN },
  { ...warning, threshold: 0 },
  { ...warning, metric: 'unknown' },
  { ...warning, metric: 'constructor' },
  { ...warning, metric: '__proto__' },
  { ...warning, metric: 'bytes_processed', threshold: 1.5 },
])('malformed response %j never executes', async result => {
  const h = setup();
  h.start();
  await h.finish(result);
  expect(h.executions()).toHaveLength(0);
  expect(h.result.current.checking).toBe(false);
  expect(h.result.current.confirmation).toBeUndefined();
});

test.each([403, 400, 500])(
  'HTTP %s remains an error and never executes',
  async status => {
    const h = setup();
    fetchMock.modifyRoute('warning-check', {
      response: { status, body: { message: 'Check failed' } },
    });
    h.start();
    await waitFor(() => expect(h.result.current.checking).toBe(false));
    expect(h.executions()).toHaveLength(0);
    expect(h.result.current.confirmation).toBeUndefined();
  },
);

test.each([
  'warning flag',
  'estimate flag',
  'estimation',
  'rule',
  'unsupported',
  'ctas',
  'automatic',
])('known inactive %s keeps the existing execution path', async reason => {
  const h = setup();
  if (reason === 'warning flag')
    featureEnabled.mockImplementation(
      flag => flag === FeatureFlag.EstimateQueryCost,
    );
  if (reason === 'estimate flag')
    featureEnabled.mockImplementation(
      flag => flag === FeatureFlag.SqlLabQueryCostWarnings,
    );
  if (['estimation', 'rule', 'unsupported'].includes(reason))
    h.replace(state => ({
      ...state,
      sqlLab: {
        ...state.sqlLab,
        databases: {
          [h.editor.dbId!]: {
            ...state.sqlLab.databases[h.editor.dbId!],
            ...(reason === 'estimation' && { allows_cost_estimate: false }),
            ...(reason === 'rule' && {
              query_cost_warning: { enabled: false },
            }),
            ...(reason === 'unsupported' && {
              engine_information: { query_cost_warning_metric: null },
            }),
          },
        },
      },
    }));
  act(() => {
    h.result.current.start(
      '',
      reason === 'ctas',
      'TABLE',
      reason === 'automatic',
    );
  });
  await waitFor(() => expect(h.executions()).toHaveLength(1));
  expect(fetchMock.callHistory.calls('warning-check')).toHaveLength(0);
});

test('byte results preserve values beyond JavaScript safe integers', () => {
  const value = BigInt('9007199254740993123');
  expect(
    parseWarningResult({ ...warning, metric: 'bytes_processed', value }),
  ).toMatchObject({ value });
  expect(() =>
    parseWarningResult({
      ...warning,
      metric: 'bytes_processed',
      value: 9007199254740992,
    }),
  ).toThrow();
});

test('planner results preserve large finite integer values and thresholds', () => {
  const threshold = BigInt('9007199254740993');
  const value = threshold + BigInt(1);
  expect(parseWarningResult({ ...warning, threshold, value })).toMatchObject({
    threshold,
    value,
  });
  expect(() =>
    parseWarningResult({
      ...warning,
      metric: 'bytes_processed',
      threshold,
      value,
    }),
  ).toThrow();
});

test.each([null, undefined])(
  'a %s warning rule reaches server validation and errors never execute',
  async rule => {
    const h = setup();
    h.replace(state => ({
      ...state,
      sqlLab: {
        ...state.sqlLab,
        databases: {
          [h.editor.dbId!]: {
            ...state.sqlLab.databases[h.editor.dbId!],
            query_cost_warning: rule,
          },
        },
      },
    }));
    fetchMock.modifyRoute('warning-check', {
      response: {
        status: 400,
        body: { message: 'The saved query cost warning rule is invalid.' },
      },
    });
    h.start();
    await waitFor(() => expect(h.result.current.checking).toBe(false));
    expect(fetchMock.callHistory.calls('warning-check')).toHaveLength(1);
    expect(h.executions()).toHaveLength(0);
    expect(h.result.current.confirmation).toBeUndefined();
  },
);

test('the existing bigint response parser preserves large estimated bytes over HTTP', async () => {
  const h = setup();
  fetchMock.modifyRoute('warning-check', {
    response: {
      body: '{"result":{"status":"exceeded","metric":"bytes_processed","label":"Estimated bytes processed","unit":"bytes","value":9007199254740993123,"threshold":100}}',
      headers: { 'Content-Type': 'application/json' },
    },
  });
  h.start();
  await waitFor(() =>
    expect(h.result.current.confirmation?.value).toBe(
      BigInt('9007199254740993123'),
    ),
  );
  expect(h.executions()).toHaveLength(0);
});

test('invalid template JSON is an error before an estimate or execution request', async () => {
  const h = setup();
  h.replace(state => ({
    ...state,
    sqlLab: {
      ...state.sqlLab,
      unsavedQueryEditor: { id: h.editor.id, templateParams: '{invalid' },
    },
  }));
  h.start();
  await waitFor(() => expect(h.result.current.checking).toBe(false));
  expect(fetchMock.callHistory.calls('warning-check')).toHaveLength(0);
  expect(h.executions()).toHaveLength(0);
});
