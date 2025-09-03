// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import {
  QueryFormData,
  QueryFormMetric,
  QueryFormColumn,
  QueryFormOrderBy,
  QueryFieldAliases,
} from '../types';

interface QueryFieldsResult {
  metrics?: QueryFormMetric[];
  columns?: QueryFormColumn[];
  orderby?: QueryFormOrderBy[];
}

/**
 * Extract query fields (metrics, columns, orderby) from form data
 */
export default function extractQueryFields(
  formData: QueryFormData,
  queryFieldAliases?: QueryFieldAliases,
): QueryFieldsResult {
  const result: QueryFieldsResult = {};

  // Extract metrics
  if (formData.metrics && formData.metrics.length > 0) {
    result.metrics = formData.metrics;
  }

  // Extract columns - prefer 'columns' over 'groupby'
  const columns = formData.columns || formData.groupby;
  if (columns && columns.length > 0) {
    result.columns = columns;
  }

  // Handle query field aliases if provided
  if (queryFieldAliases) {
    for (const [formFieldName, queryField] of Object.entries(queryFieldAliases)) {
      const formValue = (formData as any)[formFieldName];
      if (formValue && Array.isArray(formValue) && formValue.length > 0) {
        if (queryField === 'metrics') {
          result.metrics = formValue;
        } else if (queryField === 'columns' || queryField === 'groupby') {
          result.columns = formValue;
        }
      }
    }
  }

  // Extract orderby - this can be complex as it depends on the form structure
  // For now, we'll handle basic cases
  if (formData.orderby && Array.isArray(formData.orderby)) {
    result.orderby = formData.orderby as QueryFormOrderBy[];
  }

  return result;
}