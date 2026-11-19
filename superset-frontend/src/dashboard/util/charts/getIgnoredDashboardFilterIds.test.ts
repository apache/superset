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
  DatasourceType,
  ExtraFormData,
  PartialFilters,
  SemanticSelectionSource,
} from '@superset-ui/core';
import { shallowEqual } from 'react-redux';
import { getSelectExtraFormData } from 'src/filters/utils';
import {
  getIgnoredDashboardFilterIds,
  selectChartDatasources,
} from './getIgnoredDashboardFilterIds';

const receiver = {
  datasource: '3__semantic_view',
  semantic_selection_version: 'cube-member-id-v1',
};
const predicate: ExtraFormData = {
  filters: [{ col: 'country', op: 'IN', val: ['US'] }],
};
const sql: PartialFilters = {
  f: { id: 'f', filterType: 'filter_select', targets: [{ datasetId: 12 }] },
};
const emptyRequired = getSelectExtraFormData('country', [], true);

test.each<{
  name: string;
  native: PartialFilters;
  extra: ExtraFormData;
  ignored: boolean;
}>([
  {
    name: 'SQL target with retained semantic provenance',
    native: sql,
    extra: {
      ...predicate,
      semantic_selection_sources: [
        { datasource: '9__semantic_view', version: 'cube-member-id-v1' },
      ],
    },
    ignored: false,
  },
  {
    name: 'native target missing dataset id',
    native: {
      f: {
        filterType: 'filter_select',
        targets: [{ datasourceType: DatasourceType.Table }],
      },
    },
    extra: predicate,
    ignored: false,
  },
  {
    name: 'predicates mixed with time override',
    native: sql,
    extra: { ...predicate, granularity_sqla: 'event_time' },
    ignored: false,
  },
  {
    name: 'SQL time column',
    native: { f: { ...sql.f, filterType: 'filter_time' } },
    extra: { granularity_sqla: 'event_time' },
    ignored: false,
  },
  {
    name: 'SQL time range',
    native: { f: { ...sql.f, filterType: 'filter_time' } },
    extra: { time_range: 'Last year' },
    ignored: false,
  },
  {
    name: 'required SQL Value sentinel',
    native: sql,
    extra: emptyRequired,
    ignored: true,
  },
  {
    name: 'required semantic Value sentinel',
    native: {
      f: {
        ...sql.f,
        targets: [
          { datasetId: 3, datasourceType: DatasourceType.SemanticView },
        ],
      },
    },
    extra: emptyRequired,
    ignored: false,
  },
  {
    name: 'required unknown native sentinel',
    native: { f: { filterType: 'filter_select' } },
    extra: emptyRequired,
    ignored: false,
  },
  {
    name: 'sentinel with foreign provenance',
    native: sql,
    extra: {
      ...emptyRequired,
      semantic_selection_sources: [
        { datasource: '9__semantic_view', version: null },
      ],
    },
    ignored: false,
  },
  {
    name: 'sentinel mixed with ordinary predicate',
    native: sql,
    extra: { ...emptyRequired, ...predicate },
    ignored: false,
  },
  {
    name: 'sentinel mixed with override',
    native: sql,
    extra: { ...emptyRequired, time_range: 'Last year' },
    ignored: false,
  },
  {
    name: 'arbitrary SQL is not a required-value sentinel',
    native: sql,
    extra: {
      adhoc_filters: [
        { expressionType: 'SQL', clause: 'WHERE', sqlExpression: '1 = 1' },
      ],
    },
    ignored: false,
  },
])('$name', ({ native, extra, ignored }) => {
  expect(
    getIgnoredDashboardFilterIds(receiver, native, {
      f: { id: 'f', extraFormData: extra },
    }),
  ).toEqual(ignored ? ['f'] : []);
});

test('datasource projection ignores chart status and results but detects repointing', () => {
  const chart = {
    form_data: { datasource: '12__table' },
    chartStatus: 'loading',
  };
  const before = selectChartDatasources({ charts: { 42: chart } });
  const rendered = { ...chart, chartStatus: 'rendered' };
  const after = selectChartDatasources({ charts: { 42: rendered } });
  expect(after).toBe(before);
  expect(
    shallowEqual(
      before,
      selectChartDatasources({
        charts: { 42: { form_data: { datasource: '9__semantic_view' } } },
      }),
    ),
  ).toBe(false);
});

const foreignSource = {
  datasource: '9__semantic_view',
  version: 'cube-member-id-v1',
};
const foreignNative: PartialFilters = {
  f: {
    id: 'f',
    filterType: 'filter_select',
    targets: [{ datasetId: 9, datasourceType: DatasourceType.SemanticView }],
  },
};

test.each<{
  name: string;
  sources?: SemanticSelectionSource[];
  ignored: boolean;
}>([
  {
    name: 'consistent foreign provenance',
    sources: [foreignSource, foreignSource],
    ignored: true,
  },
  { name: 'absent provenance', ignored: false },
  { name: 'empty provenance', sources: [], ignored: false },
  {
    name: 'missing source version',
    sources: [{ ...foreignSource, version: null }],
    ignored: false,
  },
  {
    name: 'empty source version',
    sources: [{ ...foreignSource, version: '' }],
    ignored: false,
  },
  {
    name: 'mixed source versions',
    sources: [foreignSource, { ...foreignSource, version: 'old' }],
    ignored: false,
  },
  {
    name: 'mixed view sources',
    sources: [
      foreignSource,
      { ...foreignSource, datasource: receiver.datasource },
    ],
    ignored: false,
  },
  {
    name: 'stamp disagrees with configured source',
    sources: [{ ...foreignSource, datasource: '8__semantic_view' }],
    ignored: false,
  },
  {
    name: 'unknown stamped source',
    sources: [{ datasource: '', version: null }],
    ignored: false,
  },
])('foreign selected and cleared masks: $name', ({ sources, ignored }) => {
  for (const values of [predicate, {}, { filters: [] }]) {
    expect(
      getIgnoredDashboardFilterIds(receiver, foreignNative, {
        f: {
          id: 'f',
          extraFormData: { ...values, semantic_selection_sources: sources },
        },
      }),
    ).toEqual(ignored ? ['f'] : []);
  }
});

test.each(['filter_time', 'chart_customization_dynamic_groupby'])(
  'foreign %s controls remain subject to validation',
  filterType => {
    expect(
      getIgnoredDashboardFilterIds(
        receiver,
        { f: { ...foreignNative.f, filterType } },
        {
          f: {
            id: 'f',
            extraFormData: {
              ...predicate,
              semantic_selection_sources: [foreignSource],
            },
          },
        },
      ),
    ).toEqual([]);
  },
);

test('foreign member overrides and mixed masks are not dropped', () => {
  for (const extra of [
    { granularity_sqla: 'created_at' },
    { ...predicate, granularity_sqla: 'created_at' },
  ]) {
    expect(
      getIgnoredDashboardFilterIds(receiver, foreignNative, {
        f: {
          id: 'f',
          extraFormData: {
            ...extra,
            semantic_selection_sources: [foreignSource],
          },
        },
      }),
    ).toEqual([]);
  }
});

test('foreign required-value sentinel is skipped only with agreed provenance', () => {
  expect(
    getIgnoredDashboardFilterIds(receiver, foreignNative, {
      f: {
        id: 'f',
        extraFormData: {
          ...emptyRequired,
          semantic_selection_sources: [foreignSource],
        },
      },
    }),
  ).toEqual(['f']);
});

test.each(['cube-member-id-v1', 'old'])(
  'same-view source version %s is never skipped',
  version => {
    const source = { datasource: receiver.datasource, version };
    expect(
      getIgnoredDashboardFilterIds(
        receiver,
        {},
        {
          f: {
            id: 'f',
            extraFormData: {
              ...predicate,
              semantic_selection_sources: [source],
            },
          },
        },
        { f: receiver.datasource },
      ),
    ).toEqual([]);
  },
);

test.each([
  { datasource: '3__semantic_view' },
  { ...receiver, datasource: '12__table' },
])('foreign-view omission does not change receiver %j', target => {
  expect(
    getIgnoredDashboardFilterIds(target, foreignNative, {
      f: {
        id: 'f',
        extraFormData: {
          ...predicate,
          semantic_selection_sources: [foreignSource],
        },
      },
    }),
  ).toEqual([]);
});
test.each([10, 50, 100])(
  'projects %i chart identities once for all chart and badge subscribers',
  count => {
    const readDatasource = jest.fn(() => '12__table');
    const charts = Object.fromEntries(
      Array.from({ length: count }, (_, id) => [
        id,
        {
          form_data: {
            get datasource() {
              return readDatasource();
            },
          },
        },
      ]),
    );
    for (let subscriber = 0; subscriber < count * 2; subscriber += 1) {
      selectChartDatasources({ charts });
    }
    expect(readDatasource).toHaveBeenCalledTimes(count);
  },
);

test.each([
  {},
  { semantic_selection_sources: [{ datasource: '12__table', version: null }] },
])(
  'an ordinary-dataset target with no predicate is not ignored: %j',
  extraFormData => {
    expect(
      getIgnoredDashboardFilterIds(receiver, sql, {
        f: { id: 'f', extraFormData },
      }),
    ).toEqual([]);
  },
);
