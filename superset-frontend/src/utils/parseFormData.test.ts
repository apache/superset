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
import { TimeseriesDefaultFormData } from '@superset-ui/plugin-chart-echarts';
import parseFormData from './parseFormData';

test('parses formData with all required properties', () => {
  const formData = {
    ...TimeseriesDefaultFormData,
    datasource: '5__table',
    viz_type: 'echarts_timeseries_line',
  };
  const parsedFormData = parseFormData(formData);
  expect(parsedFormData).toEqual(formData);
});

test('parses formData with missing optional properties', () => {
  const formData = {
    datasource: '5__table',
    viz_type: 'echarts_timeseries_line',
    time_compare: undefined,
  };
  const expectedFormData = {
    ...formData,
    time_compare: undefined,
  };
  const parsedFormData = parseFormData(formData);
  expect(parsedFormData).toEqual(expect.objectContaining(expectedFormData));
});

test('parses formData with missing required properties', () => {
  const formData = {
    datasource: '5__table',
    viz_type: 'echarts_timeseries_line',
    groupby: undefined,
  };
  const expectedFormData = {
    ...formData,
    groupby: TimeseriesDefaultFormData.groupby,
  };
  const parsedFormData = parseFormData(formData);
  expect(parsedFormData).toEqual(expect.objectContaining(expectedFormData));
});
