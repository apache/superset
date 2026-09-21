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
import { t } from '@apache-superset/core/translation';
import {
  buildQueryContext,
  ensureIsArray,
  QueryFormData,
} from '@superset-ui/core';

/**
 * Mirrors the legacy TimeTableViz.query_obj: a timeseries query ordered
 * by the first metric (ascending unless order_desc), limited to a single
 * metric when grouped.
 */
export default function buildQuery(formData: QueryFormData) {
  const { order_desc, groupby } = formData;
  return buildQueryContext(formData, baseQueryObject => {
    const metrics = ensureIsArray(baseQueryObject.metrics);
    if (ensureIsArray(groupby).length > 0 && metrics.length > 1) {
      throw new Error(
        t("When using 'Group By' you are limited to use a single metric"),
      );
    }
    const firstMetric = metrics[0];
    return [
      {
        ...baseQueryObject,
        is_timeseries: true,
        orderby: firstMetric ? [[firstMetric, !order_desc]] : undefined,
      },
    ];
  });
}
