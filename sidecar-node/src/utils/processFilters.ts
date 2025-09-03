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
  AdhocFilter,
  QueryObjectFilterClause,
  QueryFormData,
  QueryObjectExtras,
} from '../types';

interface FilterProcessorInput extends QueryFormData {
  extras: QueryObjectExtras;
  filters: QueryObjectFilterClause[];
  adhoc_filters: AdhocFilter[];
}

interface FilterProcessorResult {
  extras: QueryObjectExtras;
  filters: QueryObjectFilterClause[];
}

/**
 * Process filters from form data into QueryObject format
 */
export default function processFilters(
  formData: FilterProcessorInput,
): FilterProcessorResult {
  const { filters = [], adhoc_filters = [], extras = {} } = formData;

  // Convert adhoc filters to simple filters where possible
  const processedFilters: QueryObjectFilterClause[] = [...filters];
  const processedExtras: QueryObjectExtras = { ...extras };

  // Process adhoc filters
  for (const adhocFilter of adhoc_filters) {
    if (adhocFilter.expressionType === 'SIMPLE' && adhocFilter.subject && adhocFilter.operator) {
      // Convert simple adhoc filters to QueryObjectFilterClause
      if (typeof adhocFilter.subject === 'string') {
        processedFilters.push({
          col: adhocFilter.subject,
          op: adhocFilter.operator as any,
          val: adhocFilter.comparator,
        });
      }
    } else if (adhocFilter.expressionType === 'SQL' && adhocFilter.sqlExpression) {
      // Add SQL filters to WHERE clause in extras
      const clause = adhocFilter.clause === 'HAVING' ? 'having' : 'where';
      const existingClause = processedExtras[clause] || '';
      const separator = existingClause ? ' AND ' : '';
      processedExtras[clause] = existingClause + separator + `(${adhocFilter.sqlExpression})`;
    }
  }

  return {
    extras: processedExtras,
    filters: processedFilters,
  };
}
