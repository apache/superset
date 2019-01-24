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
import build, { QueryObject } from 'src/query/buildQueryObject';

describe('queryObjectBuilder', () => {
  let query: QueryObject;

  it('should build granularity for sql alchemy datasources', () => {
    query = build({datasource: '5__table', granularity_sqla: 'ds'});
    expect(query.granularity).toEqual('ds');
  });

  it('should build granularity for sql druid datasources', () => {
    query = build({datasource: '5__druid', granularity: 'ds'});
    expect(query.granularity).toEqual('ds');
  });

  it('should build metrics', () => {
    query = build({
      datasource: '5__table',
      granularity_sqla: 'ds',
      metric: 'sum__num',
    });
    expect(query.metrics).toEqual([{label: 'sum__num'}]);
  });
});
