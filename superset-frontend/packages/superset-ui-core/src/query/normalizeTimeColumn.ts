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
import omit from 'lodash/omit';

import {
  AdhocColumn,
  isAdhocColumn,
  isPhysicalColumn,
  QueryFormColumn,
  QueryFormData,
  QueryObject,
} from './types';
import { FeatureFlag, isFeatureEnabled } from '../utils';

export function normalizeTimeColumn(
  formData: QueryFormData,
  queryObject: QueryObject,
): QueryObject {
  if (!(isFeatureEnabled(FeatureFlag.GENERIC_CHART_AXES) && formData.x_axis)) {
    return queryObject;
  }

  const mutatedColumns: QueryFormColumn[] = [...(queryObject.columns || [])];
  const axisIdx = queryObject.columns?.findIndex(
    col =>
      (isPhysicalColumn(col) &&
        isPhysicalColumn(formData.x_axis) &&
        col === formData.x_axis) ||
      (isAdhocColumn(col) &&
        isAdhocColumn(formData.x_axis) &&
        col.sqlExpression === formData.x_axis.sqlExpression),
  );
  if (
    axisIdx !== undefined &&
    axisIdx > -1 &&
    formData.x_axis &&
    Array.isArray(queryObject.columns)
  ) {
    if (isAdhocColumn(queryObject.columns[axisIdx])) {
      mutatedColumns[axisIdx] = {
        timeGrain: queryObject?.extras?.time_grain_sqla,
        columnType: 'AXIS',
        ...(queryObject.columns[axisIdx] as AdhocColumn),
      };
    } else {
      mutatedColumns[axisIdx] = {
        timeGrain: queryObject?.extras?.time_grain_sqla,
        columnType: 'AXIS',
        sqlExpression: formData.x_axis,
        label: formData.x_axis,
        expressionType: 'SQL',
      };
    }

    const newQueryObject = omit(queryObject, [
      'extras.time_grain_sqla',
      'is_timeseries',
    ]);
    newQueryObject.columns = mutatedColumns;

    return newQueryObject;
  }

  // fallback, return original queryObject
  return queryObject;
}
