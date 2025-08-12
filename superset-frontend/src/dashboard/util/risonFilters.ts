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

import { QueryObjectFilterClause } from '@superset-ui/core';
import rison from 'rison';

export interface RisonFilter {
  subject: string;
  operator: string;
  comparator: any;
}

/**
 * Parse Rison filter syntax from URL parameter
 * Supports formats like: (country:USA,year:2024)
 */
export function parseRisonFilters(risonString: string): RisonFilter[] {
  try {
    const parsed = rison.decode(risonString);
    const filters: RisonFilter[] = [];

    if (!parsed || typeof parsed !== 'object') {
      return filters;
    }

    const parsedObj = parsed as Record<string, any>;

    // Handle OR operator: OR:!(condition1,condition2)
    if (parsedObj.OR && Array.isArray(parsedObj.OR)) {
      parsedObj.OR.forEach((condition: any) => {
        if (typeof condition === 'object') {
          Object.entries(condition).forEach(([key, value]) => {
            filters.push(parseFilterCondition(key, value));
          });
        }
      });
      return filters;
    }

    // Handle NOT operator: NOT:(condition)
    if (parsedObj.NOT && typeof parsedObj.NOT === 'object') {
      Object.entries(parsedObj.NOT).forEach(([key, value]) => {
        const filter = parseFilterCondition(key, value);
        // Negate the operator
        if (filter.operator === '==') {
          filter.operator = '!=';
        } else if (filter.operator === 'IN') {
          filter.operator = 'NOT IN';
        }
        filters.push(filter);
      });
      return filters;
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
 * Parse individual filter condition
 */
function parseFilterCondition(key: string, value: any): RisonFilter {
  // Handle comparison operators: (gt:100), (between:!(1,10))
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const [operator, operatorValue] = Object.entries(value)[0];

    switch (operator) {
      case 'gt':
        return { subject: key, operator: '>', comparator: operatorValue };
      case 'gte':
        return { subject: key, operator: '>=', comparator: operatorValue };
      case 'lt':
        return { subject: key, operator: '<', comparator: operatorValue };
      case 'lte':
        return { subject: key, operator: '<=', comparator: operatorValue };
      case 'between':
        return { subject: key, operator: 'BETWEEN', comparator: operatorValue };
      case 'like':
        return { subject: key, operator: 'LIKE', comparator: operatorValue };
      default:
        return { subject: key, operator: '==', comparator: value };
    }
  }

  // Handle IN operator: !(value1,value2)
  if (Array.isArray(value)) {
    return { subject: key, operator: 'IN', comparator: value };
  }

  // Handle simple equality
  return { subject: key, operator: '==', comparator: value };
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
        // eslint-disable-next-line no-underscore-dangle
        __superset_rison_filter__: true, // Metadata to identify Rison filters
      }) as any,
  );
}

/**
 * Check if a filter was derived from Rison
 */
export function isRisonFilter(filter: any): boolean {
  // eslint-disable-next-line no-underscore-dangle
  return filter && filter.__superset_rison_filter__ === true;
}

/**
 * Filter out Rison-derived filters from an array
 */
export function excludeRisonFilters(filters: any[]): any[] {
  return filters.filter(filter => !isRisonFilter(filter));
}

/**
 * Prettify Rison filter URL by replacing encoded characters
 * Uses browser history API to update URL without page reload
 */
export function prettifyRisonFilterUrl(): void {
  try {
    const currentUrl = window.location.href;

    // Check if URL contains Rison parameters (encoded or not)
    if (!currentUrl.includes('&f=') && !currentUrl.includes('?f=')) {
      return;
    }

    // Extract the Rison parameter value
    const urlMatch = currentUrl.match(/([?&])f=([^&]*)/);
    if (!urlMatch) {
      return;
    }

    const separator = urlMatch[1];
    let risonValue = urlMatch[2];

    // Check if value needs prettification (contains encoded characters)
    if (!risonValue.includes('%') && !risonValue.includes('+')) {
      return;
    }

    // Decode multiple times if needed (handles multiple encoding layers)
    let previousValue = '';
    let decodeAttempts = 0;
    while (risonValue !== previousValue && decodeAttempts < 5) {
      previousValue = risonValue;
      try {
        // Decode percent-encoded characters
        if (risonValue.includes('%')) {
          risonValue = decodeURIComponent(risonValue);
        }
      } catch (e) {
        // If decoding fails, stop trying
        break;
      }
      decodeAttempts += 1;
    }

    // Clean up + signs that should be spaces
    risonValue = risonValue.replace(/\+/g, ' ');

    // Reconstruct the URL with the clean Rison parameter
    const matchIndex = urlMatch.index ?? 0;
    const beforeRison = currentUrl.substring(0, matchIndex);
    const afterRison = currentUrl.substring(matchIndex + urlMatch[0].length);
    const prettifiedUrl = `${beforeRison}${separator}f=${risonValue}${afterRison}`;

    // Only update if the URL actually changed
    if (prettifiedUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', prettifiedUrl);
    }
  } catch (error) {
    console.warn('Failed to prettify Rison URL:', error);
  }
}

/**
 * Get Rison filter parameter from current URL
 */
export function getRisonFilterParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('f');
}

/**
 * Set up automatic URL prettification
 * Watches for URL changes and prettifies Rison parameters
 */
export function setupRisonUrlPrettification(): void {
  // Initial prettification
  prettifyRisonFilterUrl();

  // Watch for URL changes using a simple polling mechanism
  let lastUrl = window.location.href;
  const checkInterval = setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // Small delay to let the URL settle
      setTimeout(() => prettifyRisonFilterUrl(), 10);
    }
  }, 100);

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(checkInterval);
  });
}
