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
import { getMetricLabel, QueryFormData, VizType } from '@superset-ui/core';
import buildChildrenQuery, { CHILD_ROW_LIMIT } from './buildChildrenQuery';
import fetchChildren from './fetchChildren';
import { retainedTableControls } from '../../test/treeModeFixtures';
import fetchTreeTableData, {
  FetchTreeTableDataParams,
} from './fetchTreeTableData';
import { countMetric } from './levelsToMirrors';
import { toEntries } from './childrenState';
import { TreeTableFormData, TreeLevel } from './types';

jest.mock('./fetchTreeTableData');
const fetchData = jest.mocked(fetchTreeTableData);
const levels: TreeLevel[] = [
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
    children_shown: 100,
  },
];
const formData: TreeTableFormData = {
  ...retainedTableControls,
  datasource: '1__table',
  viz_type: VizType.TableAgGrid,
  query_mode: 'tree',
  levels,
};

beforeEach(() => fetchData.mockReset());

test.each([1, 2, 3])(
  '50 parent paths at child level %s share one count and one row request',
  async depth => {
    const hierarchy = Array.from({ length: depth + 1 }, (_, index) => ({
      ...levels[1],
      key: `level-${index}`,
      id_column: `id_${index}`,
      parent_column: index ? `id_${index - 1}` : undefined,
      columns: [`id_${index}`],
    }));
    const paths = Array.from({ length: 50 }, (_, index) =>
      depth === 1
        ? [`p${index}`]
        : depth === 2
          ? [`p${index}`, `c${index}`]
          : [`p${index}`, 'middle', `c${index}`],
    );
    const combinations =
      depth === 1
        ? paths
        : paths.flatMap(path =>
            paths.map(other => [...path.slice(0, -1), other[depth - 1]]),
          );
    const label = getMetricLabel(countMetric(hierarchy[depth]));
    const countRows = combinations.map(path => ({
      ...Object.fromEntries(path.map((value, index) => [`id_${index}`, value])),
      [label]: 1,
    }));
    fetchData.mockImplementation(async params => {
      const { queries } = params.buildQuery(params.formData);
      return queries.map(query => {
        const selected = countRows.filter(row =>
          (query.filters ?? []).every(
            filter =>
              filter.op !== 'IN' ||
              ('val' in filter &&
                (filter.val as string[]).includes(
                  String(row[String(filter.col)]),
                )),
          ),
        );
        const data = query.metrics?.length
          ? selected
          : selected
              .map((row, index) => ({
                ...row,
                [`id_${depth}`]: `leaf-${index}`,
              }))
              .slice(0, query.row_limit);
        return {
          data,
          colnames: [],
          coltypes: [],
          rowcount: data.length,
          sql_rowcount: data.length,
        };
      });
    });
    const request = { level: depth, paths };
    const form = { ...formData, levels: hierarchy };
    const result = await fetchChildren(
      {
        formData: form,
        buildQuery: fd =>
          buildChildrenQuery(fd as TreeTableFormData, {
            ownState: { treeTableChildren: request },
          }),
      },
      hierarchy,
      request,
    );
    expect(
      [...toEntries(result, request, hierarchy).values()].every(
        entry => entry.status === 'loaded',
      ),
    ).toBe(true);
    expect(fetchData).toHaveBeenCalledTimes(2);
    const rowQuery = fetchData.mock.calls[1][0].buildQuery(form).queries[0];
    expect(rowQuery.row_limit).toBe(combinations.length);
  },
);

test('counts isolate a huge parent while the small neighbours load in a bounded batch', async () => {
  const totals = new Map([
    ['huge', CHILD_ROW_LIMIT + 1],
    ['small', 2],
    ['tiny', 1],
    ['empty', 0],
  ]);
  const label = getMetricLabel(countMetric(levels[1]));
  const sent: ReturnType<typeof buildChildrenQuery>['queries'][] = [];
  fetchData.mockImplementation(async (params: FetchTreeTableDataParams) => {
    const { queries } = params.buildQuery(params.formData);
    sent.push(queries);
    return queries.map(query => {
      const filter = query.filters?.find(filter => filter.op === 'IN');
      const ids = filter && 'val' in filter ? (filter.val as string[]) : [];
      const counts = query.metrics?.length;
      const data = counts
        ? ids
            .filter(id => totals.get(id))
            .map(parent => ({ parent, [label]: totals.get(parent)! }))
        : ids
            .flatMap(parent =>
              Array.from({ length: totals.get(parent)! }, (_, index) => ({
                parent,
                child: `${parent}-${index}`,
              })),
            )
            .slice(0, query.row_limit);
      return {
        data,
        colnames: counts ? ['parent', label] : ['parent', 'child'],
        coltypes: [],
        sql_rowcount: data.length,
        rowcount: data.length,
      };
    });
  });
  const request = { level: 1, paths: [...totals.keys()].map(id => [id]) };
  const result = await fetchChildren(
    {
      formData,
      buildQuery: (fd: QueryFormData) =>
        buildChildrenQuery(fd as TreeTableFormData, {
          ownState: { treeTableChildren: request },
        }),
      force: true,
      signal: new AbortController().signal,
    },
    levels,
    request,
  );
  const entries = toEntries(result, request, levels);
  expect([...entries.values()].map(entry => entry.status)).toEqual([
    'loaded',
    'loaded',
    'loaded',
    'empty',
  ]);
  expect(entries.get('["huge"]')?.rows).toHaveLength(100);
  expect(sent).toHaveLength(3);
  expect(sent[0][0].metrics).toEqual([countMetric(levels[1])]);
  expect(sent[2][0].row_limit).toBe(3);
  expect(sent.slice(1).flat()).toContainEqual(
    expect.objectContaining({ row_limit: 100, post_processing: [] }),
  );
  expect(
    fetchData.mock.calls.every(([params]) => params.force && params.signal),
  ).toBe(true);
});

test('zero-count paths need no row request', async () => {
  fetchData.mockResolvedValue([
    { data: [], colnames: [], coltypes: [], rowcount: 0, sql_rowcount: 0 },
  ]);
  const request = { level: 1, paths: [['empty-a'], ['empty-b']] };
  const result = await fetchChildren(
    {
      formData,
      buildQuery: fd =>
        buildChildrenQuery(fd as TreeTableFormData, {
          ownState: { treeTableChildren: request },
        }),
    },
    levels,
    request,
  );
  expect(fetchData).toHaveBeenCalledTimes(1);
  expect(
    [...toEntries(result, request, levels).values()].map(entry => entry.status),
  ).toEqual(['empty', 'empty']);
});

test('a failed row batch preserves the successful batches', async () => {
  fetchData.mockImplementation(async params => {
    const { queries } = params.buildQuery(params.formData);
    if (queries[0].metrics?.length)
      return [
        {
          data: ['a', 'b'].map(parent => ({
            parent,
            'COUNT_DISTINCT(child)': CHILD_ROW_LIMIT + 1,
          })),
          colnames: [],
          coltypes: [],
          rowcount: 2,
          sql_rowcount: 2,
        },
      ];
    const filter = queries[0].filters?.find(filter => filter.op === 'IN');
    const ids = filter && 'val' in filter ? (filter.val as string[]) : [];
    if (ids.includes('b')) throw new Error('batch failed');
    return [
      {
        data: [{ parent: 'a', child: 'a-1' }],
        colnames: ['parent', 'child'],
        coltypes: [],
        rowcount: 1,
        sql_rowcount: 1,
      },
    ];
  });
  const request = { level: 1, paths: [['a'], ['b']] };
  const result = await fetchChildren(
    {
      formData,
      buildQuery: fd =>
        buildChildrenQuery(fd as TreeTableFormData, {
          ownState: { treeTableChildren: request },
        }),
    },
    levels,
    request,
  );
  expect(result[0].data).toEqual([{ parent: 'a', child: 'a-1' }]);
  expect(result[1].data).toHaveLength(2);
  expect(fetchData).toHaveBeenCalledTimes(3);
});

test('a single parent keeps its combined limited rows and counts request', async () => {
  const answer = [
    { data: [], colnames: [], coltypes: [], rowcount: 0, sql_rowcount: 0 },
  ];
  fetchData.mockResolvedValue(answer);
  const request = { level: 1, paths: [['one']] };
  const params = {
    formData,
    buildQuery: (fd: TreeTableFormData) =>
      buildChildrenQuery(fd, { ownState: { treeTableChildren: request } }),
  };
  expect(await fetchChildren(params, levels, request)).toBe(answer);
  expect(fetchData).toHaveBeenCalledTimes(1);
  expect(fetchData).toHaveBeenCalledWith(params);
});

test('cancellation after counts starts no row requests', async () => {
  const controller = new AbortController();
  fetchData.mockImplementation(async () => {
    controller.abort();
    return [
      { data: [], colnames: [], coltypes: [], rowcount: 0, sql_rowcount: 0 },
    ];
  });
  const request = { level: 1, paths: [['one'], ['two']] };
  await expect(
    fetchChildren(
      {
        formData,
        buildQuery: (fd: QueryFormData) =>
          buildChildrenQuery(fd as TreeTableFormData, {
            ownState: { treeTableChildren: request },
          }),
        signal: controller.signal,
      },
      levels,
      request,
    ),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchData).toHaveBeenCalledTimes(1);
});
