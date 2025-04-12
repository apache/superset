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
import { QueryObject, SqlaFormData, VizType } from '@superset-ui/core';
import { rankOperator } from '@superset-ui/chart-controls';

const formData: SqlaFormData = {
  x_axis: 'dttm',
  metrics: ['sales'],
  groupby: ['department'],
  time_range: '2015 : 2016',
  granularity: 'month',
  datasource: 'foo',
  viz_type: VizType.Table,
  truncate_metric: true,
};
const queryObject: QueryObject = {
  is_timeseries: true,
  metrics: ['sales'],
  columns: ['department'],
  time_range: '2015 : 2016',
  granularity: 'month',
  post_processing: [],
};

test('should add rankOperator', () => {
  const options = { metric: 'sales', group_by: 'department' };
  expect(rankOperator(formData, queryObject, options)).toEqual({
    operation: 'rank',
    options,
  });
});
