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
import {
  FeatureFlag,
  getClientErrorObject,
  isFeatureEnabled,
} from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import { createWrapper, waitFor } from 'spec/helpers/testing-library';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import { DEFAULT_BOOTSTRAP_DATA } from 'src/constants';
import { ADD_TOAST } from 'src/components/MessageToasts/actions';
import { ToastType } from 'src/components/MessageToasts/types';
import type { SqlLabRootState } from 'src/SqlLab/types';
import useQueryCostWarning, { parseWarningResult } from './useQueryCostWarning';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
  getClientErrorObject: jest.fn(
    jest.requireActual('@superset-ui/core').getClientErrorObject,
  ),
}));
const featureEnabled = jest.mocked(isFeatureEnabled);
const endpoint = 'glob:*/api/v1/sqllab/estimate/';
const executeEndpoint = 'glob:*/api/v1/sqllab/execute/*';
const warning = {
  action: 'confirm',
  reason: 'warning',
  message: 'Above threshold',
  details: [
    { label: 'Estimated planner cost', value: '12.5 planner cost units' },
    { label: 'Warning threshold', value: '10 planner cost units' },
  ],
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
          query_warning_state: 'ready',
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
  const reducer = jest.fn(
    (
      currentState = state,
      action: { type: string; state?: SqlLabRootState },
    ): SqlLabRootState =>
      action.type === 'REPLACE' && action.state ? action.state : currentState,
  );
  const store = createStore(reducer, state, applyMiddleware(thunk));
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
  return {
    ...hook,
    replace,
    finish,
    start,
    executions,
    editor,
    store,
    reducer,
  };
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

test('proceed executes a captured request once', async () => {
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
  await h.finish({ action: 'proceed' });
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
});

test.each([
  { reason: 'warning', runAsync: false, details: warning.details },
  { reason: 'warning', runAsync: true, details: warning.details },
  { reason: 'unavailable', runAsync: false, details: undefined },
  { reason: 'unavailable', runAsync: false, details: warning.details },
])(
  'requires confirmation for $reason with runAsync=$runAsync and continues once',
  async ({ reason, runAsync, details }) => {
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
      reason,
      details,
    });
    expect(h.executions()).toHaveLength(0);
    expect(h.result.current.confirmation?.reason).toBe(reason);
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
    if (stage === 'checking') await h.finish({ action: 'proceed' });
    act(() => h.result.current.continueRun());
    expect(h.executions()).toHaveLength(0);
    expect(h.result.current.checking).toBe(false);
    expect(h.result.current.confirmation).toBeUndefined();
  },
);

test('a cancelled response cannot replace a newer attempt', async () => {
  const h = setup();
  h.start();
  act(() => h.result.current.cancel());
  h.start();
  await h.finish({ action: 'proceed' });
  expect(h.result.current.checking).toBe(true);
  expect(h.result.current.confirmation).toBeUndefined();
  expect(h.executions()).toHaveLength(0);
  await h.finish(warning, 1);
  expect(h.result.current.confirmation?.reason).toBe('warning');
  act(() => h.result.current.continueRun());
  await waitFor(() => expect(h.executions()).toHaveLength(1));
});

test('a late error cannot dismiss a newer confirmation or show a stale toast', async () => {
  const h = setup();
  let resolveError: (error: { error: string }) => void;
  const parseError = jest.mocked(getClientErrorObject).mockClear();
  parseError.mockReturnValueOnce(
    new Promise(resolve => {
      resolveError = resolve;
    }),
  );
  fetchMock.modifyRoute('warning-check', {
    response: { status: 400, body: { message: 'Old check failed' } },
  });
  h.start();
  await waitFor(() => expect(parseError).toHaveBeenCalledTimes(1));
  act(() => h.result.current.cancel());
  fetchMock.modifyRoute('warning-check', {
    response: { body: { result: warning } },
  });
  h.start();
  await waitFor(() => expect(h.result.current.confirmation).toEqual(warning));
  await act(async () => resolveError({ error: 'Old check failed' }));
  expect(h.result.current.confirmation).toEqual(warning);
  expect(h.reducer).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ type: ADD_TOAST }),
  );
  expect(h.executions()).toHaveLength(0);
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

test.each(['async', 'rule', 'state', 'tab'])(
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
                  ...(field === 'state' && {
                    query_warning_state: 'disabled' as const,
                  }),
                },
              },
            }),
      },
    }));
    await h.finish({ action: 'proceed' });
    expect(h.executions()).toHaveLength(0);
  },
);

test('invalidates a default effective limit change', async () => {
  const h = setup();
  h.start();
  h.rerender({ limit: 2000 });
  await h.finish({ action: 'proceed' });
  await act(async () => {
    await fetchMock.callHistory.flush(true);
  });
  expect(h.executions()).toHaveLength(0);
  expect(h.result.current.confirmation).toBeUndefined();
  expect(h.result.current.checking).toBe(false);
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
  await h.finish({ action: 'proceed' });
  await act(async () => {
    await fetchMock.callHistory.flush(true);
  });
  expect(h.executions()).toHaveLength(0);
});

test.each([
  {},
  [],
  { action: 'bogus' },
  { status: 'disabled' },
  { ...warning, action: undefined },
  { ...warning, reason: 'bogus' },
  { ...warning, message: undefined },
  { ...warning, message: '  ' },
  { ...warning, details: null },
  { ...warning, details: {} },
  { ...warning, details: [null] },
  { ...warning, details: [{ label: 'Estimate', value: 12 }] },
  { ...warning, details: [{ label: 1, value: '12' }] },
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
    expect(h.reducer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: ADD_TOAST,
        payload: expect.objectContaining({
          toastType: ToastType.Danger,
          text: 'Check failed',
        }),
      }),
    );
  },
);

test.each([
  { status: 500, text: 'Internal Server Error' },
  { status: 599, text: 'Query warning check failed.' },
])(
  'HTTP $status without an error message reports "$text" and never executes',
  async ({ status, text }) => {
    const h = setup();
    fetchMock.modifyRoute('warning-check', {
      response: { status, body: {} },
    });
    h.start();
    await waitFor(() => expect(h.result.current.checking).toBe(false));
    expect(h.executions()).toHaveLength(0);
    expect(h.result.current.confirmation).toBeUndefined();
    expect(h.reducer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: ADD_TOAST,
        payload: expect.objectContaining({
          toastType: ToastType.Danger,
          text,
        }),
      }),
    );
  },
);

test.each(['warning flag', 'disabled', 'unsupported', 'ctas', 'automatic'])(
  'known inactive %s keeps the existing execution path',
  async reason => {
    const h = setup();
    if (reason === 'warning flag') featureEnabled.mockReturnValue(false);
    if (reason === 'disabled' || reason === 'unsupported') {
      h.replace(state => ({
        ...state,
        sqlLab: {
          ...state.sqlLab,
          databases: {
            [h.editor.dbId!]: {
              ...state.sqlLab.databases[h.editor.dbId!],
              query_warning_state: reason,
            },
          },
        },
      }));
    }
    act(() => {
      h.result.current.start(
        reason === 'ctas' ? 'warning_output' : '',
        reason === 'ctas',
        'TABLE',
        reason === 'automatic',
      );
    });
    await waitFor(() => expect(h.executions()).toHaveLength(1));
    expect(fetchMock.callHistory.calls('warning-check')).toHaveLength(0);
    if (reason === 'ctas') {
      expect(JSON.parse(String(h.executions()[0].options.body))).toMatchObject({
        select_as_cta: true,
        tmp_table_name: 'warning_output',
        ctas_method: 'TABLE',
      });
    }
  },
);

test('ready checks do not require numeric estimation prerequisites', async () => {
  const h = setup();
  featureEnabled.mockImplementation(
    flag => flag === FeatureFlag.SqlLabQueryCostWarnings,
  );
  h.replace(state => ({
    ...state,
    sqlLab: {
      ...state.sqlLab,
      databases: {
        [h.editor.dbId!]: {
          ...state.sqlLab.databases[h.editor.dbId!],
          allows_cost_estimate: false,
          query_cost_warning: { enabled: true, notice: 'Custom settings' },
          engine_information: {
            query_cost_warning_metric: null,
            query_warning_supported: true,
          },
        },
      },
    },
  }));
  h.start();
  await h.finish({ action: 'proceed' });
  expect(fetchMock.callHistory.calls('warning-check')).toHaveLength(1);
  await waitFor(() => expect(h.executions()).toHaveLength(1));
});

test('display details preserve large counts and planner decimals as plain text', () => {
  const result = {
    ...warning,
    details: [
      { label: 'Usage', value: 'At least 9,007,199,254,740,993,123 bytes' },
      { label: 'Planner cost', value: '0.123456789123456789' },
    ],
  };
  expect(parseWarningResult(result)).toEqual(result);
  expect(() => parseWarningResult({ ...result, message: '' })).toThrow(
    'The query warning response was invalid.',
  );
});

test.each(['invalid', undefined] as const)(
  '%s server state reaches validation and errors never execute',
  async stateValue => {
    const h = setup();
    h.replace(state => ({
      ...state,
      sqlLab: {
        ...state.sqlLab,
        databases: {
          [h.editor.dbId!]: {
            ...state.sqlLab.databases[h.editor.dbId!],
            query_warning_state: stateValue,
            query_cost_warning: { enabled: false },
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

test('HTTP detail strings remain exact without a numeric parser', async () => {
  const h = setup();
  const details = [
    { label: 'Usage', value: 'Up to 9,007,199,254,740,993,123 bytes' },
  ];
  fetchMock.modifyRoute('warning-check', {
    response: { body: { result: { ...warning, details } } },
  });
  h.start();
  await waitFor(() =>
    expect(h.result.current.confirmation?.details).toEqual(details),
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
