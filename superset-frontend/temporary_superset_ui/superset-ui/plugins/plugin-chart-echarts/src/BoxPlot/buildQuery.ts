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
import { buildQueryContext, getMetricLabel } from '@superset-ui/core';
import { BoxPlotQueryFormData, BoxPlotQueryObjectWhiskerType } from './types';

const PERCENTILE_REGEX = /(\d+)\/(\d+) percentiles/;

export default function buildQuery(formData: BoxPlotQueryFormData) {
  const { whiskerOptions, columns: distributionColumns = [] } = formData;
  return buildQueryContext(formData, baseQueryObject => {
    let whiskerType: BoxPlotQueryObjectWhiskerType;
    let percentiles: [number, number] | undefined;
    const { columns = [], metrics = [] } = baseQueryObject;
    const percentileMatch = PERCENTILE_REGEX.exec(whiskerOptions as string);

    if (whiskerOptions === 'Tukey') {
      whiskerType = 'tukey';
    } else if (whiskerOptions === 'Min/max (no outliers)') {
      whiskerType = 'min/max';
    } else if (percentileMatch) {
      whiskerType = 'percentile';
      percentiles = [parseInt(percentileMatch[1], 10), parseInt(percentileMatch[2], 10)];
    } else {
      throw new Error(`Unsupported whisker type: ${whiskerOptions}`);
    }
    return [
      {
        ...baseQueryObject,
        is_timeseries: distributionColumns.length === 0,
        post_processing: [
          {
            operation: 'boxplot',
            options: {
              whisker_type: whiskerType,
              percentiles,
              groupby: columns.filter(x => !distributionColumns.includes(x)),
              metrics: metrics.map(getMetricLabel),
            },
          },
        ],
      },
    ];
  });
}
