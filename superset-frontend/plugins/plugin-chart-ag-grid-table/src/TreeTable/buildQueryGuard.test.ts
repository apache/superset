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
import { VizType } from '@superset-ui/core';
import buildQuery from './buildQuery';
import levelsToMirrors, { sortableColumns } from './levelsToMirrors';
import { TreeLevel } from './types';

const session: TreeLevel = {
  key: 'session',
  name: 'Session',
  name_plural: 'Sessions',
  id_column: 'session_id',
  time_column: 'session_started_at',
  columns: ['channel', 'duration_ms', 'step_count', 'outcome'],
  detail_fields: ['channel_key', 'inbound_number'],
  sort: ['duration_ms', false],
};

const step: TreeLevel = {
  key: 'step',
  name: 'Step',
  id_column: 'step_id',
  parent_column: 'session_id',
  time_column: 'step_started_at',
  columns: ['item_desc', 'item_label', 'step', 'step_duration_ms'],
  detail_fields: ['result'],
  sort: ['step', true],
  children_shown: 100,
  apply_date_filter: false,
};

const action: TreeLevel = {
  key: 'action',
  name: 'Action',
  id_column: 'action_id',
  parent_column: 'step_id',
  columns: ['action_type'],
  detail_fields: ['action_payload'],
  children_shown: 50,
  apply_date_filter: true,
};

function freeze(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map(key => [key, item[key]]),
        )
      : item,
  );
}

test.each([
  [session, step],
  [session, step, action],
])('all real parent queries fit the saved mirrors (%s)', (...levels) => {
  const mirrors = levelsToMirrors(levels);
  for (const id of sortableColumns(session))
    for (const desc of [true, false])
      for (const search of [true, false])
        for (const currentPage of [0, 3])
          for (const pageSize of [10, 200]) {
            const { queries } = buildQuery(
              {
                datasource: '1__table',
                viz_type: VizType.TableAgGrid,
                query_mode: 'tree',
                levels,
                row_limit: 120,
              },
              {
                ownState: {
                  currentPage,
                  pageSize,
                  sortBy: [{ id, key: id, desc }],
                  ...(search
                    ? { searchColumn: 'session_id', searchText: 'abc' }
                    : {}),
                },
              },
            );
            for (const query of queries)
              for (const key of ['columns', 'metrics', 'orderby'] as const) {
                for (const value of query[key] ?? [])
                  expect(mirrors[`tree_${key}`].map(freeze)).toContain(
                    freeze(value),
                  );
              }
          }
});

const s4: TreeLevel[] = [
  {
    key: 'queue',
    name: 'Queue',
    id_column: 'queue',
    time_column: 'start_local',
    columns: [],
    detail_fields: [],
  },
  {
    key: 'agent',
    name: 'Agent',
    id_column: 'agent',
    parent_column: 'queue',
    columns: [],
    detail_fields: [],
    sort: ['agent', true],
  },
  {
    key: 'interaction',
    name: 'Interaction',
    id_column: 'interaction_id',
    parent_column: 'agent',
    columns: ['channel', 'segment_count'],
    detail_fields: ['source_phone'],
    sort: ['segment_count', false],
  },
  {
    key: 'segment',
    name: 'Segment',
    id_column: 'segment_id',
    parent_column: 'interaction_id',
    time_column: 'segment_start',
    columns: ['segment_no', 'segment_start'],
    detail_fields: ['disposition'],
    sort: ['segment_no', false],
    apply_date_filter: true,
  },
];

test.each([[session, step], [session, step, action], s4])(
  'the export query fits the saved mirrors (%s)',
  (...levels) => {
    const mirrors = levelsToMirrors(levels);
    const frozenMirrors = freeze(mirrors);
    for (const id of sortableColumns(levels[0]))
      for (const desc of [true, false])
        for (const result_format of ['csv', 'xlsx', 'json']) {
          const exported = buildQuery(
            {
              datasource: '1__table',
              viz_type: VizType.TableAgGrid,
              query_mode: 'tree',
              levels,
              row_limit: 120,
              time_range: 'Last week',
              result_format,
            },
            { ownState: { sortBy: [{ id, key: id, desc }] } },
          ).form_data?.tree_export;
          const { query } = exported;
          expect(query.metrics).toEqual([]);
          expect(query.orderby[0]).toEqual([id, !desc]);
          for (const key of ['columns', 'orderby'] as const)
            for (const value of query[key])
              expect(mirrors[`tree_${key}`].map(freeze)).toContain(
                freeze(value),
              );
        }
    expect(freeze(levelsToMirrors(levels))).toBe(frozenMirrors);
  },
);
