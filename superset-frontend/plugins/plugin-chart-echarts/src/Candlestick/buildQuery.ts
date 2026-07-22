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
import { buildQueryContext, getXAxisColumn } from '@superset-ui/core';
import { CandlestickQueryFormData } from './types';

export default function buildQuery(formData: CandlestickQueryFormData) {
  return buildQueryContext(formData, baseQueryObject => {
    // Collect all OHLC metrics and remove duplicates
    const metrics = Array.from(
      new Set(
        [formData.open, formData.close, formData.high, formData.low].filter(
          Boolean,
        ),
      ),
    );

    return [
      {
        ...baseQueryObject,
        metrics,
        is_timeseries: true,
        columns: [getXAxisColumn(formData)].filter(Boolean) as string[],
      },
    ];
  });
}
