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
import buildQuery from '../../src/Tree/buildQuery';

describe('Tree buildQuery', () => {
  it('should build query', () => {
    const formData = {
      datasource: '5__table',
      granularity_sqla: 'ds',
      id: 'id_col',
      parent: 'relation_col',
      name: 'name_col',
      metrics: ['foo', 'bar'],
      viz_type: 'my_chart',
    };
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['id_col', 'relation_col', 'name_col']);
    expect(query.metrics).toEqual(['foo', 'bar']);
  });
  it('should build query without name column', () => {
    const formData = {
      datasource: '5__table',
      granularity_sqla: 'ds',
      id: 'id_col',
      parent: 'relation_col',
      metrics: ['foo', 'bar'],
      viz_type: 'my_chart',
    };
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['id_col', 'relation_col']);
    expect(query.metrics).toEqual(['foo', 'bar']);
  });
});
