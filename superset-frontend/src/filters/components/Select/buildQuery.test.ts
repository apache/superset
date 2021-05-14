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

describe('Select buildQuery', () => {
  const formData = {
    datasource: '5__table',
    groupby: ['my_col'],
    viz_type: 'filter_select',
    sortAscending: false,
    sortMetric: undefined,
    filters: undefined,
    enableEmptyFilter: false,
    inverseSelection: false,
    multiSelect: false,
    defaultToFirstItem: false,
    height: 100,
    width: 100,
  };

  it('should build a default query', () => {
    const queryContext = buildQuery(formData);
    expect(queryContext.queries.length).toEqual(1);
    const [query] = queryContext.queries;
    expect(query.groupby).toEqual(['my_col']);
    expect(query.metrics).toEqual([]);
    expect(query.apply_fetch_values_predicate).toEqual(true);
    expect(query.orderby).toEqual([]);
  });

  it('should handle sort metric correctly', () => {
    const queryContext = buildQuery({
      ...formData,
      sortMetric: 'my_metric',
      sortAscending: false,
    });
    expect(queryContext.queries.length).toEqual(1);
    const [query] = queryContext.queries;
    expect(query.groupby).toEqual(['my_col']);
    expect(query.metrics).toEqual(['my_metric']);
    expect(query.orderby).toEqual([['my_metric', false]]);
  });
});
