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
  AdhocColumn,
  buildQueryContext,
  ensureIsArray,
  isPhysicalColumn,
  QueryFormColumn,
  QueryFormData,
} from '@superset-ui/core';

import { isGrainedLevel } from './timeGrain';

// Wrap each temporal hierarchy level in the BASE_AXIS column reference that
// carries the time grain, the shape ``normalizeTimeColumn`` uses for a physical
// x-axis. Non-temporal levels are left untouched.
function applyTimeGrain(
  columns: QueryFormColumn[],
  formData: QueryFormData,
  timeGrain: string | undefined,
): { columns: QueryFormColumn[]; grained: boolean } {
  let grained = false;
  const mapped = columns.map(column => {
    if (
      timeGrain &&
      isPhysicalColumn(column) &&
      isGrainedLevel(
        column,
        formData.temporal_columns_lookup,
        formData.extra_form_data?.granularity_sqla ?? formData.granularity_sqla,
      )
    ) {
      grained = true;
      return {
        timeGrain,
        columnType: 'BASE_AXIS',
        sqlExpression: column,
        label: column,
        expressionType: 'SQL',
        isColumnReference: true,
      } as AdhocColumn;
    }
    return column;
  });
  return { columns: mapped, grained };
}

export default function buildQuery(formData: QueryFormData) {
  const { metric, sort_by_metric } = formData;
  return buildQueryContext(formData, baseQueryObject => {
    const { columns, grained } = applyTimeGrain(
      ensureIsArray(baseQueryObject.columns),
      formData,
      baseQueryObject.extras?.time_grain_sqla,
    );
    const extras = { ...baseQueryObject.extras };
    if (!grained && !baseQueryObject.granularity) {
      // A grain with neither a temporal level nor a legacy granularity subject
      // is dormant; semantic views reject a grain that has no time column.
      delete extras.time_grain_sqla;
    }
    return [
      {
        ...baseQueryObject,
        columns,
        extras,
        ...(sort_by_metric && { orderby: [[metric, false]] }),
      },
    ];
  });
}
