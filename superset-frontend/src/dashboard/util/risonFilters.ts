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
  QueryObjectFilterClause,
  PartialFilters,
  DataMaskStateWithId,
} from '@superset-ui/core';
import rison from 'rison';
import { navigateWithState } from 'src/utils/navigationUtils';

/**
 * Synthetic dataMask key for URL Rison filters that don't match any native
 * filter on the dashboard. Because no entry in `nativeFilters` claims this id,
 * `getAllActiveFilters` falls through to `allSliceIds`, so the attached
 * `extraFormData.filters` apply to every chart on the dashboard.
 */
export const RISON_UNMATCHED_DATAMASK_ID = '__rison_unmatched__';

export interface RisonFilter {
  subject: string;
  operator: string;
  comparator: string | number | boolean | (string | number)[];
}

export interface IntelligentRisonInjectionResult {
  updatedDataMask: DataMaskStateWithId;
  unmatchedFilters: RisonFilter[];
}

/**
 * Parse individual filter condition
 */
function parseFilterCondition(key: string, value: unknown): RisonFilter {
  // Handle comparison operators: (gt:100), (between:!(1,10))
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const [operator, operatorValue] = Object.entries(
      value as Record<string, unknown>,
    )[0];

    switch (operator) {
      case 'gt':
        return {
          subject: key,
          operator: '>',
          comparator: operatorValue as string | number,
        };
      case 'gte':
        return {
          subject: key,
          operator: '>=',
          comparator: operatorValue as string | number,
        };
      case 'lt':
        return {
          subject: key,
          operator: '<',
          comparator: operatorValue as string | number,
        };
      case 'lte':
        return {
          subject: key,
          operator: '<=',
          comparator: operatorValue as string | number,
        };
      case 'between':
        return {
          subject: key,
          operator: 'BETWEEN',
          comparator: operatorValue as (string | number)[],
        };
      case 'like':
        return {
          subject: key,
          operator: 'LIKE',
          comparator: operatorValue as string,
        };
      default:
        return {
          subject: key,
          operator: '==',
          comparator: value as unknown as string | number,
        };
    }
  }

  // Handle IN operator: !(value1,value2)
  if (Array.isArray(value)) {
    return {
      subject: key,
      operator: 'IN',
      comparator: value as (string | number)[],
    };
  }

  // Handle simple equality
  return {
    subject: key,
    operator: '==',
    comparator: value as string | number | boolean,
  };
}

/**
 * Parse Rison filter syntax from URL parameter.
 * Supports formats like: (country:USA,year:2024)
 */
export function parseRisonFilters(risonString: string): RisonFilter[] {
  try {
    const parsed = rison.decode(risonString);
    const filters: RisonFilter[] = [];

    if (!parsed || typeof parsed !== 'object') {
      return filters;
    }

    const parsedObj = parsed as Record<string, unknown>;

    // Handle OR operator: OR:!(condition1,condition2)
    if (parsedObj.OR && Array.isArray(parsedObj.OR)) {
      (parsedObj.OR as Record<string, unknown>[]).forEach(condition => {
        if (typeof condition === 'object') {
          Object.entries(condition).forEach(([key, value]) => {
            filters.push(parseFilterCondition(key, value));
          });
        }
      });
      return filters;
    }

    // Handle NOT operator: NOT:(condition). Falls through so regular keys at the
    // same level are still picked up below (supports mixed payloads like
    // `(country:USA,NOT:(status:archived))`).
    if (parsedObj.NOT && typeof parsedObj.NOT === 'object') {
      Object.entries(parsedObj.NOT as Record<string, unknown>).forEach(
        ([key, value]) => {
          const filter = parseFilterCondition(key, value);
          if (filter.operator === '==') {
            filter.operator = '!=';
          } else if (filter.operator === 'IN') {
            filter.operator = 'NOT IN';
          }
          filters.push(filter);
        },
      );
    }

    // Handle regular filters
    Object.entries(parsedObj).forEach(([key, value]) => {
      if (key !== 'OR' && key !== 'NOT') {
        filters.push(parseFilterCondition(key, value));
      }
    });

    return filters;
  } catch (error) {
    console.warn('Failed to parse Rison filters:', error);
    return [];
  }
}

/**
 * Convert Rison filters to Superset adhoc filter format
 */
export function risonToAdhocFilters(
  risonFilters: RisonFilter[],
): QueryObjectFilterClause[] {
  return risonFilters.map(
    filter =>
      ({
        expressionType: 'SIMPLE' as const,
        clause: 'WHERE' as const,
        subject: filter.subject,
        operator: filter.operator,
        comparator: filter.comparator,
      }) as unknown as QueryObjectFilterClause,
  );
}

/**
 * Prettify Rison filter URL by replacing encoded characters.
 * Uses browser history API to update URL without page reload.
 */
export function prettifyRisonFilterUrl(): void {
  try {
    const currentUrl = window.location.href;

    if (!currentUrl.includes('&f=') && !currentUrl.includes('?f=')) {
      return;
    }

    const urlMatch = currentUrl.match(/([?&])f=([^&]*)/);
    if (!urlMatch) {
      return;
    }

    const separator = urlMatch[1];
    let risonValue = urlMatch[2];

    if (!risonValue.includes('%') && !risonValue.includes('+')) {
      return;
    }

    let previousValue = '';
    let decodeAttempts = 0;
    while (risonValue !== previousValue && decodeAttempts < 5) {
      previousValue = risonValue;
      try {
        if (risonValue.includes('%')) {
          risonValue = decodeURIComponent(risonValue);
        }
      } catch {
        break;
      }
      decodeAttempts += 1;
    }

    risonValue = risonValue.replace(/\+/g, ' ');

    const matchIndex = urlMatch.index ?? 0;
    const beforeRison = currentUrl.substring(0, matchIndex);
    const afterRison = currentUrl.substring(matchIndex + urlMatch[0].length);
    const prettifiedUrl = `${beforeRison}${separator}f=${risonValue}${afterRison}`;

    if (prettifiedUrl !== currentUrl) {
      // Route through navigateWithState so the navigationUtils guards
      // (`assertSafeNavigationUrl` scheme/userinfo barriers + the
      // CodeQL-recognised inline sanitisers) apply at the
      // `window.history.replaceState` sink. The URL constructor inside
      // `navigateWithState` is conservative about re-encoding: sub-delims
      // like `(`, `)`, `:`, `!` (the meaningful Rison glyphs) survive,
      // so the prettification's visual win is preserved for every
      // character the prettifier actually targets.
      navigateWithState(prettifiedUrl, window.history.state ?? {}, {
        replace: true,
      });
    }
  } catch (error) {
    console.warn('Failed to prettify Rison URL:', error);
  }
}

/**
 * Get Rison filter parameter from URL
 */
export function getRisonFilterParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('f');
}

/**
 * Convert an array of RisonFilter back to Rison string format
 */
export function risonFiltersToString(filters: RisonFilter[]): string {
  if (filters.length === 0) {
    return '';
  }

  type RisonValue =
    string | number | boolean | (string | number)[] | Record<string, unknown>;
  const risonObject: Record<string, RisonValue> = {};
  const notObject: Record<string, RisonValue> = {};

  const encodePositive = (
    target: Record<string, RisonValue>,
    filter: RisonFilter,
    op: string,
  ) => {
    if (op === 'IN' && Array.isArray(filter.comparator)) {
      target[filter.subject] = filter.comparator;
    } else if (op === '==') {
      target[filter.subject] = filter.comparator;
    } else {
      const operatorMap: Record<string, string> = {
        '>': 'gt',
        '>=': 'gte',
        '<': 'lt',
        '<=': 'lte',
        BETWEEN: 'between',
        LIKE: 'like',
        ILIKE: 'ilike',
      };
      const risonOp = operatorMap[op] || op;
      target[filter.subject] = { [risonOp]: filter.comparator };
    }
  };

  filters.forEach(filter => {
    if (filter.operator === '!=') {
      // Re-emit as NOT:(col:value) so parseRisonFilters can read it back.
      encodePositive(notObject, filter, '==');
    } else if (filter.operator === 'NOT IN') {
      encodePositive(notObject, filter, 'IN');
    } else {
      encodePositive(risonObject, filter, filter.operator);
    }
  });

  if (Object.keys(notObject).length > 0) {
    risonObject.NOT = notObject;
  }

  try {
    return rison.encode(risonObject);
  } catch (error) {
    console.warn('Failed to encode Rison filters:', error);
    return '';
  }
}

interface ReplaceHistory {
  replace(location: { pathname: string; search: string }): void;
}

/**
 * Update the URL to remove successfully matched filters, keeping only unmatched ones.
 * When a react-router history is supplied, the update goes through it so that
 * components reading from `history.location` (e.g. `publishDataMask` in the
 * filter bar) see the new search string. Otherwise falls back to a raw
 * `window.history.replaceState`.
 */
export function updateUrlWithUnmatchedFilters(
  unmatchedFilters: RisonFilter[],
  history?: ReplaceHistory,
): void {
  try {
    const currentUrl = new URL(window.location.href);

    if (unmatchedFilters.length === 0) {
      currentUrl.searchParams.delete('f');
    } else {
      const newRisonString = risonFiltersToString(unmatchedFilters);
      if (newRisonString) {
        currentUrl.searchParams.set('f', newRisonString);
      } else {
        currentUrl.searchParams.delete('f');
      }
    }

    // Always keep window.history in sync so callers that read
    // `window.location.search` (e.g. `getRisonFilterParam`) see the update.
    // With a real `BrowserRouter`, `history.replace` would do this too — but
    // under a `createMemoryHistory` (used in tests, or in some embedded
    // contexts) it does not, and we'd leak the stale URL into the next
    // `getRisonFilterParam()` call. Routed through navigateWithState so the
    // navigationUtils scheme/userinfo barriers gate the sink.
    navigateWithState(currentUrl.toString(), window.history.state ?? {}, {
      replace: true,
    });
    if (history) {
      history.replace({
        pathname: currentUrl.pathname,
        search: currentUrl.search,
      });
    }
  } catch (error) {
    console.warn('Failed to update URL with unmatched filters:', error);
  }
}

/**
 * Find a native filter that matches a Rison filter by column name.
 * Uses case-insensitive, trimmed comparison to handle column names with spaces.
 */
function findMatchingNativeFilter(
  risonFilter: RisonFilter,
  nativeFilters: PartialFilters,
): string | null {
  const normalizedSubject = risonFilter.subject.trim().toLowerCase();

  for (const [filterId, nativeFilter] of Object.entries(nativeFilters)) {
    if (!nativeFilter?.targets) continue;

    const hasMatchingTarget = nativeFilter.targets.some(target => {
      if (typeof target === 'object' && target && 'column' in target) {
        return target.column?.name?.trim().toLowerCase() === normalizedSubject;
      }
      return false;
    });

    if (hasMatchingTarget) {
      return filterId;
    }
  }

  return null;
}

/**
 * Build extraFormData filters for a given rison filter and column name
 */
function buildExtraFormDataFilters(
  risonFilter: RisonFilter,
  columnName: string,
): QueryObjectFilterClause[] {
  const { operator, comparator } = risonFilter;

  if (operator === 'IN' || (operator === '==' && Array.isArray(comparator))) {
    return [
      {
        col: columnName,
        op: 'IN',
        val: Array.isArray(comparator) ? comparator : [comparator],
      },
    ];
  }

  if (operator === '==' && !Array.isArray(comparator)) {
    return [{ col: columnName, op: 'IN', val: [comparator] }];
  }

  if (
    operator === 'BETWEEN' &&
    Array.isArray(comparator) &&
    comparator.length === 2
  ) {
    return [
      { col: columnName, op: '>=', val: comparator[0] },
      { col: columnName, op: '<=', val: comparator[1] },
    ];
  }

  return [
    {
      col: columnName,
      op: operator,
      val: comparator,
    } as QueryObjectFilterClause,
  ];
}

/**
 * Convert a list of Rison filters into the `{col, op, val}` clauses expected
 * by `dataMask[id].extraFormData.filters`. Each filter uses its own subject
 * as the column name.
 */
export function risonFiltersToExtraFormDataFilters(
  filters: RisonFilter[],
): QueryObjectFilterClause[] {
  return filters.flatMap(filter =>
    buildExtraFormDataFilters(filter, filter.subject),
  );
}

/**
 * Convert a Rison filter value to the format expected by a native filter.
 * Also returns extraFormData for auto-application.
 */
function convertRisonToNativeValue(
  risonFilter: RisonFilter,
  nativeFilter: { filterType?: string },
): unknown {
  const { comparator, operator } = risonFilter;
  const filterType = nativeFilter?.filterType;

  switch (filterType) {
    case 'filter_select':
      if (operator === 'IN' || Array.isArray(comparator)) {
        return Array.isArray(comparator) ? comparator : [comparator];
      }
      return [comparator];

    case 'filter_range':
      if (
        operator === 'BETWEEN' &&
        Array.isArray(comparator) &&
        comparator.length === 2
      ) {
        return { min: comparator[0], max: comparator[1] };
      }
      return comparator;

    case 'filter_time_range':
    case 'filter_timecolumn':
      return comparator;

    default:
      return Array.isArray(comparator) ? comparator : [comparator];
  }
}

/**
 * Build a complete DataMask entry for a rison filter matched to a native filter.
 * Sets both filterState.value AND extraFormData so the filter auto-applies.
 */
function buildDataMaskForFilter(
  risonFilter: RisonFilter,
  nativeFilter: {
    id: string;
    filterType?: string;
    targets?: { column?: { name?: string } }[];
  },
  columnName: string,
) {
  const convertedValue = convertRisonToNativeValue(risonFilter, nativeFilter);

  return {
    id: nativeFilter.id,
    filterState: {
      value: convertedValue,
    },
    extraFormData: {
      filters: buildExtraFormDataFilters(risonFilter, columnName),
    },
    ownState: {},
  };
}

/**
 * Intelligently inject Rison filters into native filters where possible,
 * falling back to brute-force injection for unmatched filters
 */
export function injectRisonFiltersIntelligently(
  risonFilters: RisonFilter[],
  nativeFilters: PartialFilters,
  currentDataMask: DataMaskStateWithId,
): IntelligentRisonInjectionResult {
  const updatedDataMask = { ...currentDataMask };
  const unmatchedFilters: RisonFilter[] = [];

  risonFilters.forEach(risonFilter => {
    const matchingFilterId = findMatchingNativeFilter(
      risonFilter,
      nativeFilters,
    );

    if (matchingFilterId) {
      const matchedFilter = nativeFilters[matchingFilterId];
      const filterId = matchedFilter?.id ?? matchingFilterId;
      if (matchedFilter && filterId) {
        const columnName =
          matchedFilter.targets?.[0]?.column?.name ?? risonFilter.subject;

        const dataMaskEntry = buildDataMaskForFilter(
          risonFilter,
          { ...matchedFilter, id: filterId } as {
            id: string;
            filterType?: string;
            targets?: { column?: { name?: string } }[];
          },
          columnName,
        );

        updatedDataMask[filterId] = {
          ...updatedDataMask[filterId],
          ...dataMaskEntry,
        };
        return;
      }
    }

    unmatchedFilters.push(risonFilter);
  });

  return {
    updatedDataMask,
    unmatchedFilters,
  };
}
