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
import buildQuery from './buildQuery';

describe('buildQuery', () => {
  test('builds query with correct columns', () => {
    const formData = {
      datasource: 'table__1',
      groupby: ['category'],
      controlType: 'dropdown',
      multiSelect: true,
      enableEmptyFilter: false,
      inverseSelection: false,
      defaultToFirstItem: false,
      sortAscending: true,
    };

    const result = buildQuery(formData, {
      ownState: {},
    });

    expect(result.queries[0].columns).toEqual(['category']);
    expect(result.queries[0].metrics).toEqual([]);
  });

  test('builds query with search filter', () => {
    const formData = {
      datasource: 'table__1',
      groupby: ['category'],
      controlType: 'dropdown',
      multiSelect: true,
      enableEmptyFilter: false,
      inverseSelection: false,
      defaultToFirstItem: false,
      sortAscending: true,
    };

    const result = buildQuery(formData, {
      ownState: {
        search: 'test',
        coltypeMap: { category: 1 }, // GenericDataType.String = 1
      },
    });

    expect(result.queries[0].filters).toHaveLength(1);
    expect(result.queries[0].filters[0]).toEqual({
      col: 'category',
      op: 'ILIKE',
      val: '%test%',
    });
  });

  test('builds query with sort ascending', () => {
    const formData = {
      datasource: 'table__1',
      groupby: ['category'],
      controlType: 'dropdown',
      multiSelect: true,
      enableEmptyFilter: false,
      inverseSelection: false,
      defaultToFirstItem: false,
      sortAscending: true,
    };

    const result = buildQuery(formData, {
      ownState: {},
    });

    expect(result.queries[0].orderby).toEqual([['category', true]]);
  });

  test('builds query with sort descending', () => {
    const formData = {
      datasource: 'table__1',
      groupby: ['category'],
      controlType: 'dropdown',
      multiSelect: true,
      enableEmptyFilter: false,
      inverseSelection: false,
      defaultToFirstItem: false,
      sortAscending: false,
    };

    const result = buildQuery(formData, {
      ownState: {},
    });

    expect(result.queries[0].orderby).toEqual([['category', false]]);
  });
});
