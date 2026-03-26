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
import { GenericDataType } from '@apache-superset/core/common';
import buildQuery from './buildQuery';
import {
  PluginFilterSelectQueryFormData,
  SelectFilterOperatorType,
} from './types';
import { getSelectExtraFormData } from '../../utils';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('Select buildQuery', () => {
  const formData: PluginFilterSelectQueryFormData = {
    datasource: '5__table',
    groupby: ['my_col'],
    viz_type: 'filter_select',
    sortAscending: undefined,
    sortMetric: undefined,
    filters: undefined,
    enableEmptyFilter: false,
    inverseSelection: false,
    creatable: false,
    multiSelect: false,
    defaultToFirstItem: false,
    searchAllOptions: false,
    height: 100,
    width: 100,
  };

  test('should build a default query', () => {
    const queryContext = buildQuery(formData);
    expect(queryContext.queries.length).toEqual(1);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['my_col']);
    expect(query.filters).toEqual([]);
    expect(query.metrics).toEqual([]);
    expect(query.orderby).toEqual([]);
  });

  test('should sort descending by metric', () => {
    const queryContext = buildQuery({
      ...formData,
      sortMetric: 'my_metric',
      sortAscending: false,
    });
    expect(queryContext.queries.length).toEqual(1);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['my_col']);
    expect(query.metrics).toEqual(['my_metric']);
    expect(query.orderby).toEqual([['my_metric', false]]);
  });

  test('should sort ascending by metric', () => {
    const queryContext = buildQuery({
      ...formData,
      sortMetric: 'my_metric',
      sortAscending: true,
    });
    expect(queryContext.queries.length).toEqual(1);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['my_col']);
    expect(query.metrics).toEqual(['my_metric']);
    expect(query.orderby).toEqual([['my_metric', true]]);
  });

  test('should sort ascending by column', () => {
    const queryContext = buildQuery({
      ...formData,
      sortAscending: true,
    });
    expect(queryContext.queries.length).toEqual(1);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['my_col']);
    expect(query.metrics).toEqual([]);
    expect(query.orderby).toEqual([['my_col', true]]);
  });

  test('should sort descending by column', () => {
    const queryContext = buildQuery({
      ...formData,
      sortAscending: false,
    });
    expect(queryContext.queries.length).toEqual(1);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['my_col']);
    expect(query.metrics).toEqual([]);
    expect(query.orderby).toEqual([['my_col', false]]);
  });

  test('should add text search parameter for string to query filter', () => {
    const queryContext = buildQuery(formData, {
      ownState: {
        search: 'abc',
        coltypeMap: { my_col: GenericDataType.String },
      },
    });
    expect(queryContext.queries.length).toEqual(1);
    const [query] = queryContext.queries;
    expect(query.filters).toEqual([
      { col: 'my_col', op: 'ILIKE', val: '%abc%' },
    ]);
  });

  test('should add text search parameter for numeric to query filter', () => {
    const queryContext = buildQuery(formData, {
      ownState: {
        search: '123',
        coltypeMap: { my_col: GenericDataType.Numeric },
      },
    });
    expect(queryContext.queries.length).toEqual(1);
    const [query] = queryContext.queries;
    expect(query.filters).toEqual([
      { col: 'my_col', op: 'ILIKE', val: '%123%' },
    ]);
  });
});

test('getSelectExtraFormData generates IN filter by default', () => {
  const result = getSelectExtraFormData('name', ['Jennifer']);
  expect(result.filters).toEqual([
    { col: 'name', op: 'IN', val: ['Jennifer'] },
  ]);
});

test('getSelectExtraFormData generates NOT IN filter with excludeFilter', () => {
  const result = getSelectExtraFormData('name', ['Jennifer'], false, true);
  expect(result.filters).toEqual([
    { col: 'name', op: 'NOT IN', val: ['Jennifer'] },
  ]);
});

test('getSelectExtraFormData generates ILIKE contains filter', () => {
  const result = getSelectExtraFormData(
    'name',
    ['Jen'],
    false,
    false,
    SelectFilterOperatorType.Contains,
  );
  expect(result.filters).toEqual([{ col: 'name', op: 'ILIKE', val: '%Jen%' }]);
});

test('getSelectExtraFormData generates ILIKE starts-with filter', () => {
  const result = getSelectExtraFormData(
    'name',
    ['Jen'],
    false,
    false,
    SelectFilterOperatorType.StartsWith,
  );
  expect(result.filters).toEqual([{ col: 'name', op: 'ILIKE', val: 'Jen%' }]);
});

test('getSelectExtraFormData generates ILIKE ends-with filter', () => {
  const result = getSelectExtraFormData(
    'name',
    ['son'],
    false,
    false,
    SelectFilterOperatorType.EndsWith,
  );
  expect(result.filters).toEqual([{ col: 'name', op: 'ILIKE', val: '%son' }]);
});

test('getSelectExtraFormData generates NOT ILIKE with excludeFilter and LIKE operator', () => {
  const result = getSelectExtraFormData(
    'name',
    ['Jen'],
    false,
    true,
    SelectFilterOperatorType.Contains,
  );
  expect(result.filters).toEqual([
    { col: 'name', op: 'NOT ILIKE', val: '%Jen%' },
  ]);
});

test('getSelectExtraFormData returns empty object for null value with LIKE operator', () => {
  const result = getSelectExtraFormData(
    'name',
    null,
    false,
    false,
    SelectFilterOperatorType.Contains,
  );
  expect(result).toEqual({});
});

test('getSelectExtraFormData returns adhoc_filters for emptyFilter with LIKE operator', () => {
  const result = getSelectExtraFormData(
    'name',
    [],
    true,
    false,
    SelectFilterOperatorType.Contains,
  );
  expect(result.adhoc_filters).toEqual([
    {
      expressionType: 'SQL',
      clause: 'WHERE',
      sqlExpression: '1 = 0',
    },
  ]);
});
