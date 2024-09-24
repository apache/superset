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
  DEFAULT_METRICS,
  QueryResponse,
  testQuery,
} from '@superset-ui/core';
import { defineSavedMetrics } from '@superset-ui/chart-controls';

describe('defineSavedMetrics', () => {
  it('defines saved metrics if source is a Dataset', () => {
    const dataset = {
      id: 1,
      metrics: [
        {
          metric_name: 'COUNT(*) non-default-dataset-metric',
          expression: 'COUNT(*) non-default-dataset-metric',
        },
      ],
      type: DatasourceType.Table,
      main_dttm_col: 'test',
      time_grain_sqla: [],
      columns: [],
      verbose_map: {},
      column_formats: {},
      currency_formats: {},
      datasource_name: 'my_datasource',
      description: 'this is my datasource',
    };
    expect(defineSavedMetrics(dataset)).toEqual([
      {
        metric_name: 'COUNT(*) non-default-dataset-metric',
        expression: 'COUNT(*) non-default-dataset-metric',
      },
    ]);
    // @ts-ignore
    expect(defineSavedMetrics({ ...dataset, metrics: undefined })).toEqual([]);
  });

  it('returns default saved metrics if source is a Query', () => {
    expect(defineSavedMetrics(testQuery as QueryResponse)).toEqual(
      DEFAULT_METRICS,
    );
  });
});
