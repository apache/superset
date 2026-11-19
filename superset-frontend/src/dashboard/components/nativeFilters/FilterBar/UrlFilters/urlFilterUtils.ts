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
  getRisonFilterParam,
  parseRisonFilters,
  RisonFilter,
} from 'src/dashboard/util/risonFilters';

export interface UrlFilterIndicator {
  subject: string;
  operator: string;
  value: string;
  filter: RisonFilter;
}

/**
 * Build a stable identity string for a URL filter so duplicates on the same
 * column (e.g., multiple conditions on `country`) get distinct React keys and
 * can be removed individually.
 */
export function getUrlFilterIdentity(filter: RisonFilter): string {
  return `${filter.subject}|${filter.operator}|${JSON.stringify(
    filter.comparator,
  )}`;
}

function formatFilterValue(filter: RisonFilter): string {
  const { comparator, operator } = filter;

  if (operator === 'BETWEEN' && Array.isArray(comparator)) {
    return `${comparator[0]} – ${comparator[1]}`;
  }

  if (Array.isArray(comparator)) {
    return comparator.join(', ');
  }

  return String(comparator);
}

export function getUrlFilterIndicators(): UrlFilterIndicator[] {
  const risonParam = getRisonFilterParam();
  if (!risonParam) {
    return [];
  }

  const filters = parseRisonFilters(risonParam);
  return filters.map(filter => ({
    subject: filter.subject,
    operator: filter.operator,
    value: formatFilterValue(filter),
    filter,
  }));
}
