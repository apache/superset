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
import findNonTabChildCharIds from './findNonTabChildChartIds';

export default function childChartsDidLoad({ chartQueries, layout, id }) {
  const chartIds = findNonTabChildCharIds({ id, layout });

  let minQueryStartTime = Infinity;
  const didLoad = chartIds.every(chartId => {
    const query = chartQueries[chartId] || {};

    // filterbox's don't re-render, don't use stale update time
    if (query.form_data && query.form_data.viz_type !== 'filter_box') {
      minQueryStartTime = Math.min(
        query.chartUpdateStartTime,
        minQueryStartTime,
      );
    }
    return ['stopped', 'failed', 'rendered'].indexOf(query.chartStatus) > -1;
  });

  return { didLoad, minQueryStartTime };
}
