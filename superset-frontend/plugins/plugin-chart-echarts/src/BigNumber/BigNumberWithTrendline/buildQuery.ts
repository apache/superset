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
  buildQueryContext,
  DTTM_ALIAS,
  PostProcessingResample,
  QueryFormData,
} from '@superset-ui/core';
import { rollingWindowOperator } from '@superset-ui/chart-controls';

const TIME_GRAIN_MAP: Record<string, string> = {
  PT1S: 'S',
  PT1M: 'min',
  PT5M: '5min',
  PT10M: '10min',
  PT15M: '15min',
  PT30M: '30min',
  PT1H: 'H',
  P1D: 'D',
  P1M: 'MS',
  P3M: 'QS',
  P1Y: 'AS',
  // TODO: these need to be mapped carefully, as the first day of week
  //  can vary from engine to engine
  // P1W: 'W',
  // '1969-12-28T00:00:00Z/P1W': 'W',
  // '1969-12-29T00:00:00Z/P1W': 'W',
  // 'P1W/1970-01-03T00:00:00Z': 'W',
  // 'P1W/1970-01-04T00:00:00Z': 'W',
};

export default function buildQuery(formData: QueryFormData) {
  return buildQueryContext(formData, baseQueryObject => {
    const rollingProc = rollingWindowOperator(formData, baseQueryObject);
    if (rollingProc) {
      rollingProc.options = { ...rollingProc.options, is_pivot_df: false };
    }
    const { time_grain_sqla } = formData;
    let resampleProc: PostProcessingResample | undefined;
    if (rollingProc && time_grain_sqla) {
      const rule = TIME_GRAIN_MAP[time_grain_sqla];
      if (rule) {
        resampleProc = {
          operation: 'resample',
          options: {
            method: 'asfreq',
            rule,
            fill_value: null,
            time_column: DTTM_ALIAS,
          },
        };
      }
    }
    return [
      {
        ...baseQueryObject,
        is_timeseries: true,
        post_processing: [
          {
            operation: 'sort',
            options: {
              columns: {
                [DTTM_ALIAS]: true,
              },
            },
          },
          resampleProc,
          rollingProc,
        ],
      },
    ];
  });
}
