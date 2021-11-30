/*
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

import { LINE_PLUGIN_TYPE, LINE_PLUGIN_LEGACY_TYPE } from '../constants';
import createQueryStory from '../../../../../shared/components/createQueryStory';

export default createQueryStory({
  choices: {
    'Line Chart - Legacy API': {
      chartType: LINE_PLUGIN_LEGACY_TYPE,
      formData: {
        datasource: '3__table',
        viz_type: 'line',
        url_params: {},
        granularity_sqla: 'ds',
        time_grain_sqla: 'P1D',
        time_range: '100 years ago : now',
        metrics: ['sum__num'],
        adhoc_filters: [],
        groupby: [],
        limit: 25,
        row_limit: 50000,
      },
    },
    'Line Chart - /api/v1/query': {
      chartType: LINE_PLUGIN_TYPE,
      formData: {
        viz_type: LINE_PLUGIN_TYPE,
        datasource: '3__table',
        granularity_sqla: 'ds',
        time_grain_sqla: 'P1D',
        time_range: '100 years ago : now',
        metrics: ['sum__num'],
        limit: 25,
        row_limit: 50000,
        encoding: {
          x: {
            field: '__timestamp',
            type: 'temporal',
            format: '%Y',
            scale: {
              type: 'time',
            },
            axis: {
              title: 'Time',
            },
          },
          y: {
            field: 'sum__num',
            type: 'quantitative',
            scale: {
              type: 'linear',
            },
            axis: {
              title: 'Number of Babies',
            },
          },
          stroke: {
            field: 'gender',
            type: 'nominal',
            legend: true,
          },
        },
      },
    },
  },
});
