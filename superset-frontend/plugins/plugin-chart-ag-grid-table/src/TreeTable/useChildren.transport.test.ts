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
import { act, renderHook } from '@testing-library/react';
import { DataRecord, DatasourceType, VizType } from '@superset-ui/core';
import useChildren, { areaKey, createChildTransport } from './useChildren';
import fetchTreeTableData from './fetchTreeTableData';
import { TreeTableFormData } from './types';

jest.mock('./fetchTreeTableData');
const fetchData = jest.mocked(fetchTreeTableData);
const formData: TreeTableFormData = {
  datasource: '1__table',
  viz_type: VizType.TableAgGrid,
  query_mode: 'tree',
  levels: [
    {
      key: 'parent',
      name: 'Parent',
      id_column: 'parent',
      columns: [],
      detail_fields: [],
    },
    {
      key: 'child',
      name: 'Child',
      id_column: 'child',
      parent_column: 'parent',
      columns: ['child'],
      detail_fields: [],
      children_shown: 2,
    },
  ],
};

beforeEach(() => fetchData.mockReset());

test('an omitted childless parent in a complete counts batch needs no repair', async () => {
  const keys = ['with-child', 'without-child'];
  fetchData.mockImplementation(async ({ buildQuery, formData: form }) =>
    buildQuery(form).queries.map(query => {
      const filter = query.filters?.find(clause => clause.op === 'IN');
      const includesChild =
        filter &&
        'val' in filter &&
        Array.isArray(filter.val) &&
        filter.val.includes(keys[0]);
      const row: DataRecord = query.metrics?.length
        ? { parent: keys[0], 'COUNT_DISTINCT(child)': 1 }
        : { parent: keys[0], child: 'child-row' };
      const data = includesChild ? [row] : [];
      return {
        data,
        colnames: [],
        coltypes: [],
        rowcount: data.length,
        sql_rowcount: data.length,
      };
    }),
  );
  const { result } = renderHook(() =>
    useChildren({
      formData,
      pageKeys: keys,
      expanded: new Set(keys),
      data: keys,
    }),
  );
  await act(async () => result.current.expandAll(1, keys, []));
  expect(fetchData).toHaveBeenCalledTimes(2);
  expect(result.current.entries.get(areaKey([keys[0]]))?.status).toBe('loaded');
  expect(result.current.entries.get(areaKey([keys[1]]))?.status).toBe('empty');
});

test('Expand all shares four request slots across parent chunks', async () => {
  const keys = Array.from({ length: 5001 }, (_, index) => String(index));
  let active = 0;
  let peak = 0;
  const releases: (() => void)[] = [];
  fetchData.mockImplementation(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise<void>(resolve => releases.push(resolve));
    active -= 1;
    return [
      { data: [], colnames: [], coltypes: [], rowcount: 0, sql_rowcount: 0 },
    ];
  });
  const { result } = renderHook(() =>
    useChildren({
      formData,
      pageKeys: keys,
      expanded: new Set(keys),
      data: keys,
    }),
  );
  act(() => result.current.expandAll(1, keys, []));
  expect(active).toBe(4);
  while (releases.length) {
    await act(async () => releases.splice(0).forEach(release => release()));
  }
  expect(peak).toBe(4);
  expect(fetchData).toHaveBeenCalledTimes(6);
  expect(result.current.entries.size).toBe(keys.length);
});

test('aborting a queued child request rejects before a slot opens', async () => {
  const pending: (() => void)[] = [];
  fetchData.mockImplementation(
    () => new Promise(resolve => pending.push(() => resolve([]))),
  );
  const transport = createChildTransport();
  const params = {
    formData,
    buildQuery: () => ({
      datasource: { id: 1, type: DatasourceType.Table },
      force: false,
      result_type: 'results',
      result_format: 'json',
      queries: [],
    }),
  };
  const running = Array.from({ length: 4 }, () => transport(params));
  const controller = new AbortController();
  const rejected = jest.fn();
  const queued = transport({ ...params, signal: controller.signal }).catch(
    rejected,
  );
  controller.abort();
  await Promise.resolve();
  const rejectedWhileBusy = rejected.mock.calls.slice();
  pending.forEach(release => release());
  await Promise.all([...running, queued]);
  expect(rejectedWhileBusy).toEqual([
    [expect.objectContaining({ name: 'AbortError' })],
  ]);
  expect(fetchData).toHaveBeenCalledTimes(4);
});

test.each([3, 100000])(
  'huge and small neighbours load through real batches with server cap %s',
  async serverCap => {
    const totals = new Map([
      ['huge', 100001],
      ['small', 2],
      ['tiny', 2],
    ]);
    fetchData.mockImplementation(async params => {
      const { queries } = params.buildQuery(params.formData);
      return queries.map(query => {
        const filter = query.filters?.find(filter => filter.op === 'IN');
        const ids = filter && 'val' in filter ? (filter.val as string[]) : [];
        const values = query.metrics?.length
          ? ids.map(parent => ({
              parent,
              'COUNT_DISTINCT(child)': totals.get(parent)!,
            }))
          : ids.flatMap(parent =>
              Array.from(
                { length: Math.min(totals.get(parent)!, 2) },
                (_, index) => ({ parent, child: `${parent}-${index}` }),
              ),
            );
        const data = values.slice(
          0,
          Math.min(query.row_limit ?? serverCap, serverCap),
        );
        return {
          data,
          colnames: ['parent', 'child'],
          coltypes: [],
          rowcount: data.length,
          sql_rowcount: data.length,
        };
      });
    });
    const keys = [...totals.keys()];
    const { result } = renderHook(() =>
      useChildren({
        formData,
        pageKeys: keys,
        expanded: new Set(keys),
        data: keys,
      }),
    );
    await act(async () => result.current.open(['huge']));
    expect(
      keys.map(key => result.current.entries.get(areaKey([key]))?.status),
    ).toEqual(['loaded', 'loaded', 'loaded']);
    expect(fetchData).toHaveBeenCalledTimes(serverCap === 3 ? 4 : 3);
    expect(
      keys.map(key => result.current.entries.get(areaKey([key]))?.rows.length),
    ).toEqual([2, 2, 2]);
    if (serverCap !== 3) return;
    const repair = fetchData.mock.calls[3][0].buildQuery(formData).queries;
    expect(repair).toHaveLength(2);
    expect(repair[0].filters).toContainEqual({
      col: 'parent',
      op: 'IN',
      val: ['tiny'],
    });
  },
);
