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

import getNativeFilterConfig from './filterboxMigrationHelper';

const regionFilter = {
  cache_timeout: null,
  changed_on: '2021-10-07 11:57:48.355047',
  description: null,
  description_markeddown: '',
  form_data: {
    compare_lag: '10',
    compare_suffix: 'o10Y',
    country_fieldtype: 'cca3',
    datasource: '1__table',
    date_filter: false,
    entity: 'country_code',
    filter_configs: [
      {
        asc: false,
        clearable: true,
        column: 'region',
        key: '2s98dfu',
        metric: 'sum__SP_POP_TOTL',
        multiple: false,
      },
      {
        asc: false,
        clearable: true,
        column: 'country_name',
        key: 'li3j2lk',
        metric: 'sum__SP_POP_TOTL',
        multiple: true,
      },
    ],
    granularity_sqla: 'year',
    groupby: [],
    limit: '25',
    markup_type: 'markdown',
    row_limit: 50000,
    show_bubbles: true,
    slice_id: 32,
    time_range: '2014-01-01 : 2014-01-02',
    viz_type: 'filter_box',
  },
  modified: '<bound method AuditMixinNullable.modified of Region Filter>',
  slice_name: 'Region Filter',
  slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%2032%7D',
  slice_id: 32,
};
const chart1 = {
  cache_timeout: null,
  changed_on: '2021-09-07 18:05:18.896212',
  description: null,
  description_markeddown: '',
  form_data: {
    compare_lag: '10',
    compare_suffix: 'over 10Y',
    country_fieldtype: 'cca3',
    datasource: '1__table',
    entity: 'country_code',
    granularity_sqla: 'year',
    groupby: [],
    limit: '25',
    markup_type: 'markdown',
    metric: 'sum__SP_POP_TOTL',
    row_limit: 50000,
    show_bubbles: true,
    slice_id: 33,
    time_range: '2000 : 2014-01-02',
    viz_type: 'big_number',
  },
  modified: "<bound method AuditMixinNullable.modified of World's Population>",
  slice_name: "World's Population",
  slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%2033%7D',
  slice_id: 33,
};
const chartData = [regionFilter, chart1];
const preselectedFilters = {
  '32': {
    region: ['East Asia & Pacific'],
  },
};

test('should convert filter_box config to dashboard native filter config', () => {
  const filterConfig = getNativeFilterConfig(chartData, {}, {});
  // convert to 2 components
  expect(filterConfig.length).toEqual(2);

  expect(filterConfig[0].id).toBeDefined();
  expect(filterConfig[0].filterType).toBe('filter_select');
  expect(filterConfig[0].name).toBe('region');
  expect(filterConfig[0].targets).toEqual([
    { column: { name: 'region' }, datasetId: 1 },
  ]);
  expect(filterConfig[0].scope).toEqual({
    excluded: [],
    rootPath: ['ROOT_ID'],
  });

  expect(filterConfig[1].id).toBeDefined();
  expect(filterConfig[1].filterType).toBe('filter_select');
  expect(filterConfig[1].name).toBe('country_name');
  expect(filterConfig[1].targets).toEqual([
    { column: { name: 'country_name' }, datasetId: 1 },
  ]);
  expect(filterConfig[1].scope).toEqual({
    excluded: [],
    rootPath: ['ROOT_ID'],
  });
});

test('should convert preselected filters', () => {
  const filterConfig = getNativeFilterConfig(chartData, {}, preselectedFilters);
  const { defaultDataMask } = filterConfig[0];
  expect(defaultDataMask.filterState).toEqual({
    value: ['East Asia & Pacific'],
  });
  expect(defaultDataMask.extraFormData?.filters).toEqual([
    {
      col: 'region',
      op: 'IN',
      val: ['East Asia & Pacific'],
    },
  ]);
});
