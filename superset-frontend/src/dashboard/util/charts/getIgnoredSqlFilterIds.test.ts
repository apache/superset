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
} from '@superset-ui/core';
import { shallowEqual } from 'react-redux';
import { getSelectExtraFormData } from 'src/filters/utils';
import {
  getIgnoredSqlFilterIds,
  selectChartDatasources,
} from './getIgnoredSqlFilterIds';

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
    getIgnoredSqlFilterIds(receiver, native, {
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
