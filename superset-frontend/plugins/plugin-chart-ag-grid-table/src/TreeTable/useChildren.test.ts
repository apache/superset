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
import { act, renderHook } from '@testing-library/react';
import { SupersetClient, VizType } from '@superset-ui/core';
import useChildren, {
  areaKey,
  parentFilters,
  UseChildrenParams,
} from './useChildren';
import {
  retainedTableControls,
  treeFormData,
} from '../../test/treeModeFixtures';
import * as fetchModule from './fetchTreeTableData';
import { TreeTableQueryResult } from './fetchTreeTableData';
import { GridApi } from 'ag-grid-community';
import { useRowHeights } from './TreeTableContext';
import { AreaState, TreeTableFormData, TreeLevel } from './types';

const CHART_DATA_ENDPOINT = 'glob:*/api/v1/chart/data';

test('filter reconciliation ignores every retained Table V2 key', () => {
  expect(parentFilters({ ...treeFormData, ...retainedTableControls })).toEqual(
    parentFilters(treeFormData),
  );
});

jest.mock('./fetchTreeTableData', () => {
  const actual = jest.requireActual<typeof import('./fetchTreeTableData')>(
    './fetchTreeTableData',
  );
  return { __esModule: true, ...actual, default: jest.fn(actual.default) };
});
beforeEach(() =>
  jest
    .mocked(fetchModule.default)
    .mockReset()
    .mockImplementation(
      jest.requireActual<typeof import('./fetchTreeTableData')>(
        './fetchTreeTableData',
      ).default,
    ),
);

const session: TreeLevel = {
  key: 'session',
  name: 'Session',
  id_column: 'session_id',
  columns: ['channel'],
  detail_fields: [],
};
const step: TreeLevel = {
  key: 'step',
  name: 'Step',
  name_plural: 'Steps',
  id_column: 'step_id',
  parent_column: 'session_id',
  columns: ['step'],
  detail_fields: [],
  children_shown: 100,
};
const formData: TreeTableFormData = {
  ...retainedTableControls,
  datasource: '1__table',
  viz_type: VizType.TableAgGrid,
  query_mode: 'tree',
  levels: [session, step],
  slice_id: 42,
  dashboardId: 7,
};
const STEPS: Record<string, number> = { s1: 3, s2: 0, s3: 2, s4: 1, s5: 5 };

type Body = {
  force: boolean;
  result_type: string;
  form_data: Record<string, unknown>;
  queries: {
    filters: { col: string; op: string; val?: unknown }[];
    metrics?: unknown[];
    orderby?: [string, boolean][];
    row_offset?: number;
    row_limit?: number;
    post_processing?: { options?: { n?: number } }[];
  }[];
};

const requestBodies = (): Body[] =>
  fetchMock.callHistory
    .calls(CHART_DATA_ENDPOINT)
    .map(call => JSON.parse(call.options.body as string) as Body);
const rowBodies = () =>
  requestBodies().filter(body => !body.queries[0].metrics?.length);
const parentIdsOf = (body: Body) =>
  body.queries[0].filters.find(filter => filter.op === 'IN')?.val;

const bodyFor = (parentIds: string[]): Body => ({
  force: false,
  result_type: 'results',
  form_data: {},
  queries: [{ filters: [{ col: 'session_id', op: 'IN', val: parentIds }] }],
});

function answerFor(body: Body, steps = STEPS) {
  const parentIds = parentIdsOf(body) as string[];
  const more = body.queries.length === 1;
  const offset = more ? (body.queries[0].row_offset ?? 0) : 0;
  const n =
    body.queries[0].post_processing?.[0]?.options?.n ??
    body.queries[0].row_limit ??
    100;
  const rows = parentIds.flatMap(id =>
    Array.from({ length: steps[id] ?? 0 }, (_, index) => ({
      step_id: `${id}-${index}`,
      session_id: id,
      step: index,
    })).slice(offset, offset + n),
  );
  const answers = [
    {
      data: rows,
      colnames: ['step_id', 'session_id', 'step'],
      coltypes: [1, 1, 0],
      rowcount: rows.length,
      sql_rowcount: rows.length,
    },
    {
      data: parentIds
        .filter(id => steps[id])
        .map(id => ({
          session_id: id,
          'COUNT_DISTINCT(step_id)': steps[id],
        })),
      colnames: ['session_id', 'COUNT_DISTINCT(step_id)'],
      coltypes: [1, 0],
      rowcount: 0,
      sql_rowcount: 0,
    },
  ];
  return {
    result: body.queries.map(query =>
      query.metrics?.length ? answers[1] : answers[0],
    ),
  };
}

let failNext = 0;
let hold: Promise<void> | undefined;
function route(answer = answerFor) {
  fetchMock.post(
    CHART_DATA_ENDPOINT,
    async ({ options }) => {
      const body = JSON.parse(options.body as string);
      if (hold) await hold;
      if (failNext > 0) {
        failNext -= 1;
        return { status: 500, body: { message: 'Query failed' } };
      }
      return answer(body);
    },
    { name: CHART_DATA_ENDPOINT },
  );
}

beforeAll(() => {
  fetchMock.mockGlobal();
  fetchMock.get('glob:*api/v1/security/csrf_token/*', { result: '1234' });
  SupersetClient.reset();
  SupersetClient.configure({ fetchRetryOptions: { retries: 0 } }).init();
});
afterAll(() => fetchMock.hardReset());
beforeEach(() => {
  jest.useFakeTimers();
  failNext = 0;
  hold = undefined;
  route();
});
afterEach(() => fetchMock.clearHistory().removeRoute(CHART_DATA_ENDPOINT));
afterEach(() => jest.restoreAllMocks());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const pageKeys = ['s1', 's2', 's3', 's4'];
const nonemptyPageKeys = pageKeys.filter(key => STEPS[key]);
const data = pageKeys.map(session_id => ({ session_id }));
const params = (extra: Partial<UseChildrenParams> = {}): UseChildrenParams => ({
  formData,
  pageKeys,
  expanded: new Set(),
  data,
  ...extra,
});
const statuses = (entries: Map<string, { status: string }>) =>
  Object.fromEntries(
    [...entries].map(([key, entry]) => [
      (JSON.parse(key) as string[]).join(' > '),
      entry.status,
    ]),
  );
const flush = () => act(() => jest.advanceTimersByTimeAsync(20));

test('2,500 parent paths use independent batches of 1,000, 1,000 and 500', async () => {
  const keys = Array.from({ length: 2500 }, (_, index) => `parent-${index}`);
  const initial = params({
    pageKeys: keys,
    data: keys.map(session_id => ({ session_id })),
  });
  const { result } = renderHook(() => useChildren(initial));
  act(() => result.current.open([keys[0]]));
  await flush();
  expect(
    requestBodies().map(body => (parentIdsOf(body) as string[]).length),
  ).toEqual([1000, 1000, 500]);
  expect(requestBodies().flatMap(body => parentIdsOf(body))).toEqual(keys);
  expect(result.current.entries.size).toBe(2500);
  expect(
    [...result.current.entries.values()].every(
      entry => entry.status === 'empty',
    ),
  ).toBe(true);
  act(() => result.current.open([keys[2000]]));
  expect(requestBodies()).toHaveLength(3);
});

test('a failed part leaves other parts intact and Retry requests only its parent', async () => {
  const keys = Array.from({ length: 2500 }, (_, index) => `parent-${index}`);
  failNext = 1;
  const initial = params({ pageKeys: keys, expanded: new Set([keys[0]]) });
  const { result } = renderHook(() => useChildren(initial));
  act(() => result.current.open([keys[0]]));
  await flush();
  expect(result.current.entries.get(areaKey([keys[0]]))?.status).toBe('error');
  expect(result.current.entries.get(areaKey([keys[1000]]))?.status).toBe(
    'empty',
  );
  act(() => result.current.retry([keys[0]]));
  await flush();
  expect(parentIdsOf(requestBodies()[3])).toEqual([keys[0]]);
  expect(result.current.entries.get(areaKey([keys[0]]))?.status).toBe('empty');
});

test('a reopened parent supersedes its pending part; reset aborts each remaining part and ignores late answers', async () => {
  const keys = Array.from({ length: 2500 }, (_, index) => `parent-${index}`);
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const signals: AbortSignal[] = [];
  const spy = jest
    .spyOn(fetchModule, 'default')
    .mockImplementation(async ({ signal }) => {
      signals.push(signal!);
      if (signals.length <= 3) await held;
      return [];
    });
  try {
    const initial = params({ pageKeys: keys });
    const { result } = renderHook(() => useChildren(initial));
    act(() => result.current.open([keys[0]]));
    expect(signals).toHaveLength(3);
    act(() => result.current.close([keys[0]]));
    act(() => result.current.open([keys[0]]));
    await flush();
    expect(result.current.entries.get(areaKey([keys[0]]))?.status).toBe(
      'empty',
    );
    expect(result.current.entries.get(areaKey([keys[1000]]))?.status).toBe(
      'loading',
    );
    act(() => result.current.reset());
    expect(signals.slice(0, 3).every(signal => signal.aborted)).toBe(true);
    release();
    await flush();
    expect(result.current.entries.size).toBe(0);
    expect(spy).toHaveBeenCalledTimes(4);
  } finally {
    release();
    spy.mockRestore();
  }
});

test('first open sends one batch with every key; later opens send none', async () => {
  const { result, rerender } = renderHook(
    (props: UseChildrenParams) => useChildren(props),
    {
      initialProps: params(),
    },
  );
  act(() => result.current.open(['s1']));
  rerender(params({ expanded: new Set(['s1']) }));
  expect(statuses(result.current.entries)).toEqual({
    s1: 'loading',
    s2: 'loading',
    s3: 'loading',
    s4: 'loading',
  });
  await flush();
  expect(rowBodies()).toHaveLength(1);
  const [body] = rowBodies();
  expect(parentIdsOf(body)).toEqual(nonemptyPageKeys);
  expect(body.queries).toHaveLength(1);
  expect(body.force).toBe(false);
  expect(body.result_type).toBe('results');
  expect(body.form_data).toMatchObject({ slice_id: 42, dashboardId: 7 });
  expect(statuses(result.current.entries)).toEqual({
    s1: 'loaded',
    s2: 'empty',
    s3: 'loaded',
    s4: 'loaded',
  });
  expect(result.current.entries.get(areaKey(['s1']))?.rows).toHaveLength(3);
  act(() => result.current.open(['s3']));
  await flush();
  expect(rowBodies()).toHaveLength(1);
});

test('a failed batch marks open rows as error, drops the others, and a later open sends one parent', async () => {
  failNext = 1;
  const { result, rerender } = renderHook(
    (props: UseChildrenParams) => useChildren(props),
    {
      initialProps: params(),
    },
  );
  rerender(params({ expanded: new Set(['s1', 's3']) }));
  act(() => result.current.open(['s1']));
  await flush();
  expect(statuses(result.current.entries)).toEqual({
    s1: 'error',
    s3: 'error',
  });
  act(() => result.current.open(['s4']));
  await flush();
  expect(requestBodies().map(parentIdsOf)).toEqual([pageKeys, ['s4']]);
  expect(statuses(result.current.entries)).toEqual({
    s1: 'error',
    s3: 'error',
    s4: 'loaded',
  });
});

test('a child level without a parent column shows an error', () => {
  const { result } = renderHook(useChildren, {
    initialProps: params({
      formData: {
        ...formData,
        levels: [session, { ...step, parent_column: undefined }],
      },
      expanded: new Set(['s1']),
    }),
  });
  act(() => result.current.open(['s1']));
  expect(result.current.areas.get(areaKey(['s1']))?.state).toBe('error');
  expect(requestBodies()).toHaveLength(0);
});

test('Retry loads only that parent', async () => {
  failNext = 1;
  const { result } = renderHook(
    (props: UseChildrenParams) => useChildren(props),
    {
      initialProps: params({ expanded: new Set(['s1', 's3']) }),
    },
  );
  act(() => result.current.open(['s1']));
  await flush();
  act(() => result.current.retry(['s3']));
  expect(result.current.entries.get(areaKey(['s3']))?.status).toBe('loading');
  await flush();
  expect(requestBodies().map(parentIdsOf)).toEqual([pageKeys, ['s3']]);
  expect(statuses(result.current.entries)).toEqual({
    s1: 'error',
    s3: 'loaded',
  });
});

test('reset aborts the request in flight, ignores the abort and clears entries', async () => {
  let release = () => {};
  hold = new Promise(resolve => {
    release = resolve;
  });
  const { result } = renderHook(
    (props: UseChildrenParams) => useChildren(props),
    {
      initialProps: params({ expanded: new Set(['s1']) }),
    },
  );
  act(() => result.current.open(['s1']));
  act(() => result.current.reset());
  release();
  await flush();
  expect(result.current.entries.size).toBe(0);
  act(() => result.current.open(['s1']));
  await flush();
  expect(rowBodies()).toHaveLength(1);
  expect(parentIdsOf(rowBodies()[0])).toEqual(nonemptyPageKeys);
  expect(result.current.entries.get(areaKey(['s1']))?.status).toBe('loaded');
});

test('new data with an open row sends one forced batch for the new page and keeps the old rows until it lands', async () => {
  const { result, rerender } = renderHook(
    (props: UseChildrenParams) => useChildren(props),
    {
      initialProps: params({ expanded: new Set(['s1']) }),
    },
  );
  act(() => result.current.open(['s1']));
  await flush();
  rerender(
    params({
      expanded: new Set(['s1']),
      pageKeys: ['s1', 's3'],
      data: [{ session_id: 's1' }, { session_id: 's3' }],
    }),
  );
  const oldRows = result.current.entries.get(areaKey(['s1']))?.rows;
  expect(statuses(result.current.entries)).toEqual({
    s1: 'loaded',
    s3: 'loaded',
  });
  expect(result.current.entries.get(areaKey(['s1']))?.rows).toBe(oldRows);
  expect(result.current.areas.get('["s1"]')).toMatchObject({
    state: 'loading',
    action: 'refresh',
    origin: 'refresh',
  });
  await flush();
  expect(rowBodies().map(body => [parentIdsOf(body), body.force])).toEqual([
    [nonemptyPageKeys, false],
    [['s1', 's3'], true],
  ]);
  expect(result.current.entries.get(areaKey(['s1']))?.rows).not.toBe(oldRows);
  expect(statuses(result.current.entries)).toEqual({
    s1: 'loaded',
    s3: 'loaded',
  });
});

test.each<[string, Partial<TreeTableFormData>]>([
  [
    'a native filter',
    {
      extra_form_data: {
        filters: [{ col: 'channel', op: '==', val: 'Voice' }],
      },
    },
  ],
  [
    'a cross-filter',
    {
      extra_form_data: {
        filters: [{ col: 'session_id', op: 'IN', val: ['s1'] }],
      },
    },
  ],
  ['a native Time range', { extra_form_data: { time_range: 'Last week' } }],
  [
    'a saved filter',
    {
      adhoc_filters: [
        {
          expressionType: 'SIMPLE',
          subject: 'channel',
          operator: '==',
          comparator: 'Chat',
          clause: 'WHERE',
        },
      ],
    },
  ],
])(
  'new data after %s change sends one normal batch; the refresh after it is forced',
  async (_, change) => {
    const { result, rerender } = renderHook(
      (props: UseChildrenParams) => useChildren(props),
      { initialProps: params({ expanded: new Set(['s1']) }) },
    );
    act(() => result.current.open(['s1']));
    await flush();
    const filtered = { ...formData, ...change };
    rerender(
      params({
        expanded: new Set(['s1']),
        formData: filtered,
        data: [...data],
      }),
    );
    await flush();
    rerender(
      params({
        expanded: new Set(['s1']),
        formData: { ...filtered },
        data: [...data],
      }),
    );
    await flush();
    expect(rowBodies().map(body => body.force)).toEqual([false, false, true]);
    expect(rowBodies()[1].form_data).toMatchObject(change);
    expect(statuses(result.current.entries)).toMatchObject({ s1: 'loaded' });
  },
);

test('new data with the same filters in new objects is a refresh', async () => {
  const { result, rerender } = renderHook(
    (props: UseChildrenParams) => useChildren(props),
    { initialProps: params({ expanded: new Set(['s1']) }) },
  );
  act(() => result.current.open(['s1']));
  await flush();
  rerender(
    params({
      expanded: new Set(['s1']),
      formData: JSON.parse(JSON.stringify(formData)),
      data: [...data],
    }),
  );
  await flush();
  expect(rowBodies().map(body => body.force)).toEqual([false, true]);
});

test('a filter change while no row is open still moves the snapshot on', async () => {
  const { result, rerender } = renderHook(
    (props: UseChildrenParams) => useChildren(props),
    { initialProps: params() },
  );
  const filtered = {
    ...formData,
    extra_form_data: { time_range: 'Last week' },
  };
  const filteredData = [...data];
  rerender(params({ formData: filtered, data: filteredData }));
  await flush();
  rerender(
    params({
      expanded: new Set(['s1']),
      formData: filtered,
      data: filteredData,
    }),
  );
  act(() => result.current.open(['s1']));
  await flush();
  rerender(
    params({
      expanded: new Set(['s1']),
      formData: { ...filtered },
      data: [...data],
    }),
  );
  await flush();
  expect(rowBodies().map(body => body.force)).toEqual([false, true]);
});

test('new data without open rows sends nothing and clears entries', async () => {
  const { result, rerender } = renderHook(
    (props: UseChildrenParams) => useChildren(props),
    {
      initialProps: params({ expanded: new Set(['s1']) }),
    },
  );
  act(() => result.current.open(['s1']));
  await flush();
  rerender(params({ data: [...data] }));
  await flush();
  expect(rowBodies()).toHaveLength(1);
  expect(result.current.entries.size).toBe(0);
  act(() => result.current.open(['s2']));
  await flush();
  expect(rowBodies().map(parentIdsOf)).toEqual([
    nonemptyPageKeys,
    nonemptyPageKeys,
  ]);
});

test('a page refresh drops action history for parents off the page', () => {
  const { result, rerender } = renderHook(useChildren, {
    initialProps: params({ expanded: new Set(['s1']) }),
  });
  act(() => result.current.record(areaKey(['s1']), 'retry'));
  expect(result.current.areas.get(areaKey(['s1']))?.action).toBe('retry');
  rerender(
    params({
      data: [{ session_id: 'next' }],
      pageKeys: ['next'],
      expanded: new Set(['s1']),
    }),
  );
  expect(result.current.areas.get(areaKey(['s1']))?.action).toBe('expand');
});

test('an answer from an older generation is dropped, even when it ignores the abort', async () => {
  let resolveStale: (value: TreeTableQueryResult[]) => void = () => {};
  const fetchSpy = jest.spyOn(fetchModule, 'default').mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveStale = resolve;
      }),
  );
  const { result, rerender } = renderHook(
    (props: UseChildrenParams) => useChildren(props),
    {
      initialProps: params({ expanded: new Set(['s1']) }),
    },
  );
  act(() => result.current.open(['s1']));
  failNext = 1;
  rerender(params({ expanded: new Set(['s1']), data: [...data] }));
  await flush();
  resolveStale(answerFor(bodyFor(pageKeys)).result);
  await flush();
  expect(fetchSpy).toHaveBeenCalledTimes(2);
  expect(fetchSpy.mock.calls.map(([call]) => call.force)).toEqual([
    false,
    true,
  ]);
  expect(statuses(result.current.entries)).toEqual({ s1: 'error' });
  fetchSpy.mockRestore();
});

test('no level 2 sends no request', async () => {
  const { result } = renderHook(
    (props: UseChildrenParams) => useChildren(props),
    {
      initialProps: params({ formData: { ...formData, levels: [session] } }),
    },
  );
  act(() => result.current.open(['s1']));
  await flush();
  expect(rowBodies()).toHaveLength(0);
  expect(result.current.entries.size).toBe(0);
});

const shown2: TreeTableFormData = {
  ...formData,
  levels: [session, { ...step, children_shown: 2 }],
};
const moreData = [{ session_id: 's5' }, { session_id: 's1' }];
const moreParams = (extra: Partial<UseChildrenParams> = {}) =>
  params({
    formData: shown2,
    pageKeys: ['s5', 's1'],
    data: moreData,
    expanded: new Set(['s5']),
    ...extra,
  });
const stepsOf = (
  entries: Map<string, { rows: Record<string, unknown>[] }>,
  key: string,
) => entries.get(areaKey([key]))?.rows.map(row => row.step);

async function openFive() {
  const hook = renderHook((props: UseChildrenParams) => useChildren(props), {
    initialProps: moreParams(),
  });
  act(() => hook.result.current.open(['s5']));
  await flush();
  return hook;
}

test('batched child queries and Load more use the temporal link format', async () => {
  const keys = ['315532800000', '347155200000'];
  fetchMock.removeRoute(CHART_DATA_ENDPOINT);
  route(body =>
    answerFor(
      {
        ...body,
        queries: body.queries.map(query => ({
          ...query,
          filters: query.filters.map(filter =>
            filter.op === 'IN'
              ? {
                  ...filter,
                  val: (filter.val as string[]).map(seconds =>
                    String(Number(seconds) * 1000),
                  ),
                }
              : filter,
          ),
        })),
      },
      { [keys[0]]: 5, [keys[1]]: 3 },
    ),
  );
  const initial = moreParams({
    pageKeys: keys,
    data: keys.map(session_id => ({ session_id })),
    expanded: new Set(keys),
    linkDateFormats: new Map([['session_id', 'epoch_s']]),
  });
  const { result } = renderHook(() => useChildren(initial));
  act(() => result.current.open([keys[0]]));
  await flush();
  expect(requestBodies().map(parentIdsOf)).toEqual([
    ['315532800', '347155200'],
    ['315532800', '347155200'],
  ]);
  act(() => result.current.loadMore([keys[0]]));
  await flush();
  expect(parentIdsOf(requestBodies()[2])).toEqual(['315532800']);
  expect(requestBodies()[2].queries[0].row_offset).toBe(2);
  expect(stepsOf(result.current.entries, keys[0])).toEqual([0, 1, 2, 3]);
});

test('Load more sends one request at the loaded offset and appends the rows', async () => {
  const { result } = await openFive();
  expect(stepsOf(result.current.entries, 's5')).toEqual([0, 1]);
  act(() => result.current.loadMore(['s5']));
  expect(result.current.entries.get(areaKey(['s5']))?.more).toBe('loading');
  act(() => result.current.loadMore(['s5']));
  await flush();
  const [, more] = rowBodies();
  expect(rowBodies()).toHaveLength(2);
  expect(more.queries).toHaveLength(1);
  expect(parentIdsOf(more)).toEqual(['s5']);
  expect(more.queries[0]).toMatchObject({ row_offset: 2, row_limit: 2 });
  expect(stepsOf(result.current.entries, 's5')).toEqual([0, 1, 2, 3]);
  expect(result.current.entries.get(areaKey(['s5']))?.more).toBeUndefined();
  act(() => result.current.loadMore(['s5']));
  await flush();
  expect(rowBodies()[2].queries[0].row_offset).toBe(4);
  expect(stepsOf(result.current.entries, 's5')).toEqual([0, 1, 2, 3, 4]);
});

test.each([2, 3])(
  'a shrinking child set ending at %s stops Load more after one request',
  async remaining => {
    const { result } = await openFive();
    const original = STEPS.s5;
    try {
      STEPS.s5 = remaining;
      act(() => result.current.loadMore(['s5']));
      await flush();
      expect(result.current.entries.get(areaKey(['s5']))).toMatchObject({
        total: remaining,
      });
      expect(stepsOf(result.current.entries, 's5')).toHaveLength(remaining);
      act(() => result.current.loadMore(['s5']));
      await flush();
      expect(rowBodies()).toHaveLength(2);
    } finally {
      STEPS.s5 = original;
    }
  },
);

test('a failed Load more keeps the rows, and its Retry sends the same Load more', async () => {
  const { result } = await openFive();
  failNext = 1;
  act(() => result.current.loadMore(['s5']));
  await flush();
  expect(result.current.entries.get(areaKey(['s5']))).toMatchObject({
    status: 'loaded',
    more: 'error',
  });
  expect(stepsOf(result.current.entries, 's5')).toEqual([0, 1]);
  expect(result.current.areas.get('["s5"]')).toMatchObject({
    action: 'load-more',
    more: 'error',
  });
  act(() => result.current.loadMore(['s5']));
  expect(result.current.areas.get('["s5"]')).toMatchObject({
    action: 'retry',
    more: 'loading',
  });
  await flush();
  expect(
    rowBodies()
      .slice(1)
      .map(body => body.queries[0].row_offset),
  ).toEqual([2, 2]);
  expect(stepsOf(result.current.entries, 's5')).toEqual([0, 1, 2, 3]);
});

test('a sort change re-sends one batch for every loaded key, keeps old rows until the answer, and drops Load more rows', async () => {
  const { result, rerender } = await openFive();
  act(() => result.current.loadMore(['s5']));
  await flush();
  rerender(moreParams({ expanded: new Set(['s5', 's1']) }));
  const before = result.current.entries.get(areaKey(['s5']));
  let release = () => {};
  hold = new Promise(resolve => {
    release = resolve;
  });
  act(() => result.current.setSort(1, ['step', false], ['s5']));
  expect(result.current.sorts.get(1)).toEqual(['step', false]);
  expect(result.current.entries.get(areaKey(['s5']))).toEqual(before);
  expect(result.current.areas.get('["s5"]')).toMatchObject({
    state: 'loading',
    action: 'child-sort',
    origin: 'user',
  });
  expect(result.current.areas.get('["s1"]')).toMatchObject({
    action: 'child-sort',
    origin: 'refresh',
  });
  release();
  await flush();
  const [, , sorted] = rowBodies();
  expect(rowBodies()).toHaveLength(3);
  expect(parentIdsOf(sorted)).toEqual(['s5', 's1']);
  expect(sorted.queries).toHaveLength(1);
  expect(sorted.queries[0].orderby).toEqual([
    ['session_id', true],
    ['step', false],
    ['step_id', true],
  ]);
  expect(stepsOf(result.current.entries, 's5')).toHaveLength(2);
  act(() => result.current.loadMore(['s5']));
  await flush();
  expect(rowBodies()[3].queries[0].orderby).toEqual(sorted.queries[0].orderby);
});

test('reset aborts a pending Load more and keeps the level 2 sort', async () => {
  const { result } = await openFive();
  act(() => result.current.setSort(1, ['step', false], ['s5']));
  await flush();
  let release = () => {};
  hold = new Promise(resolve => {
    release = resolve;
  });
  act(() => result.current.loadMore(['s5']));
  act(() => result.current.reset());
  release();
  await flush();
  expect(result.current.entries.size).toBe(0);
  expect(result.current.sorts.get(1)).toEqual(['step', false]);
  act(() => result.current.open(['s5']));
  await flush();
  expect(rowBodies().at(-1)?.queries[0].orderby?.[1]).toEqual(['step', false]);
});

const loadingAreas = (result: { current: ReturnType<typeof useChildren> }) =>
  [...result.current.areas]
    .filter(([, area]) => area.state === 'loading')
    .map(([key]) => key);

const errorAreas = (result: { current: ReturnType<typeof useChildren> }) =>
  [...result.current.areas]
    .filter(([, area]) => area.state === 'error' || area.more === 'error')
    .map(([key]) => key);

/** Every distinct state one area shows across renders; `undefined` once it closes. */
const areaHistory = (key: string) => {
  const history: (AreaState | undefined)[] = [];
  const track = (props: UseChildrenParams) => {
    const value = useChildren(props);
    const area = value.areas.get(key);
    if (JSON.stringify(area) !== JSON.stringify(history.at(-1)))
      history.push(area);
    return value;
  };
  return { history, track };
};

test('each open area exposes its path, level, state, counts and who started it', async () => {
  const { history, track } = areaHistory('["s5"]');
  const { result, rerender } = renderHook(track, {
    initialProps: moreParams({ expanded: new Set() }),
  });
  const expand = (keys: string[]) =>
    rerender(moreParams({ expanded: new Set(keys) }));
  act(() => {
    result.current.open(['s5']);
    result.current.record('["s5"]', 'expand');
  });
  expand(['s5']);
  expect(result.current.areas.get('["s5"]')).toEqual({
    path: ['s5'],
    level: 1,
    action: 'expand',
    origin: 'user',
    state: 'loading',
  });
  await flush();
  expect(result.current.areas.get('["s5"]')).toMatchObject({
    state: 'loaded',
    loaded: 2,
    total: 5,
  });
  act(() => result.current.loadMore(['s5']));
  await flush();
  act(() => {
    result.current.close(['s5']);
    result.current.record('["s5"]', 'collapse');
  });
  expand([]);
  await flush();
  expect(
    history.map(area =>
      area
        ? [area.action, area.state, area.more ?? '', area.loaded ?? '']
        : 'closed',
    ),
  ).toEqual([
    ['expand', 'loading', '', ''],
    ['expand', 'loaded', '', 2],
    ['load-more', 'loaded', 'loading', 2],
    ['load-more', 'loaded', '', 4],
    ['collapse', 'loaded', '', 4],
    'closed',
  ]);
  expect(result.current.areas.size).toBe(0);
});

test('an empty and an error area report their state', async () => {
  failNext = 0;
  const { result, rerender } = renderHook(
    (props: UseChildrenParams) => useChildren(props),
    {
      initialProps: params({ expanded: new Set(['s2']) }),
    },
  );
  act(() => result.current.open(['s2']));
  await flush();
  expect(result.current.areas.get('["s2"]')?.state).toBe('empty');
  failNext = 1;
  rerender(params({ expanded: new Set(['s2']), data: [...data] }));
  await flush();
  expect(result.current.areas.get('["s2"]')).toMatchObject({
    state: 'error',
    action: 'refresh',
    origin: 'refresh',
  });
  act(() => result.current.retry(['s2']));
  expect(result.current.areas.get('["s2"]')).toMatchObject({
    state: 'loading',
    action: 'retry',
    origin: 'user',
  });
  await flush();
  expect(result.current.areas.get('["s2"]')?.state).toBe('empty');
});

test('an Expand all pick on 50 parents sends one request and settles every area', async () => {
  const keys = Array.from({ length: 50 }, (_, index) => `p${index}`);
  const manyData = keys.map(session_id => ({ session_id }));
  const many = (expanded: Set<string>) =>
    params({ pageKeys: keys, data: manyData, expanded });
  const { history, track } = areaHistory('["p7"]');
  const { result, rerender } = renderHook(track, {
    initialProps: many(new Set()),
  });
  act(() => result.current.expandAll(1, keys, []));
  rerender(many(new Set(keys)));
  await flush();
  expect(requestBodies()).toHaveLength(1);
  expect(result.current.areas.size).toBe(50);
  expect(loadingAreas(result)).toEqual([]);
  expect(errorAreas(result)).toEqual([]);
  expect(result.current.areas.get('["p7"]')).toMatchObject({
    origin: 'expand-all',
    state: 'empty',
  });
  const beforeRetry = history.length;
  act(() => result.current.retry(['p7']));
  await flush();
  expect(requestBodies()).toHaveLength(2);
  expect(
    history.slice(beforeRetry).map(area => [area?.origin, area?.state]),
  ).toEqual([
    ['user', 'loading'],
    ['user', 'empty'],
  ]);
  act(() => result.current.expandAll(0, [], []));
  rerender(many(new Set()));
  await flush();
  expect(requestBodies()).toHaveLength(2);
  expect(result.current.areas.size).toBe(0);
});

const deferredFetch = () => {
  const answers: (() => void)[] = [];
  const spy = jest.spyOn(fetchModule, 'default').mockImplementation(
    ({ buildQuery, formData: chartFormData }) =>
      new Promise(resolve => {
        const body = buildQuery(chartFormData) as unknown as Body;
        if (
          body.queries.length === 1 &&
          !body.queries[0].metrics?.length &&
          !body.queries[0].row_offset
        )
          resolve(answerFor(body).result);
        else answers.push(() => resolve(answerFor(body).result));
      }),
  );
  return { answers, spy };
};

test('after a collapse, an abort or an older generation a late answer changes no state', async () => {
  const { answers, spy } = deferredFetch();
  const props = (expanded: string[], extra: Partial<UseChildrenParams> = {}) =>
    moreParams({
      expanded: new Set(expanded),
      ...extra,
    });
  const { result, rerender } = renderHook(
    (p: UseChildrenParams) => useChildren(p),
    {
      initialProps: props([]),
    },
  );
  act(() => result.current.open(['s5']));
  rerender(props(['s5']));
  answers[0]();
  await flush();
  const count = () =>
    JSON.stringify([[...result.current.areas], [...result.current.entries]]);

  act(() => result.current.loadMore(['s5']));
  await flush();
  act(() => {
    result.current.close(['s5']);
    result.current.record('["s5"]', 'collapse');
  });
  rerender(props([]));
  await flush();
  const afterCollapse = count();
  act(() => {
    result.current.open(['s5']);
    result.current.record('["s5"]', 'expand');
  });
  rerender(props(['s5']));
  await flush();
  const reopened = count();
  answers[1]();
  await flush();
  expect(count()).toBe(reopened);
  expect(reopened).not.toBe(afterCollapse);
  expect(stepsOf(result.current.entries, 's5')).toEqual([0, 1]);

  act(() => result.current.loadMore(['s5']));
  await flush();
  act(() => {
    result.current.reset();
    rerender(props([]));
  });
  const beforeAbort = count();
  answers[2]();
  await flush();
  expect(count()).toBe(beforeAbort);

  act(() => result.current.open(['s5']));
  rerender(props(['s5']));
  await flush();
  rerender(
    props(['s5'], { data: [{ session_id: 's5' }, { session_id: 's1' }] }),
  );
  await flush();
  const beforeStale = count();
  answers[3]();
  await flush();
  expect(count()).toBe(beforeStale);
  answers[4]();
  await flush();
  expect(count()).not.toBe(beforeStale);

  act(() => result.current.loadMore(['s5']));
  await flush();
  answers[5]();
  await flush();
  expect(stepsOf(result.current.entries, 's5')).toEqual([0, 1, 2, 3]);
  spy.mockRestore();
});

test.each([
  ['refresh', 'the replacement first'],
  ['refresh', 'Load more first'],
  ['re-sort', 'the replacement first'],
  ['re-sort', 'Load more first'],
])(
  'while a %s batch is pending Load more starts nothing; rows stay contiguous with %s',
  async (replacement, order) => {
    const { answers, spy } = deferredFetch();
    const { result, rerender } = renderHook(
      (p: UseChildrenParams) => useChildren(p),
      {
        initialProps: moreParams(),
      },
    );
    act(() => result.current.open(['s5']));
    answers[0]();
    await flush();
    act(() => result.current.loadMore(['s5']));
    answers[1]();
    await flush();
    expect(stepsOf(result.current.entries, 's5')).toEqual([0, 1, 2, 3]);
    if (replacement === 'refresh')
      rerender(moreParams({ data: [...moreData] }));
    else act(() => result.current.setSort(1, ['step', false], ['s5']));
    await flush();
    expect(answers).toHaveLength(3);
    expect(result.current.areas.get('["s5"]')?.state).toBe('loading');
    act(() => result.current.loadMore(['s5']));
    await flush();
    expect(answers).toHaveLength(3);
    const replace = () => answers[2]();
    const more = () => answers[3]?.();
    if (order === 'Load more first') {
      more();
      await flush();
      replace();
    } else {
      replace();
      await flush();
      more();
    }
    await flush();
    expect(stepsOf(result.current.entries, 's5')).toEqual([0, 1]);
    act(() => result.current.loadMore(['s5']));
    answers[answers.length - 1]();
    await flush();
    expect(stepsOf(result.current.entries, 's5')).toEqual([0, 1, 2, 3]);
    spy.mockRestore();
  },
);

test('Expand all to level 2 sends one batch and settles every area; child areas from the batch and from Load more have the expand-all origin', async () => {
  const props = (expanded: string[]) =>
    moreParams({
      expanded: new Set(expanded),
      expandLevel: 2,
    });
  const { result, rerender } = renderHook(
    (p: UseChildrenParams) => useChildren(p),
    {
      initialProps: props([]),
    },
  );
  act(() => result.current.expandAll(2, ['s5', 's1'], []));
  rerender(props(['s5', 's1']));
  await flush();
  expect(rowBodies()).toHaveLength(1);
  expect(loadingAreas(result)).toEqual([]);
  expect(errorAreas(result)).toEqual([]);
  const childAreas = () =>
    [...result.current.areas.values()].filter(area => area.level === 2);
  expect(childAreas().map(area => area.path)).toEqual([
    ['s5', 's5-0'],
    ['s5', 's5-1'],
    ['s1', 's1-0'],
    ['s1', 's1-1'],
  ]);
  childAreas().forEach(area =>
    expect(area).toMatchObject({ action: 'expand-all', origin: 'expand-all' }),
  );
  act(() => result.current.loadMore(['s5']));
  expect(result.current.areas.get('["s5"]')).toMatchObject({
    action: 'load-more',
    origin: 'user',
    more: 'loading',
  });
  await flush();
  expect(rowBodies()).toHaveLength(2);
  expect(result.current.areas.get('["s5"]')?.more).toBeUndefined();
  expect(childAreas()).toHaveLength(6);
  childAreas().forEach(area =>
    expect(area).toMatchObject({ action: 'expand-all', origin: 'expand-all' }),
  );
  act(() => result.current.record('["s5","s5-2"]', 'collapse'));
  expect(result.current.areas.get('["s5","s5-3"]')?.origin).toBe('expand-all');
});

test.each(['the first batch', 'a refresh batch', 'a sort batch'])(
  'collapse and reopen while %s is pending: its answer changes no state, the reopen sends its own request',
  async pendingBatch => {
    const { answers, spy } = deferredFetch();
    let pageData = moreData;
    const props = (expanded: string[]) =>
      moreParams({
        expanded: new Set(expanded),
        data: pageData,
      });
    const { result, rerender } = renderHook(
      (p: UseChildrenParams) => useChildren(p),
      {
        initialProps: props([]),
      },
    );
    act(() => {
      result.current.open(['s5']);
      result.current.record('["s5"]', 'expand');
    });
    rerender(props(['s5']));
    if (pendingBatch !== 'the first batch') {
      answers[0]();
      await flush();
      if (pendingBatch === 'a refresh batch') {
        pageData = [...moreData];
        rerender(props(['s5']));
      } else act(() => result.current.setSort(1, ['step', false], ['s5']));
      await flush();
    }
    const batch = answers.length - 1;
    expect(result.current.areas.get('["s5"]')?.state).toBe('loading');
    act(() => {
      result.current.close(['s5']);
      result.current.record('["s5"]', 'collapse');
    });
    rerender(props([]));
    await flush();
    act(() => {
      result.current.open(['s5']);
      result.current.record('["s5"]', 'expand');
    });
    rerender(props(['s5']));
    await flush();
    expect(answers).toHaveLength(batch + 2);
    expect(spy.mock.calls[batch + 1][0].force).toBe(
      pendingBatch === 'a refresh batch',
    );
    const area = result.current.areas.get('["s5"]');
    const entry = result.current.entries.get('["s5"]');
    answers[batch]();
    await flush();
    expect(result.current.areas.get('["s5"]')).toEqual(area);
    expect(result.current.entries.get('["s5"]')).toEqual(entry);
    answers[batch + 1]();
    await flush();
    expect(result.current.areas.get('["s5"]')).toEqual({
      path: ['s5'],
      level: 1,
      action: 'expand',
      origin: 'user',
      state: 'loaded',
      loaded: 2,
      total: 5,
    });
    expect(result.current.entries.get(areaKey(['s1']))?.status).toBe('loaded');
    spy.mockRestore();
  },
);

// Three levels: Channel -> Session -> Step. Session `x` is in both
// channels, so its steps must be matched by the whole path.
const channel: TreeLevel = {
  key: 'channel',
  name: 'Channel',
  id_column: 'channel',
  columns: [],
  detail_fields: [],
};
const deepSession: TreeLevel = {
  key: 'session',
  name: 'Session',
  id_column: 'session_id',
  parent_column: 'channel',
  columns: ['duration'],
  detail_fields: [],
  children_shown: 2,
};
const deepStep: TreeLevel = {
  key: 'step',
  name: 'Step',
  id_column: 'step_id',
  parent_column: 'session_id',
  columns: ['step'],
  detail_fields: ['result'],
  children_shown: 2,
};
const deepForm: TreeTableFormData = {
  ...formData,
  levels: [channel, deepSession, deepStep],
};
const TABLE: Record<string, unknown>[] = [
  ['A', 'a1', 3],
  ['A', 'a2', 1],
  ['A', 'a3', 2],
  ['A', 'x', 2],
  ['B', 'b1', 4],
  ['B', 'x', 5],
].flatMap(([channelKey, session, steps], sessionIndex) =>
  Array.from({ length: steps as number }, (_, index) => ({
    channel: channelKey,
    session_id: session,
    duration: 10 - sessionIndex,
    step_id: `${channelKey}/${session}-${index}`,
    step: index,
    result: 'ok',
  })),
);

type Query = {
  columns: string[];
  metrics: { column?: { column_name: string } }[];
  filters: { col: string; op: string; val?: unknown }[];
  orderby: [string, boolean][];
  post_processing: { options?: { groupby: string[]; n: number } }[];
  row_offset?: number;
  row_limit?: number;
};

/** Answer one query of a children request from `TABLE`, as the database would. */
function runQuery(query: Query) {
  const rows = TABLE.filter(row =>
    query.filters.every(filter => {
      if (filter.op === 'IN')
        return (filter.val as unknown[]).includes(row[filter.col]);
      if (filter.op === 'IS NOT NULL') return row[filter.col] != null;
      return true;
    }),
  );
  const tupleOf = (row: Record<string, unknown>, columns: string[]) =>
    JSON.stringify(columns.map(column => row[column]));
  const groups = new Map<string, Record<string, unknown>[]>();
  rows.forEach(row => {
    const key = tupleOf(row, query.columns);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  if (query.metrics.length) {
    const label = `COUNT_DISTINCT(${query.metrics[0].column!.column_name})`;
    return [...groups.values()].map(group => ({
      ...Object.fromEntries(
        query.columns.map(column => [column, group[0][column]]),
      ),
      [label]: new Set(
        group.map(row => row[query.metrics[0].column!.column_name]),
      ).size,
    }));
  }
  const distinct = [...groups.values()].map(group =>
    Object.fromEntries(query.columns.map(column => [column, group[0][column]])),
  );
  distinct.sort((a, b) => {
    for (const [column, ascending] of query.orderby) {
      if (a[column] === b[column]) continue;
      const order = (a[column] as string) < (b[column] as string) ? -1 : 1;
      return ascending ? order : -order;
    }
    return 0;
  });
  const options = query.post_processing[0]?.options;
  if (options) {
    const taken = new Map<string, number>();
    return distinct.filter(row => {
      const key = tupleOf(row, options.groupby);
      taken.set(key, (taken.get(key) ?? 0) + 1);
      return (taken.get(key) ?? 0) <= options.n;
    });
  }
  const offset = query.row_offset ?? 0;
  return distinct.slice(offset, offset + (query.row_limit ?? distinct.length));
}

type DeepBody = { force: boolean; queries: Query[] };
const deepRequests = () =>
  fetchMock.callHistory
    .calls(CHART_DATA_ENDPOINT)
    .map(call => JSON.parse(call.options.body as string) as DeepBody);
const deepBatchBodies = () =>
  deepRequests().filter(
    body =>
      body.queries.length > 1 ||
      body.queries[0].metrics.length ||
      body.queries[0].row_offset,
  );
const deepRowBodies = () =>
  deepRequests().filter(body => !body.queries[0].metrics.length);
const inFilters = (body: DeepBody) =>
  Object.fromEntries(
    body.queries[0].filters
      .filter(filter => filter.op === 'IN')
      .map(filter => [filter.col, filter.val]),
  );
const levelOf = (body: DeepBody) =>
  body.queries[0].filters.filter(filter => filter.op === 'IN').length;

let deepHold: Promise<void> | undefined;
let deepHoldLevel: number | undefined;
let deepFail = 0;
function deepRoute() {
  fetchMock.removeRoute(CHART_DATA_ENDPOINT);
  fetchMock.post(
    CHART_DATA_ENDPOINT,
    async ({ options }) => {
      const body = JSON.parse(options.body as string) as DeepBody;
      if (deepHold && (!deepHoldLevel || deepHoldLevel === levelOf(body)))
        await deepHold;
      if (deepFail > 0) {
        deepFail -= 1;
        return { status: 500, body: { message: 'Query failed' } };
      }
      return {
        result: body.queries.map(query => {
          const data = runQuery(query);
          return {
            data,
            colnames: data[0] ? Object.keys(data[0]) : query.columns,
            coltypes: [],
            rowcount: data.length,
            sql_rowcount: runQuery({ ...query, post_processing: [] }).length,
          };
        }),
      };
    },
    { name: CHART_DATA_ENDPOINT },
  );
}
beforeEach(() => {
  deepHold = undefined;
  deepHoldLevel = undefined;
  deepFail = 0;
});

const deepData = [{ channel: 'A' }, { channel: 'B' }];
const deepParams = (extra: Partial<UseChildrenParams> = {}) =>
  params({
    formData: deepForm,
    pageKeys: ['A', 'B'],
    data: deepData,
    expanded: new Set(['A', 'B']),
    ...extra,
  });
const key3 = (...path: string[]) => JSON.stringify(path);

async function openDeep(extra: Partial<UseChildrenParams> = {}) {
  deepRoute();
  const hook = renderHook((props: UseChildrenParams) => useChildren(props), {
    initialProps: deepParams(extra),
  });
  act(() => hook.result.current.open(['A']));
  await flush();
  return hook;
}

test('three levels: the first level-3 open sends one batch for every visible level-2 row without steps; a second open sends none', async () => {
  const { result, rerender } = await openDeep();
  expect(deepBatchBodies()).toHaveLength(1);
  expect(statuses(result.current.entries)).toEqual({
    A: 'loaded',
    B: 'loaded',
  });
  act(() => result.current.open(['A', 'a1']));
  rerender(deepParams({ childToggled: new Set([key3('A', 'a1')]) }));
  await flush();
  expect(deepBatchBodies()).toHaveLength(2);
  const [, batch] = deepRowBodies();
  expect(levelOf(batch)).toBe(2);
  expect(inFilters(batch)).toEqual({
    channel: ['A', 'B'],
    session_id: ['a1', 'a2', 'b1', 'x'],
  });
  expect(batch.queries[0].post_processing[0].options).toEqual({
    groupby: ['channel', 'session_id'],
    n: 2,
  });
  expect(statuses(result.current.entries)).toEqual({
    A: 'loaded',
    B: 'loaded',
    'A > a1': 'loaded',
    'A > a2': 'loaded',
    'B > b1': 'loaded',
    'B > x': 'loaded',
  });
  expect(
    result.current.entries.get(key3('B', 'x'))?.rows.map(row => row.step_id),
  ).toEqual(['B/x-0', 'B/x-1']);
  expect(result.current.entries.get(key3('B', 'x'))?.total).toBe(5);
  act(() => result.current.open(['A', 'a2']));
  await flush();
  expect(deepBatchBodies()).toHaveLength(2);
});

test('three levels: a session from Load more opens with one batch for the loaded sessions that have no steps yet', async () => {
  const { result, rerender } = await openDeep();
  act(() => result.current.open(['A', 'a1']));
  rerender(deepParams({ childToggled: new Set([key3('A', 'a1')]) }));
  await flush();
  act(() => result.current.loadMore(['A']));
  await flush();
  expect(levelOf(deepBatchBodies()[2])).toBe(1);
  act(() => result.current.open(['A', 'a3']));
  await flush();
  expect(deepBatchBodies()).toHaveLength(4);
  expect(inFilters(deepBatchBodies()[3])).toEqual({
    channel: ['A'],
    session_id: ['a3', 'x'],
  });
});

test('three levels: a failed level-3 batch marks the open path error, drops the closed ones, and a later open sends one path', async () => {
  const { result, rerender } = await openDeep();
  deepFail = 1;
  act(() => result.current.open(['A', 'a1']));
  rerender(deepParams({ childToggled: new Set([key3('A', 'a1')]) }));
  await flush();
  expect(statuses(result.current.entries)).toEqual({
    A: 'loaded',
    B: 'loaded',
    'A > a1': 'error',
  });
  act(() => result.current.open(['B', 'x']));
  await flush();
  expect(deepBatchBodies()).toHaveLength(3);
  expect(inFilters(deepBatchBodies()[2])).toEqual({
    channel: ['B'],
    session_id: ['x'],
  });
  expect(result.current.entries.get(key3('B', 'x'))?.rows).toHaveLength(2);
  act(() => result.current.retry(['A', 'a1']));
  await flush();
  expect(inFilters(deepBatchBodies()[3])).toEqual({
    channel: ['A'],
    session_id: ['a1'],
  });
  expect(result.current.entries.get(key3('A', 'a1'))?.status).toBe('loaded');
});

test('three levels: a level-2 sort re-sends one batch and drops the steps of sessions that left; steps of sessions still there stay', async () => {
  const { result, rerender } = await openDeep();
  act(() => result.current.loadMore(['A']));
  await flush();
  const toggled = new Set([key3('A', 'a3'), key3('A', 'a1')]);
  act(() => result.current.open(['A', 'a3']));
  rerender(deepParams({ childToggled: toggled }));
  await flush();
  expect(result.current.entries.has(key3('A', 'a3'))).toBe(true);
  expect(result.current.entries.has(key3('A', 'a1'))).toBe(true);
  const before = deepBatchBodies().length;
  act(() => result.current.setSort(1, ['duration', false], ['A']));
  await flush();
  expect(deepBatchBodies()).toHaveLength(before + 1);
  const sorted = deepRowBodies()[deepRowBodies().length - 1];
  expect(levelOf(sorted)).toBe(1);
  expect(sorted.queries[0].orderby).toEqual([
    ['channel', true],
    ['duration', false],
    ['session_id', true],
  ]);
  expect(result.current.sorts.get(1)).toEqual(['duration', false]);
  expect(
    result.current.entries.get(key3('A'))?.rows.map(row => row.session_id),
  ).toEqual(['a1', 'a2']);
  expect(result.current.entries.has(key3('A', 'a3'))).toBe(false);
  expect(result.current.entries.has(key3('A', 'a1'))).toBe(true);
});

test('three levels: a level-3 answer that lands after a level-2 sort is stored by path; the sort does not abort it', async () => {
  const { result, rerender } = await openDeep();
  let release: () => void = () => {};
  deepHold = new Promise(resolve => {
    release = resolve;
  });
  deepHoldLevel = 2;
  act(() => result.current.open(['A', 'a1']));
  rerender(deepParams({ childToggled: new Set([key3('A', 'a1')]) }));
  act(() => result.current.setSort(1, ['duration', true], ['A']));
  await flush();
  expect(deepBatchBodies().map(levelOf)).toEqual([1, 2, 1]);
  expect(
    result.current.entries.get(key3('A'))?.rows.map(row => row.session_id),
  ).toEqual(['x', 'a3']);
  release();
  deepHold = undefined;
  await flush();
  expect(result.current.entries.get(key3('A', 'a1'))?.status).toBe('loaded');
  expect(result.current.entries.get(key3('B', 'x'))?.status).toBe('loaded');
});

test('three levels: Expand all to Steps sends one batch per level as the rows land', async () => {
  deepRoute();
  const { result, rerender } = renderHook(
    (props: UseChildrenParams) => useChildren(props),
    {
      initialProps: deepParams({ expanded: new Set() }),
    },
  );
  act(() => result.current.expandAll(3, ['A', 'B'], []));
  rerender(deepParams({ expandLevel: 3 }));
  await flush();
  await flush();
  expect(deepBatchBodies().map(levelOf)).toEqual([1, 2]);
  expect(inFilters(deepBatchBodies()[1])).toEqual({
    channel: ['A', 'B'],
    session_id: ['a1', 'a2', 'b1', 'x'],
  });
  expect([...result.current.childExpanded].sort()).toEqual(
    [
      key3('A', 'a1'),
      key3('A', 'a2'),
      key3('B', 'b1'),
      key3('B', 'x'),
      key3('A', 'a1', 'A/a1-0'),
      key3('A', 'a1', 'A/a1-1'),
      key3('A', 'a2', 'A/a2-0'),
      key3('B', 'b1', 'B/b1-0'),
      key3('B', 'b1', 'B/b1-1'),
      key3('B', 'x', 'B/x-0'),
      key3('B', 'x', 'B/x-1'),
    ].sort(),
  );
  expect(loadingAreas(result)).toEqual([]);
  expect(errorAreas(result)).toEqual([]);
  act(() => result.current.loadMore(['A']));
  await flush();
  expect(deepBatchBodies().map(levelOf)).toEqual([1, 2, 1, 2]);
  expect(inFilters(deepBatchBodies()[3])).toEqual({
    channel: ['A'],
    session_id: ['a3', 'x'],
  });
  expect(result.current.childExpanded.has(key3('A', 'a3', 'A/a3-0'))).toBe(
    true,
  );
});

test.each([
  ['a refresh', true],
  ['a filter change', false],
])(
  'three levels: %s reloads level by level with the same force and drops closed level-3 entries',
  async (_name, force) => {
    const { result, rerender } = await openDeep();
    const toggled = new Set([key3('A', 'a1')]);
    act(() => result.current.open(['A', 'a1']));
    rerender(deepParams({ childToggled: toggled }));
    await flush();
    expect(result.current.entries.has(key3('B', 'x'))).toBe(true);
    let release: () => void = () => {};
    deepHold = new Promise(resolve => {
      release = resolve;
    });
    rerender(
      deepParams({
        childToggled: toggled,
        data: [...deepData],
        formData: force
          ? deepForm
          : { ...deepForm, extra_form_data: { time_range: 'Last week' } },
      }),
    );
    await flush();
    expect(deepBatchBodies().map(levelOf)).toEqual([1, 2, 1]);
    expect(result.current.entries.has(key3('B', 'x'))).toBe(false);
    expect(result.current.entries.get(key3('A', 'a1'))?.status).toBe('loaded');
    expect(result.current.entries.get(key3('A', 'a1'))?.rows).toHaveLength(2);
    release();
    deepHold = undefined;
    await flush();
    await flush();
    const sent = deepBatchBodies();
    expect(sent.map(levelOf)).toEqual([1, 2, 1, 2]);
    expect(sent.slice(2).map(body => body.force)).toEqual([force, force]);
    expect(inFilters(sent[3])).toEqual({ channel: ['A'], session_id: ['a1'] });
    expect(statuses(result.current.entries)).toEqual({
      A: 'loaded',
      B: 'loaded',
      'A > a1': 'loaded',
    });
  },
);

test('three levels: reset aborts every level, clears every entry and keeps each level sort', async () => {
  const { result, rerender } = await openDeep();
  act(() => result.current.setSort(2, ['step', false], ['A', 'a1']));
  act(() => result.current.setSort(1, ['duration', true], ['A']));
  await flush();
  deepHold = new Promise(() => {});
  act(() => result.current.open(['A', 'a1']));
  rerender(deepParams({ childToggled: new Set([key3('A', 'a1')]) }));
  act(() => result.current.reset());
  await flush();
  expect(result.current.entries.size).toBe(0);
  expect([...result.current.sorts]).toEqual([
    [2, ['step', false]],
    [1, ['duration', true]],
  ]);
});

test('three levels: a collapsed path whose request was aborted is sent again on its next open', async () => {
  const { result, rerender } = await openDeep();
  act(() => result.current.open(['A', 'a1']));
  rerender(deepParams({ childToggled: new Set([key3('A', 'a1')]) }));
  await flush();
  act(() => result.current.loadMore(['A']));
  await flush();
  deepHold = new Promise(() => {});
  act(() => result.current.open(['A', 'a3']));
  await flush();
  const sent = deepBatchBodies().length;
  expect(inFilters(deepBatchBodies()[sent - 1])).toEqual({
    channel: ['A'],
    session_id: ['a3', 'x'],
  });
  deepHold = undefined;
  act(() => result.current.reset());
  act(() => result.current.open(['A']));
  await flush();
  act(() => result.current.open(['A', 'a1']));
  await flush();
  expect(levelOf(deepBatchBodies()[deepBatchBodies().length - 1])).toBe(2);
  expect(result.current.entries.get(key3('A', 'a1'))?.status).toBe('loaded');
});

test('heights: a grid resets its row heights once per animation frame', async () => {
  const resetRowHeights = jest.fn();
  const { result } = renderHook(() => useRowHeights());
  act(() =>
    result.current.onReady({
      resetRowHeights,
      isDestroyed: () => false,
    } as unknown as GridApi),
  );
  expect(resetRowHeights).toHaveBeenCalledTimes(1);
  act(() => {
    result.current.reportHeight('marker-0', 100);
    result.current.reportHeight('marker-1', 200);
    result.current.reportHeight('marker-2', 300);
    result.current.resetHeights(['marker-0', 'marker-1']);
  });
  expect(resetRowHeights).toHaveBeenCalledTimes(1);
  await act(() => jest.advanceTimersByTimeAsync(16));
  expect(resetRowHeights).toHaveBeenCalledTimes(2);
  expect([...result.current.heights.current.keys()]).toEqual([
    'marker-0',
    'marker-1',
  ]);
});

test('three levels: after a reset, a late level-3 answer changes no state', async () => {
  const { result, rerender } = await openDeep();
  let release: () => void = () => {};
  deepHold = new Promise(resolve => {
    release = resolve;
  });
  const toggled = new Set([key3('A', 'a1')]);
  act(() => {
    result.current.open(['A', 'a1']);
    result.current.record(key3('A', 'a1'), 'expand');
  });
  rerender(deepParams({ childToggled: toggled }));
  await flush();
  expect(result.current.areas.get(key3('A', 'a1'))?.state).toBe('loading');
  act(() => result.current.reset());
  rerender(deepParams({ expanded: new Set() }));
  await flush();
  release();
  deepHold = undefined;
  await flush();
  expect(result.current.entries.size).toBe(0);
  expect(result.current.areas.size).toBe(0);
});

const controlledTransport = (rejectOnAbort = false) => {
  type Call = {
    body: Body;
    signal?: AbortSignal;
    resolve: (result: TreeTableQueryResult[]) => void;
    reject: (error: Error) => void;
  };
  const replies: Call[] = [];
  const rows = new Map<
    AbortSignal | undefined,
    { result: TreeTableQueryResult; call: Call }
  >();
  jest
    .spyOn(fetchModule, 'default')
    .mockImplementation(({ buildQuery, formData: raw, signal, force }) => {
      const body = { ...buildQuery(raw), force } as unknown as Body;
      const query = body.queries[0] as Query;
      const countsOnly =
        body.queries.length === 1 && Boolean(query.metrics.length);
      if (
        body.queries.length === 1 &&
        !query.metrics.length &&
        !query.row_offset
      ) {
        const answer = rows.get(signal);
        if (answer) answer.call.body = body;
        return Promise.resolve(answer ? [answer.result] : []);
      }
      return new Promise((resolve, reject) => {
        if (rejectOnAbort)
          signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        const call: Call = {
          body,
          signal,
          reject,
          resolve: result => {
            if (!countsOnly) {
              resolve(result);
              return;
            }
            rows.set(signal, { result: result[0], call });
            const counts = result[1];
            const label = `COUNT_DISTINCT(${query.metrics[0].column!.column_name})`;
            const combinations = query.columns.reduce<Record<string, string>[]>(
              (paths, column) => {
                const filter = query.filters.find(
                  filter => filter.col === column && filter.op === 'IN',
                );
                return paths.flatMap(path =>
                  ((filter?.val as string[] | undefined) ?? []).map(value => ({
                    ...path,
                    [column]: value,
                  })),
                );
              },
              [{}],
            );
            const data = counts?.data.length
              ? combinations.map(path => ({
                  ...path,
                  [label]:
                    counts.data.find(row =>
                      query.columns.every(
                        column => row[column] === path[column],
                      ),
                    )?.[label] ??
                    (result[0].sql_rowcount === counts.data.length ? 1 : 0),
                }))
              : [];
            resolve([
              {
                ...counts,
                data,
                rowcount: data.length,
                sql_rowcount: data.length,
              },
            ]);
          },
        };
        replies.push(call);
      });
    });
  return replies;
};

const verificationAnswer = (ids: string[]): TreeTableQueryResult[] => [
  {
    data: ids.map(id => ({ session_id: id, step_id: `${id}-step`, step: 0 })),
    colnames: ['session_id', 'step_id', 'step'],
    coltypes: [],
    rowcount: ids.length,
    sql_rowcount: ids.length,
  },
  {
    data: ids.map(id => ({ session_id: id, 'COUNT_DISTINCT(step_id)': 1 })),
    colnames: ['session_id', 'COUNT_DISTINCT(step_id)'],
    coltypes: [],
    rowcount: ids.length,
    sql_rowcount: ids.length,
  },
];

test('clipped batches repair ten open paths in page order and leave closed paths for their next open', async () => {
  const replies = controlledTransport();
  const missing = Array.from({ length: 797 }, (_, i) => `m${i}`);
  const open = new Set(missing.slice(0, 12).reverse());
  const props = params({ pageKeys: ['known', ...missing], expanded: open });
  const { result, rerender } = renderHook(useChildren, { initialProps: props });
  act(() => result.current.open(['m0']));
  await act(async () => replies[0].resolve(verificationAnswer(['known'])));
  expect(replies).toHaveLength(5);
  missing
    .slice(0, 10)
    .forEach(id =>
      expect(result.current.entries.get(areaKey([id]))?.status).toBe('loading'),
    );
  missing
    .slice(10, 12)
    .forEach(id =>
      expect(result.current.entries.get(areaKey([id]))?.status).toBe('error'),
    );
  missing
    .slice(12)
    .forEach(id =>
      expect(result.current.entries.has(areaKey([id]))).toBe(false),
    );
  await act(async () => {
    replies[1].resolve(verificationAnswer([]));
    replies[2].resolve(verificationAnswer(['m1']));
    replies[3].reject(new Error('failed verification'));
  });
  let settled = 4;
  while (settled < replies.length) {
    const batch = replies.slice(settled);
    settled = replies.length;
    await act(async () =>
      batch.forEach(call => call.resolve(verificationAnswer([]))),
    );
  }
  expect(result.current.entries.get(areaKey(['m0']))?.status).toBe('empty');
  expect(result.current.entries.get(areaKey(['m1']))?.status).toBe('loaded');
  expect(result.current.entries.get(areaKey(['m2']))?.status).toBe('error');
  expect(replies).toHaveLength(11);
  expect(fetchModule.default).toHaveBeenCalledTimes(12);
  expect(replies.slice(1).map(call => parentIdsOf(call.body))).toEqual(
    missing.slice(0, 10).map(id => [id]),
  );
  expect(replies.slice(1).every(call => call.body.force === false)).toBe(true);
  rerender({ ...props, expanded: new Set([...open, 'm12']) });
  act(() => result.current.open(['m12']));
  expect(replies).toHaveLength(12);
  expect(fetchModule.default).toHaveBeenCalledTimes(13);
  expect(parentIdsOf(replies[11].body)).toEqual(['m12']);
  await act(async () => replies[11].resolve(verificationAnswer(['m12'])));
});

test('reset aborts verification and ignores late answers without another round', async () => {
  const replies = controlledTransport();
  const { result } = renderHook(useChildren, {
    initialProps: params({
      pageKeys: ['known', 'm0', 'm1'],
      expanded: new Set(['m0', 'm1']),
    }),
  });
  act(() => result.current.open(['m0']));
  await act(async () => replies[0].resolve(verificationAnswer(['known'])));
  expect(replies).toHaveLength(3);
  act(() => result.current.reset());
  expect(replies.slice(1).every(call => call.signal?.aborted)).toBe(true);
  await act(async () =>
    replies
      .slice(1)
      .forEach(call => call.resolve(verificationAnswer(['m0', 'm1']))),
  );
  expect(result.current.entries.size).toBe(0);
  expect(replies).toHaveLength(3);
});

test('Expand all sends the next-level batch once after the entire verification round', async () => {
  const replies = controlledTransport();
  const third: TreeLevel = {
    ...step,
    key: 'action',
    id_column: 'action_id',
    parent_column: 'step_id',
  };
  const props = params({
    formData: { ...formData, levels: [session, step, third] },
    pageKeys: ['known', 'm0', 'm1'],
    expanded: new Set(['known', 'm0', 'm1']),
    expandLevel: 3,
  });
  const { result } = renderHook(useChildren, { initialProps: props });
  act(() => result.current.open(['m0']));
  await act(async () => replies[0].resolve(verificationAnswer(['known'])));
  expect(replies).toHaveLength(3);
  await act(async () => replies[1].resolve(verificationAnswer(['m0'])));
  expect(replies).toHaveLength(3);
  await act(async () => replies[2].resolve(verificationAnswer(['m1'])));
  expect(replies).toHaveLength(4);
  expect(replies[3].body.queries[0].filters).toContainEqual({
    col: 'step_id',
    op: 'IN',
    val: ['known-step', 'm0-step', 'm1-step'],
  });
});

test('dashboard date changes carry both new ranges with force false; refresh uses force true', async () => {
  const replies = controlledTransport();
  const raw = {
    ...formData,
    levels: [
      { ...session, time_column: 'session_started_at' },
      { ...step, time_column: 'step_started_at', apply_date_filter: true },
    ],
    extra_form_data: { time_range: '2026-11-11 : 2026-11-12' },
  };
  const props = params({ formData: raw, expanded: new Set(['s1']) });
  const { result, rerender } = renderHook(useChildren, { initialProps: props });
  act(() => result.current.open(['s1']));
  await act(async () => replies[0].resolve(verificationAnswer(['s1', 's3'])));
  const next = {
    ...props,
    formData: {
      ...raw,
      extra_form_data: { time_range: '2026-11-11 : 2026-11-13' },
    },
    data: [...data],
  };
  rerender(next);
  expect(replies).toHaveLength(2);
  expect(replies[1].body.force).toBe(false);
  expect(
    replies[1].body.queries[0].filters.filter(
      filter => filter.op === 'TEMPORAL_RANGE',
    ),
  ).toEqual(
    ['session_started_at', 'step_started_at'].map(col => ({
      col,
      op: 'TEMPORAL_RANGE',
      val: '2026-11-11 : 2026-11-13',
    })),
  );
  await act(async () => replies[1].resolve(verificationAnswer(['s1', 's3'])));
  rerender({ ...next, data: [...data] });
  expect(replies).toHaveLength(3);
  expect(replies[2].body.force).toBe(true);
  expect(replies[2].body.queries[0].filters).toEqual(
    replies[1].body.queries[0].filters,
  );
});

test('refresh keeps old rows during verification and waits for every answer before its next-level batch', async () => {
  const replies = controlledTransport();
  const third: TreeLevel = {
    ...step,
    key: 'action',
    id_column: 'action_id',
    parent_column: 'step_id',
  };
  const props = params({
    formData: { ...formData, levels: [session, step, third] },
    pageKeys: ['known', 'm0', 'm1'],
    expanded: new Set(['known', 'm0', 'm1']),
    expandLevel: 3,
  });
  const { result, rerender } = renderHook(useChildren, { initialProps: props });
  act(() => result.current.open(['known']));
  await act(async () =>
    replies[0].resolve(verificationAnswer(['known', 'm0', 'm1'])),
  );
  expect(replies).toHaveLength(2);
  await act(async () => replies[1].resolve(verificationAnswer([])));
  rerender({ ...props, data: [...data] });
  expect(replies).toHaveLength(3);
  await act(async () => replies[2].resolve(verificationAnswer(['known'])));
  expect(replies).toHaveLength(5);
  expect(replies.slice(2).every(call => call.body.force)).toBe(true);
  expect(result.current.entries.get(areaKey(['m0']))?.rows).toHaveLength(1);
  await act(async () => replies[3].resolve(verificationAnswer([])));
  expect(replies).toHaveLength(5);
  expect(result.current.entries.get(areaKey(['m0']))?.status).toBe('empty');
  expect(result.current.entries.get(areaKey(['m1']))?.rows).toHaveLength(1);
  await act(async () => replies[4].resolve(verificationAnswer(['m1'])));
  expect(replies).toHaveLength(6);
  expect(replies[5].body.force).toBe(true);
});

test('a batch answer after close is available on reopen', async () => {
  let release = () => {};
  hold = new Promise<void>(resolve => {
    release = resolve;
  });
  const { result, rerender } = renderHook(useChildren, {
    initialProps: params(),
  });
  act(() => result.current.open(['s1']));
  rerender(params({ expanded: new Set(['s1']) }));
  act(() => result.current.close(['s1']));
  rerender(params());
  release();
  hold = undefined;
  await flush();
  act(() => result.current.open(['s1']));
  rerender(params({ expanded: new Set(['s1']) }));
  await flush();
  expect(result.current.entries.get(areaKey(['s1']))?.status).toBe('loaded');
  expect(result.current.areas.get(areaKey(['s1']))?.state).toBe('loaded');
  expect(rowBodies()).toHaveLength(1);
});

test('open-close-open during a refresh keeps the newer answer', async () => {
  const replies = controlledTransport();
  const props = params({ expanded: new Set(['s1']) });
  const { result, rerender } = renderHook(useChildren, { initialProps: props });
  act(() => result.current.open(['s1']));
  await act(async () => replies[0].resolve(verificationAnswer(['s1'])));
  rerender({ ...props, data: [...data] });
  expect(replies).toHaveLength(2);
  act(() => result.current.close(['s1']));
  rerender({ ...props, expanded: new Set() });
  act(() => result.current.open(['s1']));
  rerender(props);
  expect(replies).toHaveLength(3);
  await act(async () => replies[2].resolve(verificationAnswer(['s1'])));
  await act(async () => replies[1].resolve(verificationAnswer([])));
  expect(result.current.entries.get(areaKey(['s1']))?.status).toBe('loaded');
  expect(result.current.areas.get(areaKey(['s1']))?.state).toBe('loaded');
});

const callsIn = (body: Body) =>
  body.queries[0].filters
    .filter(filter => filter.op === 'IN')
    .map(filter => filter.val);

test.each(['close', 'abort-error'] as const)(
  'cancelling a reopened refresh single via %s hands over to the next level',
  async cancellation => {
    const replies = controlledTransport(true);
    const parentData = [{ session_id: 's1' }, { session_id: 's2' }];
    const props = params({
      formData: {
        ...formData,
        levels: [
          session,
          step,
          {
            ...step,
            key: 'action',
            id_column: 'action_id',
            parent_column: 'step_id',
            columns: ['action_id'],
          },
        ],
      },
      pageKeys: ['s1', 's2'],
      expanded: new Set(['s1', 's2']),
      data: parentData,
      expandLevel: 3,
    });
    const actions = (ids: string[]): TreeTableQueryResult[] => [
      {
        data: ids.map(id => ({
          session_id: id,
          step_id: `${id}-step`,
          action_id: `${id}-action`,
        })),
        colnames: ['session_id', 'step_id', 'action_id'],
        coltypes: [],
        rowcount: ids.length,
        sql_rowcount: ids.length,
      },
      {
        data: ids.map(id => ({
          session_id: id,
          step_id: `${id}-step`,
          'COUNT_DISTINCT(action_id)': 1,
        })),
        colnames: ['session_id', 'step_id', 'COUNT_DISTINCT(action_id)'],
        coltypes: [],
        rowcount: ids.length,
        sql_rowcount: ids.length,
      },
    ];
    const { result, rerender } = renderHook(useChildren, {
      initialProps: props,
    });
    try {
      act(() => result.current.open(['s1']));
      await act(async () =>
        replies[0].resolve(verificationAnswer(['s1', 's2'])),
      );
      expect(replies).toHaveLength(2);
      expect(callsIn(replies[1].body)).toHaveLength(2);
      await act(async () => replies[1].resolve(actions(['s1', 's2'])));
      expect(
        result.current.entries.get(areaKey(['s2', 's2-step']))?.status,
      ).toBe('loaded');

      const refreshed = { ...props, data: [...parentData] };
      rerender(refreshed);
      expect(replies).toHaveLength(3);
      expect(callsIn(replies[2].body)).toHaveLength(1);
      act(() => result.current.close(['s1']));
      rerender({ ...refreshed, expanded: new Set(['s2']) });
      act(() => result.current.open(['s1']));
      rerender(refreshed);
      const reopenCalls = replies.length;
      await act(async () =>
        replies[2].resolve(verificationAnswer(['s1', 's2'])),
      );
      if (cancellation === 'close') act(() => result.current.close(['s1']));
      rerender({ ...refreshed, expanded: new Set(['s2']) });
      if (cancellation === 'abort-error')
        await act(async () =>
          replies[reopenCalls - 1].reject(
            Object.assign(new Error('aborted'), { name: 'AbortError' }),
          ),
        );
      await flush();
      const nextLevel = replies
        .slice(reopenCalls)
        .filter(call => callsIn(call.body).length === 2);
      expect(nextLevel).toHaveLength(1);
      expect(nextLevel[0].body.force).toBe(true);
      expect(callsIn(nextLevel[0].body)).toEqual([['s2'], ['s2-step']]);
      await act(async () => nextLevel[0].resolve(actions(['s2'])));
      expect(result.current.areas.get(areaKey(['s2', 's2-step']))?.state).toBe(
        'loaded',
      );
    } finally {
      jest.restoreAllMocks();
    }
  },
);

const actionLevel: TreeLevel = {
  ...step,
  key: 'action',
  id_column: 'action_id',
  parent_column: 'step_id',
  children_shown: 1,
};
const actionAnswer = (ids: string[], total = 1): TreeTableQueryResult[] => [
  {
    data: ids.map(id => ({
      session_id: 's1',
      step_id: id,
      action_id: `${id}-action`,
    })),
    colnames: ['session_id', 'step_id', 'action_id'],
    coltypes: [],
    rowcount: ids.length,
    sql_rowcount: ids.length,
  },
  {
    data: ids.map(id => ({
      session_id: 's1',
      step_id: id,
      'COUNT_DISTINCT(action_id)': total,
    })),
    colnames: ['session_id', 'step_id', 'COUNT_DISTINCT(action_id)'],
    coltypes: [],
    rowcount: ids.length,
    sql_rowcount: ids.length,
  },
];
const stepPage = (ids: string[], total: number): TreeTableQueryResult[] => [
  {
    data: ids.map(id => ({ session_id: 's1', step_id: id, step: id })),
    colnames: ['session_id', 'step_id', 'step'],
    coltypes: [],
    rowcount: ids.length,
    sql_rowcount: total,
  },
  {
    data: [{ session_id: 's1', 'COUNT_DISTINCT(step_id)': total }],
    colnames: ['session_id', 'COUNT_DISTINCT(step_id)'],
    coltypes: [],
    rowcount: 1,
    sql_rowcount: 1,
  },
];

test('a new batch resends open verification paths when parent Load more adds a row', async () => {
  const replies = controlledTransport();
  const props = params({
    formData: {
      ...formData,
      levels: [session, { ...step, children_shown: 2 }, actionLevel],
    },
    pageKeys: ['s1'],
    expanded: new Set(['s1']),
    expandLevel: 3,
  });
  const { result } = renderHook(useChildren, { initialProps: props });
  act(() => result.current.open(['s1']));
  await act(async () => replies[0].resolve(stepPage(['a', 'b'], 3)));
  await act(async () => replies[1].resolve(actionAnswer(['a'])));
  expect(replies).toHaveLength(3);
  act(() => result.current.loadMore(['s1']));
  await act(async () => replies[3].resolve(stepPage(['c'], 3)));
  expect(replies[2].signal?.aborted).toBe(true);
  expect(replies[4].body.queries[0].filters).toContainEqual({
    col: 'step_id',
    op: 'IN',
    val: ['c', 'b'],
  });
  await act(async () => replies[2].resolve(actionAnswer(['b'])));
  await act(async () => replies[4].resolve(actionAnswer(['b', 'c'])));
  expect(result.current.entries.get(areaKey(['s1', 'b']))?.status).toBe(
    'loaded',
  );
  expect(result.current.areas.get(areaKey(['s1', 'b']))?.state).toBe('loaded');
  expect(result.current.areas.get(areaKey(['s1', 'c']))?.state).toBe('loaded');
});

test('a new batch leaves another path Load more in flight', async () => {
  const replies = controlledTransport();
  const props = params({
    formData: {
      ...formData,
      levels: [session, { ...step, children_shown: 2 }, actionLevel],
    },
    pageKeys: ['s1'],
    expanded: new Set(['s1']),
    expandLevel: 3,
  });
  const { result } = renderHook(useChildren, { initialProps: props });
  act(() => result.current.open(['s1']));
  await act(async () => replies[0].resolve(stepPage(['a', 'b'], 5)));
  // Start from a complete answer so a has a real Load more button (1 of 2).
  const initial = actionAnswer(['a', 'b']);
  initial[1].data[0]['COUNT_DISTINCT(action_id)'] = 2;
  initial[0].sql_rowcount = 3;
  await act(async () => replies[1].resolve(initial));
  act(() => result.current.loadMore(['s1', 'a']));
  act(() => result.current.loadMore(['s1']));
  await act(async () => replies[3].resolve(stepPage(['c', 'd'], 5)));
  // The new rows' answer starts verification of d while a still loads more.
  await act(async () => replies[4].resolve(actionAnswer(['c'])));
  expect(replies).toHaveLength(6);
  // A new peer batch at the same level supersedes that round.
  act(() => result.current.loadMore(['s1']));
  await act(async () => replies[6].resolve(stepPage(['e'], 5)));
  expect(replies[2].signal?.aborted).toBe(false);
  expect(replies[5].signal?.aborted).toBe(true);
  await act(async () => replies[2].resolve(actionAnswer(['a'])));
  await act(async () => replies[7].resolve(actionAnswer(['d', 'e'])));
  expect(result.current.entries.get(areaKey(['s1', 'a']))?.more).not.toBe(
    'loading',
  );
  expect(result.current.entries.get(areaKey(['s1', 'a']))?.rows).toHaveLength(
    2,
  );
});

test('an interrupted closed verification path is marked failed and retried on open', async () => {
  const replies = controlledTransport();
  const props = params({
    formData: {
      ...formData,
      levels: [session, { ...step, children_shown: 2 }, actionLevel],
    },
    pageKeys: ['s1'],
    expanded: new Set(['s1']),
    expandLevel: 3,
  });
  const { result, rerender } = renderHook(useChildren, { initialProps: props });
  act(() => result.current.open(['s1']));
  await act(async () => replies[0].resolve(stepPage(['a', 'b'], 3)));
  await act(async () => replies[1].resolve(actionAnswer(['a'])));
  // The expansion prop closes the area before a new batch interrupts its check.
  rerender({ ...props, childToggled: new Set([areaKey(['s1', 'b'])]) });
  act(() => result.current.loadMore(['s1']));
  await act(async () => replies[3].resolve(stepPage(['c'], 3)));
  expect(replies[2].signal?.aborted).toBe(true);
  expect(result.current.entries.has(areaKey(['s1', 'b']))).toBe(false);
  await act(async () => replies[4].resolve(actionAnswer(['c'])));
  act(() => result.current.open(['s1', 'b']));
  expect(replies).toHaveLength(6);
  expect(replies[5].body.queries[0].filters).toContainEqual({
    col: 'step_id',
    op: 'IN',
    val: ['b'],
  });
});

const refreshRoundProps = () =>
  params({
    formData: { ...formData, levels: [session, step, actionLevel] },
    pageKeys: ['k', 'z'],
    expanded: new Set(['k']),
    childToggled: new Set(['k1', 'k3'].map(id => areaKey(['k', id]))),
  });
const refreshSteps = (): TreeTableQueryResult[] => {
  const answer = stepPage(['k1', 'k2', 'k3', 'k4'], 4);
  answer[0].data.forEach(row => {
    row.session_id = 'k';
  });
  answer[0].data.push({ session_id: 'z', step_id: 'z1', step: 'z1' });
  answer[0].sql_rowcount = 50;
  answer[1].data[0].session_id = 'k';
  answer[1].data.push({ session_id: 'z', 'COUNT_DISTINCT(step_id)': 1 });
  return answer;
};
const refreshActions = (ids: string[], complete = false) => {
  const answer = actionAnswer(ids);
  answer.forEach(query =>
    query.data.forEach(row => {
      row.session_id = 'k';
    }),
  );
  if (complete) answer[0].sql_rowcount = 50;
  return answer;
};

async function overlappingRefreshRounds(): Promise<void> {
  const replies = controlledTransport();
  const props = refreshRoundProps();
  const { result, rerender, unmount } = renderHook(useChildren, {
    initialProps: props,
  });
  act(() => result.current.open(['k']));
  await act(async () => replies[0].resolve(refreshSteps()));
  await act(async () => replies[1].resolve(refreshActions(['k1', 'k3'], true)));
  const refreshed = { ...props, data: [...data] };
  rerender(refreshed);
  await act(async () => replies[2].resolve(refreshSteps()));
  expect(callsIn(replies[3].body)).toEqual([['k'], ['k1', 'k3']]);
  act(() => result.current.open(['k', 'k2']));
  const opened = {
    ...refreshed,
    childToggled: new Set([...props.childToggled!, areaKey(['k', 'k2'])]),
  };
  rerender(opened);
  expect(callsIn(replies[4].body)).toEqual([['k'], ['k2', 'k4']]);
  await act(async () => replies[3].resolve(refreshActions(['k1'])));
  await act(async () => replies[4].resolve(refreshActions(['k4'])));
  expect(callsIn(replies[5].body)).toEqual([['k'], ['k3']]);
  expect(callsIn(replies[6].body)).toEqual([['k'], ['k2']]);
  await act(async () => replies[5].resolve(refreshActions(['k3'])));
  await act(async () => replies[6].resolve(refreshActions(['k2'])));
  expect(replies).toHaveLength(7);
  rerender({
    ...opened,
    expanded: new Set(['k', 'z']),
    childToggled: new Set([...opened.childToggled, areaKey(['z', 'z1'])]),
  });
  expect(replies).toHaveLength(8);
  expect(callsIn(replies[7].body)).toEqual([['z'], ['z1']]);
  const answer = actionAnswer(['z1']);
  answer.forEach(query =>
    query.data.forEach(row => {
      row.session_id = 'z';
    }),
  );
  await act(async () => replies[7].resolve(answer));
  expect(result.current.areas.get(areaKey(['z', 'z1']))?.state).toBe('loaded');
  expect(replies).toHaveLength(8);
  unmount();
}

test(
  'overlapping verification rounds let refresh finish and later opened rows load',
  overlappingRefreshRounds,
);

test('refresh hand-over waits for the replacement once and survives overlapping rounds', async () => {
  SupersetClient.configure({ fetchRetryOptions: { retries: 0 } });
  const replies = controlledTransport();
  const props = refreshRoundProps();
  const { result, rerender, unmount } = renderHook(useChildren, {
    initialProps: props,
  });
  act(() => result.current.open(['k']));
  await act(async () => replies[0].resolve(refreshSteps()));
  await act(async () => replies[1].resolve(refreshActions(['k1', 'k3'], true)));
  const refreshed = { ...props, data: [...data] };
  rerender(refreshed);
  await act(async () => replies[2].resolve(refreshSteps()));
  await act(async () => replies[3].resolve(refreshActions(['k1'])));
  expect(replies).toHaveLength(5);
  act(() => result.current.open(['k', 'k2']));
  const opened = {
    ...refreshed,
    childToggled: new Set([...props.childToggled!, areaKey(['k', 'k2'])]),
  };
  rerender(opened);
  expect(replies[4].signal?.aborted).toBe(true);
  expect(callsIn(replies[5].body)).toEqual([['k'], ['k2', 'k4', 'k3']]);
  await act(async () => replies[4].resolve(refreshActions(['k3'])));
  expect(replies).toHaveLength(6);
  expect(result.current.areas.get(areaKey(['k', 'k3']))?.state).toBe('loading');
  await act(async () =>
    replies[5].resolve(refreshActions(['k2', 'k4', 'k3'], true)),
  );
  expect(replies).toHaveLength(6);
  rerender({
    ...opened,
    expanded: new Set(['k', 'z']),
    childToggled: new Set([...opened.childToggled, areaKey(['z', 'z1'])]),
  });
  expect(replies).toHaveLength(7);
  expect(callsIn(replies[6].body)).toEqual([['z'], ['z1']]);
  const answer = actionAnswer(['z1']);
  answer.forEach(query =>
    query.data.forEach(row => {
      row.session_id = 'z';
    }),
  );
  await act(async () => replies[6].resolve(answer));
  expect(result.current.areas.get(areaKey(['z', 'z1']))?.state).toBe('loaded');
  expect(replies).toHaveLength(7);
  unmount();
  jest.restoreAllMocks();
  await overlappingRefreshRounds();
});

test.each([true, false])(
  'Expand all settles a reopened batch path (ambiguous: %s)',
  async ambiguous => {
    const replies = controlledTransport();
    const props = params({
      formData: {
        ...formData,
        levels: [session, { ...step, children_shown: 2 }, actionLevel],
      },
      pageKeys: ['s1'],
      expanded: new Set(['s1']),
      childToggled: new Set<string>(),
    });
    const { result, rerender } = renderHook(useChildren, {
      initialProps: props,
    });
    act(() => result.current.open(['s1']));
    await act(async () => replies[0].resolve(stepPage(['a', 'b'], 50)));
    const a = areaKey(['s1', 'a']);
    const b = areaKey(['s1', 'b']);
    act(() => {
      result.current.open(['s1', 'a']);
      rerender({ ...props, childToggled: new Set([a]) });
    });
    expect(callsIn(replies[1].body)).toEqual([['s1'], ['a', 'b']]);
    act(() => {
      result.current.open(['s1', 'b']);
      rerender({ ...props, childToggled: new Set([a, b]) });
    });
    act(() => {
      result.current.close(['s1', 'b']);
      rerender({ ...props, childToggled: new Set([a]) });
    });
    act(() => {
      result.current.expandAll(3, ['s1'], ['a', 'b']);
      rerender({ ...props, expandLevel: 3 });
    });
    await act(async () =>
      replies[1].resolve(actionAnswer(ambiguous ? ['a'] : ['a', 'b'])),
    );
    expect(replies).toHaveLength(ambiguous ? 3 : 2);
    expect(replies[2] && callsIn(replies[2].body)).toEqual(
      ambiguous ? [['s1'], ['b']] : undefined,
    );
    if (ambiguous) {
      await act(async () => replies[2].resolve(actionAnswer(['b'])));
    }
    expect({
      area: result.current.areas.get(b)?.state,
      entry: result.current.entries.get(b)?.status,
      replies: replies.length,
      loading: loadingAreas(result),
      errors: errorAreas(result),
    }).toEqual({
      area: 'loaded',
      entry: 'loaded',
      replies: ambiguous ? 3 : 2,
      loading: [],
      errors: [],
    });
  },
);

const actionsUnder = (ids: string[]) => {
  const answer = actionAnswer(ids);
  answer.forEach(query =>
    query.data.forEach(row => {
      row.session_id = String(row.step_id).startsWith('z') ? 'z' : 'k';
    }),
  );
  return answer;
};

async function refreshing(
  extra: Partial<UseChildrenParams> = {},
  change: Partial<UseChildrenParams> = {},
) {
  const replies = controlledTransport(true);
  const props = { ...refreshRoundProps(), ...extra };
  const { result, rerender } = renderHook(useChildren, {
    initialProps: props,
  });
  act(() => result.current.open(['k']));
  await act(async () => replies[0].resolve(refreshSteps()));
  await act(async () => replies[1].resolve(refreshActions(['k1', 'k3'], true)));
  const refreshed = { ...props, ...change, data: [...data] };
  rerender(refreshed);
  expect(callsIn(replies[2].body)).toEqual([['k', 'z']]);
  const openZ = () =>
    rerender({
      ...refreshed,
      expanded: new Set(['k', 'z']),
      childToggled: new Set([...props.childToggled!, areaKey(['z', 'z1'])]),
    });
  const loadZ = async (index: number) => {
    expect(callsIn(replies[index].body)).toEqual([
      ['k', 'z'],
      ['k2', 'k4', 'z1'],
    ]);
    await act(async () =>
      replies[index].resolve(actionsUnder(['k2', 'k4', 'z1'])),
    );
    expect(result.current.areas.get(areaKey(['z', 'z1']))?.state).toBe(
      'loaded',
    );
  };
  return { replies, result, rerender, refreshed, openZ, loadZ };
}

test('reopening a child skipped during refresh fetches fresh rows', async () => {
  const { replies, result, rerender, refreshed } = await refreshing();
  const path = ['k', 'k1'];
  const key = areaKey(path);
  const childToggled = new Set(refreshed.childToggled);
  childToggled.delete(key);
  act(() => {
    result.current.close(path);
    rerender({ ...refreshed, childToggled });
  });
  await act(async () => replies[2].resolve(refreshSteps()));
  expect(callsIn(replies[3].body)).toEqual([['k'], ['k3']]);
  await act(async () => replies[3].resolve(refreshActions(['k3'], true)));
  act(() => {
    result.current.open(path);
    rerender(refreshed);
  });
  expect(replies).toHaveLength(5);
  expect(callsIn(replies[4].body)).toEqual([['k'], ['k1', 'k2', 'k4']]);
  await act(async () =>
    replies[4].resolve(refreshActions(['k1', 'k2', 'k4'], true)),
  );
  expect(result.current.areas.get(key)?.state).toBe('loaded');
});

const sortActions = (
  result: { current: ReturnType<typeof useChildren> },
  ascending = false,
) =>
  act(() => result.current.setSort(2, ['action_id', ascending], ['k', 'k1']));

test('sort during refresh: a sort at the refresh level takes over its step with force, and the refresh finishes', async () => {
  const { replies, result, openZ, loadZ } = await refreshing();
  await act(async () => replies[2].resolve(refreshSteps()));
  expect(callsIn(replies[3].body)).toEqual([['k'], ['k1', 'k3']]);
  sortActions(result);
  expect(replies[3].signal?.aborted).toBe(true);
  expect(replies).toHaveLength(5);
  expect(callsIn(replies[4].body)).toEqual([['k'], ['k1', 'k3']]);
  expect(replies[4].body.force).toBe(true);
  await act(async () => replies[4].resolve(refreshActions(['k1', 'k3'], true)));
  expect(replies).toHaveLength(5);
  openZ();
  expect(replies).toHaveLength(6);
  expect(replies[5].body.force).toBe(false);
  await loadZ(5);
  expect(replies).toHaveLength(6);
  expect(loadingAreas(result)).toEqual([]);
});

async function sortStepsDuringRefresh(extra: Partial<UseChildrenParams> = {}) {
  const run = await refreshing(extra);
  const { replies, result } = run;
  act(() => result.current.setSort(1, ['step', false], ['k']));
  expect(replies[2].signal?.aborted).toBe(true);
  expect(callsIn(replies[3].body)).toEqual([['k', 'z']]);
  expect(replies[3].body.force).toBe(true);
  await act(async () => replies[3].resolve(refreshSteps()));
  expect(replies).toHaveLength(5);
  expect(callsIn(replies[4].body)).toEqual([['k'], ['k1', 'k3']]);
  expect(replies[4].body.force).toBe(true);
  await act(async () => replies[4].resolve(refreshActions(['k1', 'k3'], true)));
  expect(replies).toHaveLength(5);
  return run;
}

test('sort during refresh: a level-1 sort during the level-1 step sends one level-2 refresh batch after its answer', async () => {
  const { result } = await sortStepsDuringRefresh();
  expect(result.current.areas.get(areaKey(['k', 'k1']))?.state).toBe('loaded');
  expect(loadingAreas(result)).toEqual([]);
});

test('sort during refresh: Expand all after a level-1 sort during the refresh loads every opened row', async () => {
  const { replies, result, rerender, refreshed } =
    await sortStepsDuringRefresh();
  act(() => {
    result.current.expandAll(
      3,
      ['k', 'z'],
      ['k1', 'k2', 'k3', 'k4'].map(id => areaKey(['k', id])),
    );
    rerender({
      ...refreshed,
      expanded: new Set(['k', 'z']),
      childToggled: new Set(),
      expandLevel: 3,
    });
  });
  expect(replies).toHaveLength(6);
  expect(callsIn(replies[5].body)).toEqual([
    ['k', 'z'],
    ['k2', 'k4', 'z1'],
  ]);
  await act(async () => replies[5].resolve(actionsUnder(['k2', 'k4', 'z1'])));
  expect({
    k2: result.current.areas.get(areaKey(['k', 'k2']))?.state,
    z1: result.current.areas.get(areaKey(['z', 'z1']))?.state,
    loading: loadingAreas(result),
    replies: replies.length,
    errors: errorAreas(result),
  }).toEqual({
    k2: 'loaded',
    z1: 'loaded',
    loading: [],
    replies: 6,
    errors: [],
  });
});

test('sort during refresh: a sort during a refresh verification round re-sends the checked path and the refresh moves on once', async () => {
  const { replies, result, openZ, loadZ } = await refreshing();
  await act(async () => replies[2].resolve(refreshSteps()));
  await act(async () => replies[3].resolve(refreshActions(['k1'])));
  expect(replies).toHaveLength(5);
  expect(callsIn(replies[4].body)).toEqual([['k'], ['k3']]);
  sortActions(result);
  expect(replies[4].signal?.aborted).toBe(true);
  expect(replies).toHaveLength(6);
  expect(callsIn(replies[5].body)).toEqual([['k'], ['k1', 'k3']]);
  expect(replies[5].body.force).toBe(true);
  await act(async () => replies[5].resolve(refreshActions(['k1', 'k3'], true)));
  expect(replies).toHaveLength(6);
  openZ();
  expect(replies).toHaveLength(7);
  await loadZ(6);
  expect(replies).toHaveLength(7);
  expect(loadingAreas(result)).toEqual([]);
});

test('sort during refresh: a filter-change run sorts with force false and still moves on; with no run the sort sends force false', async () => {
  const filtered = {
    ...refreshRoundProps().formData,
    extra_form_data: { time_range: 'Last week' },
  };
  const { replies, result, openZ, loadZ } = await refreshing(
    {},
    { formData: filtered },
  );
  expect(replies[2].body.force).toBe(false);
  await act(async () => replies[2].resolve(refreshSteps()));
  sortActions(result);
  expect(replies).toHaveLength(5);
  expect(callsIn(replies[4].body)).toEqual([['k'], ['k1', 'k3']]);
  expect(replies[4].body.force).toBe(false);
  await act(async () => replies[4].resolve(refreshActions(['k1', 'k3'], true)));
  openZ();
  expect(replies).toHaveLength(6);
  await loadZ(5);
  sortActions(result, true);
  expect(replies).toHaveLength(7);
  expect(callsIn(replies[6].body)).toEqual([
    ['k', 'z'],
    ['k1', 'k3', 'k2', 'k4', 'z1'],
  ]);
  expect(replies[6].body.force).toBe(false);
});

test('sort during refresh: a failed sort batch marks its open rows error and the refresh still moves on', async () => {
  const { replies, result, openZ, loadZ } = await refreshing();
  await act(async () => replies[2].resolve(refreshSteps()));
  sortActions(result);
  expect(replies).toHaveLength(5);
  await act(async () => replies[4].reject(new Error('Query failed')));
  expect(result.current.areas.get(areaKey(['k', 'k1']))?.state).toBe('error');
  expect(result.current.areas.get(areaKey(['k', 'k3']))?.state).toBe('error');
  openZ();
  expect(replies).toHaveLength(6);
  await loadZ(5);
  expect(loadingAreas(result)).toEqual([]);
});

test('sort during refresh: a sort before the next refresh step is sent becomes that step, with one request', async () => {
  const { replies, result, openZ, loadZ } = await refreshing();
  await act(async () => {
    replies[2].resolve(refreshSteps());
    await jest.advanceTimersByTimeAsync(0);
    result.current.setSort(2, ['action_id', false], ['k', 'k1']);
  });
  expect(replies).toHaveLength(4);
  expect(callsIn(replies[3].body)).toEqual([['k'], ['k1', 'k3']]);
  expect(replies[3].body.force).toBe(true);
  await act(async () => replies[3].resolve(refreshActions(['k1', 'k3'], true)));
  expect(replies).toHaveLength(4);
  openZ();
  expect(replies).toHaveLength(5);
  await loadZ(4);
  expect(replies).toHaveLength(5);
});

test('sort during refresh: two sorts in a row at the refresh level leave one owner of the step', async () => {
  const { replies, result, openZ, loadZ } = await refreshing();
  await act(async () => replies[2].resolve(refreshSteps()));
  sortActions(result);
  sortActions(result, true);
  expect(replies).toHaveLength(6);
  expect(replies[4].signal?.aborted).toBe(true);
  expect(callsIn(replies[5].body)).toEqual([['k'], ['k1', 'k3']]);
  expect(replies[5].body.force).toBe(true);
  await act(async () => replies[5].resolve(refreshActions(['k1', 'k3'], true)));
  openZ();
  expect(replies).toHaveLength(7);
  await loadZ(6);
});

test('sort during refresh: an ambiguous sort answer checks with force and the refresh moves on after the check', async () => {
  const { replies, result, openZ, loadZ } = await refreshing();
  await act(async () => replies[2].resolve(refreshSteps()));
  sortActions(result);
  await act(async () => replies[4].resolve(refreshActions(['k1'])));
  expect(replies).toHaveLength(6);
  expect(callsIn(replies[5].body)).toEqual([['k'], ['k3']]);
  expect(replies[5].body.force).toBe(true);
  openZ();
  expect(replies).toHaveLength(6);
  await act(async () => replies[5].resolve(refreshActions(['k3'])));
  expect(replies).toHaveLength(7);
  await loadZ(6);
  expect(loadingAreas(result)).toEqual([]);
});

test('sort during refresh: a sort deeper than the refresh level lets the refresh finish', async () => {
  const { replies, result, openZ, loadZ } = await refreshing();
  sortActions(result);
  expect(replies).toHaveLength(4);
  expect(callsIn(replies[3].body)).toEqual([['k'], ['k1', 'k3']]);
  expect(replies[3].body.force).toBe(false);
  await act(async () => replies[2].resolve(refreshSteps()));
  expect(replies).toHaveLength(5);
  expect(callsIn(replies[4].body)).toEqual([['k'], ['k1', 'k3']]);
  expect(replies[4].body.force).toBe(true);
  await act(async () => replies[3].resolve(refreshActions(['k1', 'k3'], true)));
  await act(async () => replies[4].resolve(refreshActions(['k1', 'k3'], true)));
  openZ();
  expect(replies).toHaveLength(6);
  await loadZ(5);
  expect(loadingAreas(result)).toEqual([]);
});

test('sort during refresh: a sort shallower than the refresh level lets the refresh finish', async () => {
  const { replies, result, openZ, loadZ } = await refreshing();
  await act(async () => replies[2].resolve(refreshSteps()));
  act(() => result.current.setSort(1, ['step', false], ['k']));
  expect(replies[3].signal?.aborted).toBe(false);
  expect(replies).toHaveLength(5);
  expect(callsIn(replies[4].body)).toEqual([['k', 'z']]);
  expect(replies[4].body.force).toBe(false);
  await act(async () => replies[3].resolve(refreshActions(['k1', 'k3'], true)));
  await act(async () => replies[4].resolve(refreshSteps()));
  openZ();
  expect(replies).toHaveLength(6);
  await loadZ(5);
  expect(loadingAreas(result)).toEqual([]);
});

const detailLevel: TreeLevel = {
  ...step,
  key: 'detail',
  id_column: 'detail_id',
  parent_column: 'action_id',
  children_shown: 1,
};
const detailAnswer = (ids: string[]): TreeTableQueryResult[] => [
  {
    data: ids.map(id => ({
      session_id: 's1',
      step_id: id,
      action_id: `${id}-action`,
      detail_id: `${id}-detail`,
    })),
    colnames: ['session_id', 'step_id', 'action_id', 'detail_id'],
    coltypes: [],
    rowcount: ids.length,
    sql_rowcount: ids.length,
  },
  {
    data: ids.map(id => ({
      session_id: 's1',
      step_id: id,
      action_id: `${id}-action`,
      'COUNT_DISTINCT(detail_id)': 1,
    })),
    colnames: [
      'session_id',
      'step_id',
      'action_id',
      'COUNT_DISTINCT(detail_id)',
    ],
    coltypes: [],
    rowcount: ids.length,
    sql_rowcount: ids.length,
  },
];

test('sort with no refresh running: a sort during an Expand all round keeps its two next-level batches', async () => {
  const replies = controlledTransport(true);
  const props = params({
    formData: {
      ...formData,
      levels: [
        session,
        { ...step, children_shown: 3 },
        actionLevel,
        detailLevel,
      ],
    },
    pageKeys: ['s1'],
    expanded: new Set(['s1']),
    childToggled: new Set<string>(),
  });
  const { result, rerender } = renderHook(useChildren, {
    initialProps: props,
  });
  act(() => result.current.open(['s1']));
  await act(async () => replies[0].resolve(stepPage(['a', 'b', 'c'], 3)));
  act(() => {
    result.current.expandAll(
      4,
      ['s1'],
      ['a', 'b', 'c'].map(id => areaKey(['s1', id])),
    );
    rerender({ ...props, expandLevel: 4 });
  });
  expect(callsIn(replies[1].body)).toEqual([['s1'], ['a', 'b', 'c']]);
  await act(async () => replies[1].resolve(actionAnswer(['a'])));
  expect(replies.slice(2).map(call => callsIn(call.body))).toEqual([
    [['s1'], ['b']],
    [['s1'], ['c']],
  ]);
  act(() => result.current.setSort(2, ['action_id', false], ['s1', 'a']));
  expect(replies.map(call => call.signal?.aborted)).toEqual([
    false,
    true,
    true,
    true,
    false,
    false,
  ]);
  expect(replies.slice(4).map(call => callsIn(call.body))).toEqual([
    [['s1'], ['a', 'b', 'c']],
    [['s1'], ['a'], ['a-action']],
  ]);
  await act(async () => replies[4].resolve(actionAnswer(['a', 'b', 'c'])));
  expect(replies).toHaveLength(7);
  expect(callsIn(replies[6].body)).toEqual([
    ['s1'],
    ['b', 'c'],
    ['b-action', 'c-action'],
  ]);
  expect(replies.every(call => !call.body.force)).toBe(true);
  await act(async () => replies[5].resolve(detailAnswer(['a'])));
  await act(async () => replies[6].resolve(detailAnswer(['b', 'c'])));
  expect({
    replies: replies.length,
    loading: loadingAreas(result),
    errors: errorAreas(result),
  }).toEqual({ replies: 7, loading: [], errors: [] });
});
