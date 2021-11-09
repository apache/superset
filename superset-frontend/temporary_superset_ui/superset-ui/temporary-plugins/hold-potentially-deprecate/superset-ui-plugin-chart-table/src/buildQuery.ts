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

import { buildQueryContext, QueryFormMetric } from '@superset-ui/core';
import TableFormData from './TableFormData';

export default function buildQuery(formData: TableFormData) {
  // Set the single QueryObject's groupby field with series in formData
  return buildQueryContext(formData, baseQueryObject => {
    const isTimeseries = formData.include_time;
    let columns: string[] = [];
    let { groupby } = baseQueryObject;
    const orderby: [QueryFormMetric, boolean][] = [];
    const sortby = formData.timeseries_limit_metric;
    if (formData.all_columns && formData.all_columns.length > 0) {
      columns = [...formData.all_columns];
      const orderByColumns = formData.order_by_cols || [];
      orderByColumns.forEach(columnOrder => {
        const parsedColumnOrder: [QueryFormMetric, boolean] =
          JSON.parse(columnOrder);
        orderby.push([parsedColumnOrder[0], parsedColumnOrder[1]]);
      });
      groupby = [];
    } else if (sortby) {
      orderby.push([sortby, !formData.order_desc]);
    }

    return [
      {
        ...baseQueryObject,
        columns,
        groupby,
        is_timeseries: isTimeseries,
        orderby,
      },
    ];
  });
}
