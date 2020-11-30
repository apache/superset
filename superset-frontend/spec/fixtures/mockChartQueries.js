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
import { datasourceId } from './mockDatasource';

export const sliceId = 18;

export default {
  [sliceId]: {
    id: sliceId,
    chartAlert: null,
    chartStatus: 'rendered',
    chartUpdateEndTime: 1525852456388,
    chartUpdateStartTime: 1525852454838,
    latestQueryFormData: {},
    queryRequest: {},
    queryResponse: {},
    triggerQuery: false,
    lastRendered: 0,
    form_data: {
      slice_id: sliceId,
      viz_type: 'pie',
      row_limit: 50000,
      metric: 'sum__num',
      since: '100 years ago',
      groupby: ['gender'],
      metrics: ['sum__num'],
      compare_lag: '10',
      limit: '25',
      until: 'now',
      granularity: 'ds',
      markup_type: 'markdown',
      where: '',
      compare_suffix: 'o10Y',
      datasource: datasourceId,
    },
    formData: {
      datasource: datasourceId,
      viz_type: 'pie',
      slice_id: sliceId,
      granularity_sqla: null,
      time_grain_sqla: null,
      since: '100 years ago',
      until: 'now',
      metrics: ['sum__num'],
      groupby: ['gender'],
      limit: '25',
      pie_label_type: 'key',
      donut: false,
      show_legend: true,
      labels_outside: true,
      color_scheme: 'bnbColors',
      where: '',
      having: '',
      filters: [],
      row_limit: 50000,
      metric: 'sum__num',
      compare_lag: '10',
      granularity: 'ds',
      markup_type: 'markdown',
      compare_suffix: 'o10Y',
    },
  },
};
