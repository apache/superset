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
import buildChildrenQuery from './buildChildrenQuery';
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
  [session, { ...step, apply_date_filter: true }],
  [session, step, action],
])(
  'every children and Load more query fits the saved mirrors (%s)',
  (...levels) => {
    const mirrors = levelsToMirrors(levels);
    const sorts: ([string, boolean] | undefined)[] = [
      undefined,
      ...sortableColumns(step).flatMap(
        column =>
          [
            [column, true],
            [column, false],
          ] as [string, boolean][],
      ),
    ];
    for (const parentIds of [['s1', 's2', 's3'], ['s2']])
      for (const sort of sorts)
        for (const time_range of ['No filter', 'Last week']) {
          const { queries } = buildChildrenQuery(
            {
              datasource: '1__table',
              viz_type: VizType.TableAgGrid,
              query_mode: 'tree',
              levels,
              time_range,
            },
            {
              ownState: {
                treeTableChildren: {
                  level: 1,
                  paths: parentIds.map(key => [key]),
                  sort,
                },
              },
            },
          );
          const more = [100, 200].flatMap(
            offset =>
              buildChildrenQuery(
                {
                  datasource: '1__table',
                  viz_type: VizType.TableAgGrid,
                  query_mode: 'tree',
                  levels,
                  time_range,
                },
                {
                  ownState: {
                    treeTableChildren: {
                      level: 1,
                      paths: [['s2']],
                      sort,
                      offset,
                    },
                  },
                },
              ).queries,
          );
          expect(queries).toHaveLength(2);
          expect(more).toHaveLength(2);
          expect(more.map(query => query.row_offset)).toEqual([100, 200]);
          for (const query of [...queries, ...more])
            for (const key of ['columns', 'metrics', 'orderby'] as const) {
              expect(query[key]).toBeDefined();
              for (const value of query[key] ?? [])
                expect(mirrors[`tree_${key}`].map(freeze)).toContain(
                  freeze(value),
                );
            }
        }
  },
);

// The three- and four-level set-ups, as pasted in buildChildrenQuery.test.ts.
const S3: TreeLevel[] = [
  {
    key: 'channel',
    name: 'Channel',
    name_plural: 'Channels',
    id_column: 'channel',
    time_column: 'session_started_at',
    columns: [],
    detail_fields: [],
    sort: ['channel', true],
  },
  {
    key: 'session',
    name: 'Session',
    name_plural: 'Sessions',
    id_column: 'session_id',
    parent_column: 'channel',
    columns: ['duration_ms', 'step_count', 'outcome'],
    detail_fields: ['channel_key', 'inbound_number'],
    sort: ['duration_ms', false],
    children_shown: 100,
  },
  {
    key: 'step',
    name: 'Step',
    name_plural: 'Steps',
    id_column: 'step_id',
    parent_column: 'session_id',
    columns: ['item_desc', 'item_label', 'step', 'loop', 'step_duration_ms'],
    detail_fields: ['step_started_at', 'step_ended_at', 'result'],
    sort: ['step', true],
  },
];
const S4: TreeLevel[] = [
  {
    key: 'queue',
    name: 'Queue',
    name_plural: 'Queues',
    id_column: 'queue',
    time_column: 'start_local',
    columns: [],
    detail_fields: [],
    sort: ['queue', true],
  },
  {
    key: 'agent',
    name: 'Agent',
    name_plural: 'Agents',
    id_column: 'agent',
    parent_column: 'queue',
    columns: [],
    detail_fields: [],
    sort: ['agent', true],
  },
  {
    key: 'interaction',
    name: 'Interaction',
    name_plural: 'Interactions',
    id_column: 'interaction_id',
    parent_column: 'agent',
    columns: ['channel', 'segment_count'],
    detail_fields: ['source_phone', 'interaction_type'],
    sort: ['segment_count', false],
  },
  {
    key: 'segment',
    name: 'Segment',
    name_plural: 'Segments',
    id_column: 'segment_id',
    parent_column: 'interaction_id',
    columns: [
      'segment_no',
      'segment_start',
      'segment_end',
      'segment_type',
      'subject',
    ],
    detail_fields: ['from_party', 'to_party', 'disposition'],
    sort: ['segment_no', false],
  },
];
const pathsAt = (index: number): string[][][] => {
  const keys = ['a', 'b', 'c'];
  const all = (length: number): string[][] =>
    length === 0
      ? [[]]
      : all(length - 1).flatMap(path => keys.map(key => [...path, key]));
  return [all(index), [all(index)[1]]];
};

test.each([
  ['S3', S3],
  ['S4', S4],
])(
  'every batch, counts, Load more and sorted batch at every child level fits the saved mirrors (%s)',
  (_name, levels) => {
    const mirrors = levelsToMirrors(levels);
    const formData = {
      datasource: '1__table',
      viz_type: VizType.TableAgGrid,
      query_mode: 'tree',
      levels,
      time_range: 'Last week',
    };
    let checked = 0;
    for (let level = 1; level < levels.length; level += 1) {
      const sorts: ([string, boolean] | undefined)[] = [
        undefined,
        ...sortableColumns(levels[level]).flatMap(
          column =>
            [
              [column, true],
              [column, false],
            ] as [string, boolean][],
        ),
      ];
      for (const paths of pathsAt(level))
        for (const sort of sorts) {
          const requests = [
            { level, paths, sort },
            { level, paths: [paths[0]], sort, offset: 100 },
            { level, paths: [paths[0]], sort, offset: 200 },
          ];
          for (const request of requests)
            for (const query of buildChildrenQuery(formData, {
              ownState: { treeTableChildren: request },
            }).queries) {
              checked += 1;
              for (const key of ['columns', 'metrics', 'orderby'] as const) {
                expect(query[key]).toBeDefined();
                for (const value of query[key] ?? [])
                  expect(mirrors[`tree_${key}`].map(freeze)).toContain(
                    freeze(value),
                  );
              }
            }
        }
    }
    expect(checked).toBeGreaterThan(0);
  },
);
