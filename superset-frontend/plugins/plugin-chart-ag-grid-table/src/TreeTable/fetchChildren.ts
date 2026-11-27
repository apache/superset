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
import { getMetricLabel } from '@superset-ui/core';
import fetchTreeTableData, {
  FetchTreeTableDataParams,
  TreeTableQueryResult,
} from './fetchTreeTableData';
import buildChildrenQuery, {
  CHILD_ROW_LIMIT,
  pathColumns,
} from './buildChildrenQuery';
import { countMetric } from './levelsToMirrors';
import { TreeTableChildRequest, TreeTableFormData, TreeLevel } from './types';

/** Fetch the initial children and their counts for a set of parent paths. */
export default async function fetchChildren(
  params: FetchTreeTableDataParams,
  levels: TreeLevel[],
  request: TreeTableChildRequest,
  fetchData = fetchTreeTableData,
) {
  if (request.paths.length === 1) return fetchData(params);
  const [counts] = await fetchData({
    ...params,
    buildQuery: (formData, options) => {
      const context = params.buildQuery(formData, options);
      return { ...context, queries: context.queries.slice(1) };
    },
  });
  if (params.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const links = pathColumns(levels, request.level);
  const label = getMetricLabel(countMetric(levels[request.level]));
  const totals = new Map(
    (counts?.data ?? []).map(row => [
      JSON.stringify(links.map(column => String(row[column]))),
      Number(row[label] ?? 0),
    ]),
  );
  const batches: string[][][] = [];
  const sizeOf = (paths: string[][]) => {
    const values = links.map(
      (_, index) => new Set(paths.map(path => path[index])),
    );
    return (counts?.data ?? []).reduce(
      (total, row) =>
        links.every((column, index) => values[index].has(String(row[column])))
          ? total + Number(row[label] ?? 0)
          : total,
      0,
    );
  };
  let batch: string[][] = [];
  request.paths.forEach(path => {
    const count = totals.get(JSON.stringify(path)) ?? 0;
    if (!count) return;
    if (batch.length && sizeOf([...batch, path]) >= CHILD_ROW_LIMIT) {
      batches.push(batch);
      batch = [];
    }
    if (count >= CHILD_ROW_LIMIT) batches.push([path]);
    else {
      batch.push(path);
    }
  });
  if (batch.length) batches.push(batch);
  let rows: TreeTableQueryResult = {
    data: [],
    colnames: [],
    coltypes: [],
    rowcount: 0,
    sql_rowcount: 0,
  };
  const fetchRows = async (paths: string[][]) => {
    if (params.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const [answer] = await fetchData({
        ...params,
        buildQuery: formData => {
          const context = buildChildrenQuery(formData as TreeTableFormData, {
            ownState: { treeTableChildren: { ...request, paths } },
          });
          return {
            ...context,
            queries: context.queries.slice(0, 1).map(query => ({
              ...query,
              row_limit:
                paths.length === 1
                  ? query.row_limit
                  : Math.max(1, sizeOf(paths)),
            })),
          };
        },
      });
      return answer;
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
      return undefined;
    }
  };
  for (let offset = 0; offset < batches.length; offset += 2) {
    const answers = await Promise.all(
      batches.slice(offset, offset + 2).map(fetchRows),
    );
    answers.forEach(answer => {
      if (answer) rows = { ...answer, data: [...rows.data, ...answer.data] };
    });
  }
  return Object.assign([rows, counts], { countsSeparate: true });
}
