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

/* eslint-disable camelcase */
import { QueryFormData } from './types/QueryFormData';
import { QueryObjectFilterClause } from './types/Query';
import { isSimpleAdhocFilter } from './types/Filter';
import convertFilter from './convertFilter';

/** Logic formerly in viz.py's process_query_filters */
export default function processFilters(
  formData: Partial<QueryFormData>,
): Partial<QueryFormData> {
  // Split adhoc_filters into four fields according to
  // (1) clause (WHERE or HAVING)
  // (2) expressionType
  //     2.1 SIMPLE (subject + operator + comparator)
  //     2.2 SQL (freeform SQL expression))
  const { adhoc_filters, extras = {}, filters = [], where } = formData;
  const simpleWhere: QueryObjectFilterClause[] = filters;

  const simpleHaving: QueryObjectFilterClause[] = [];
  const freeformWhere: string[] = [];
  if (where) freeformWhere.push(where);
  const freeformHaving: string[] = [];

  (adhoc_filters || []).forEach(filter => {
    const { clause } = filter;
    if (isSimpleAdhocFilter(filter)) {
      const filterClause = convertFilter(filter);
      if (clause === 'WHERE') {
        simpleWhere.push(filterClause);
      } else {
        simpleHaving.push(filterClause);
      }
    } else {
      const { sqlExpression } = filter;
      if (clause === 'WHERE') {
        freeformWhere.push(sqlExpression);
      } else {
        freeformHaving.push(sqlExpression);
      }
    }
  });

  // some filter-related fields need to go in `extras`
  extras.having = freeformHaving.map(exp => `(${exp})`).join(' AND ');
  extras.having_druid = simpleHaving;
  extras.where = freeformWhere.map(exp => `(${exp})`).join(' AND ');

  return {
    filters: simpleWhere,
    extras,
  };
}
