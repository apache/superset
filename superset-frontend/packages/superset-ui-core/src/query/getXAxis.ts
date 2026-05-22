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
  DTTM_ALIAS,
  getColumnLabel,
  isQueryFormColumn,
  QueryFormData,
  QueryFormColumn,
  Optional,
} from '@superset-ui/core';

export const isXAxisSet = (formData: QueryFormData) => {
  const xAxis = formData.x_axis;
  if (Array.isArray(xAxis)) {
    return xAxis.length > 0 && isQueryFormColumn(xAxis[0]);
  }
  return isQueryFormColumn(xAxis);
};

export const getXAxisColumn = (
  formData: QueryFormData,
): Optional<QueryFormColumn> => {
  // The formData should be "raw form_data" -- the snake_case version of formData rather than camelCase.
  if (!(formData.granularity_sqla || formData.x_axis)) {
    return undefined;
  }

  if (isXAxisSet(formData)) {
    const xAxis = formData.x_axis;
    // When x_axis is an array (multi-level drill hierarchy), use the first entry
    if (Array.isArray(xAxis)) {
      return xAxis[0];
    }
    return xAxis;
  }
  return DTTM_ALIAS;
};

export const getXAxisLabel = (formData: QueryFormData): Optional<string> => {
  const col = getXAxisColumn(formData);
  if (col) {
    return getColumnLabel(col);
  }
  return undefined;
};
