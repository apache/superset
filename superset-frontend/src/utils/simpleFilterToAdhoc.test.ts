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
  BinaryQueryObjectFilterClause,
  TimeGranularity,
} from '@superset-ui/core';
import { simpleFilterToAdhoc } from './simpleFilterToAdhoc';
import buildQuery from '../../plugins/plugin-chart-echarts/src/Sunburst/buildQuery';

// DrillByModal converts chart context-menu filters to adhoc filters before the
// selected chart plugin builds its query.
test('Drill by retains the temporal bucket grain through adhoc form data', () => {
  const bucket: BinaryQueryObjectFilterClause = {
    col: 'order_date',
    op: '==',
    val: 1785542400000,
    grain: TimeGranularity.MONTH,
  };
  const adhoc = simpleFilterToAdhoc(bucket);
  expect(adhoc.timeGrain).toBe(TimeGranularity.MONTH);
  const [query] = buildQuery({
    datasource: '1__table',
    viz_type: 'sunburst_v2',
    columns: ['kind'],
    metric: 'count',
    adhoc_filters: [adhoc],
  }).queries;
  expect(query.filters).toEqual([bucket]);
});
