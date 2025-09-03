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
  QueryObjectExtras,
  QueryObjectFilterClause,
} from '../types';

interface ExtrasResult extends QueryObjectExtras {
  filters: QueryObjectFilterClause[];
}

/**
 * Extract extras and filters from form data
 */
export default function extractExtras(formData: QueryFormData): ExtrasResult {
  const {
    where,
    having,
    time_grain_sqla,
    granularity_sqla,
    granularity,
    extra_filters = [],
  } = formData;

  const extras: QueryObjectExtras = {};
  const filters: QueryObjectFilterClause[] = [];

  // Add SQL clauses to extras
  if (where) {
    extras.where = where;
  }
  if (having) {
    extras.having = having;
  }
  if (time_grain_sqla) {
    extras.time_grain_sqla = time_grain_sqla;
  }

  // Handle granularity - prefer granularity_sqla over granularity
  const timeColumn = granularity_sqla || granularity;
  if (timeColumn) {
    // Time column handling would go here if needed
  }

  // Convert extra_filters to QueryObjectFilterClause format
  if (extra_filters && Array.isArray(extra_filters)) {
    for (const filter of extra_filters) {
      if (filter.col && filter.op && filter.val !== undefined) {
        filters.push({
          col: filter.col,
          op: filter.op,
          val: filter.val,
        });
      }
    }
  }

  return {
    ...extras,
    filters,
  };
}
