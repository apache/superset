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
  isDefined,
  JsonObject,
  QueryFormData,
  SupersetClient,
} from '@superset-ui/core';
import Switchboard from '@superset-ui/switchboard';
import rison from 'rison';
import { isEmpty } from 'es-toolkit/compat';
import {
  RESERVED_CHART_URL_PARAMS,
  RESERVED_DASHBOARD_URL_PARAMS,
  URL_PARAMS,
} from '../constants';
import { getActiveFilters } from '../dashboard/util/activeDashboardFilters';
import serializeActiveFilterValues from '../dashboard/util/serializeActiveFilterValues';
import getBootstrapData from './getBootstrapData';

export type UrlParamType = 'string' | 'number' | 'boolean' | 'object' | 'rison';
export type UrlParam = (typeof URL_PARAMS)[keyof typeof URL_PARAMS];
export function getUrlParam(
  param: UrlParam & { type: 'string' },
): string | null;
export function getUrlParam(
  param: UrlParam & { type: 'number' },
): number | null;
export function getUrlParam(
  param: UrlParam & { type: 'boolean' },
): boolean | null;
export function getUrlParam(
  param: UrlParam & { type: 'object' },
): object | null;
export function getUrlParam(param: UrlParam & { type: 'rison' }): object | null;
export function getUrlParam(
  param: UrlParam & { type: 'rison | string' },
): string | object | null;
export function getUrlParam({ name, type }: UrlParam): unknown {
  const urlParam = new URLSearchParams(window.location.search).get(name);
  switch (type) {
    case 'number':
      if (!urlParam) {
        return null;
      }
      if (urlParam.toLowerCase() === 'true') {
        return 1;
      }
      if (urlParam.toLowerCase() === 'false') {
        return 0;
      }
      if (!Number.isNaN(Number(urlParam))) {
        return Number(urlParam);
      }
      return null;
    case 'object':
      if (!urlParam) {
        return null;
      }
      return JSON.parse(urlParam);
    case 'boolean':
      if (!urlParam) {
        return null;
      }
      return urlParam.toLowerCase() !== 'false' && urlParam !== '0';
    case 'rison':
      if (!urlParam) {
        return null;
      }
      try {
        return rison.decode(urlParam);
      } catch {
        return urlParam;
      }
    default:
      return urlParam;
  }
}

function getUrlParams(excludedParams: string[]): URLSearchParams {
  const urlParams = new URLSearchParams();
  const currentParams = new URLSearchParams(window.location.search);
  currentParams.forEach((value, key) => {
    if (!excludedParams.includes(key)) urlParams.append(key, value);
  });
  return urlParams;
}

export type UrlParamEntries = [string, string][];

function getUrlParamEntries(urlParams: URLSearchParams): UrlParamEntries {
  const urlEntries: [string, string][] = [];
  urlParams.forEach((value, key) => urlEntries.push([key, value]));
  return urlEntries;
}

function getChartUrlParams(excludedUrlParams?: string[]): UrlParamEntries {
  const excludedParams = excludedUrlParams || RESERVED_CHART_URL_PARAMS;
  const urlParams = getUrlParams(excludedParams);
  const filterBoxFilters = getActiveFilters();
  if (
    !isEmpty(filterBoxFilters) &&
    !excludedParams.includes(URL_PARAMS.preselectFilters.name)
  )
    urlParams.append(
      URL_PARAMS.preselectFilters.name,
      JSON.stringify(serializeActiveFilterValues(getActiveFilters())),
    );
  return getUrlParamEntries(urlParams);
}

export function getDashboardUrlParams(
  extraExcludedParams: string[] = [],
): UrlParamEntries {
  const urlParams = getUrlParams([
    ...RESERVED_DASHBOARD_URL_PARAMS,
    ...extraExcludedParams,
  ]);
  const filterBoxFilters = getActiveFilters();
  if (!isEmpty(filterBoxFilters))
    urlParams.append(
      URL_PARAMS.preselectFilters.name,
      JSON.stringify(serializeActiveFilterValues(getActiveFilters())),
    );
  return getUrlParamEntries(urlParams);
}

export type PermalinkResult = {
  key: string;
  url: string;
};

function getPermalink(
  endpoint: string,
  jsonPayload: JsonObject,
): Promise<PermalinkResult> {
  return SupersetClient.post({
    endpoint,
    jsonPayload,
  }).then(result => ({
    key: result.json.key as string,
    url: result.json.url as string,
  }));
}

/**
 * Resolves a permalink URL using the host app's custom callback if in embedded mode.
 * Falls back to the default URL if not embedded or if no callback is provided.
 */
async function resolvePermalinkUrl(
  result: PermalinkResult,
): Promise<PermalinkResult> {
  const { key, url } = result;

  // In embedded mode, check if the host app has a custom resolvePermalinkUrl callback
  const bootstrapData = getBootstrapData();
  if (bootstrapData.embedded) {
    try {
      // Ask the SDK to resolve the permalink URL
      // Returns null if no callback was provided by the host
      const resolvedUrl = await Switchboard.get<string | null>(
        'resolvePermalinkUrl',
        { key },
      );

      // If callback returned a valid URL string, use it; otherwise use Superset's default URL
      if (typeof resolvedUrl === 'string' && resolvedUrl.length > 0) {
        return { key, url: resolvedUrl };
      }
    } catch (error) {
      // Silently fall back to default URL if Switchboard call fails
      // (e.g., if not in embedded context or callback throws)
    }
  }

  return { key, url };
}

export async function getChartPermalink(
  formData: Pick<QueryFormData, 'datasource'>,
  excludedUrlParams?: string[],
): Promise<PermalinkResult> {
  const result = await getPermalink('/api/v1/explore/permalink', {
    formData,
    urlParams: getChartUrlParams(excludedUrlParams),
  });
  return resolvePermalinkUrl(result);
}

export async function getDashboardPermalink({
  dashboardId,
  dataMask,
  activeTabs,
  anchor, // the anchor part of the link which corresponds to the tab/chart id
  chartStates, // chart-level customizations (optional)
  includeChartState = false, // whether to include chart state in permalink (FALSE by default)
}: {
  dashboardId: string | number;
  /**
   * Current applied data masks (for native filters).
   */
  dataMask: JsonObject;
  /**
   * Current active tabs in the dashboard.
   */
  activeTabs: string[];
  /**
   * The "anchor" component for the permalink. It will be scrolled into view
   * and highlighted upon page load.
   */
  anchor?: string;
  /**
   * Chart-level state (column order, sorting, filtering, etc.)
   */
  chartStates?: JsonObject;
  /**
   * Whether to include chart state in the permalink (default: false)
   */
  includeChartState?: boolean;
}): Promise<PermalinkResult> {
  const payload: JsonObject = {
    urlParams: getDashboardUrlParams(),
    dataMask,
    activeTabs,
    anchor,
  };

  // Only include chart states when explicitly requested AND when they exist
  if (includeChartState && chartStates && Object.keys(chartStates).length > 0) {
    payload.chartStates = chartStates;
  }

  const result = await getPermalink(
    `/api/v1/dashboard/${dashboardId}/permalink`,
    payload,
  );
  return resolvePermalinkUrl(result);
}

const externalUrlRegex =
  /^([^:/?#]+:)?(?:(\/\/)?([^/?#]*))?([^?#]+)?(\?[^#]*)?(#.*)?/;

// group 1 matches protocol
// group 2 matches '//'
// group 3 matches hostname
export function isUrlExternal(url: string) {
  const match = url.match(externalUrlRegex) || [];
  return (
    (typeof match[1] === 'string' && match[1].length > 0) ||
    match[2] === '//' ||
    (typeof match[3] === 'string' && match[3].length > 0)
  );
}

export function parseUrl(url: string) {
  const match = url.match(externalUrlRegex) || [];
  // if url is external but start with protocol or '//',
  // it can't be used correctly with <a> element
  // in such case, add '//' prefix
  if (isUrlExternal(url) && !isDefined(match[1]) && !url.startsWith('//')) {
    return `//${url}`;
  }
  return url;
}

export function toQueryString(params: Record<string, any>): string {
  const queryParts: string[] = [];
  Object.keys(params).forEach(key => {
    const value = params[key];
    if (value !== null && value !== undefined) {
      queryParts.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      );
    }
  });
  return queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
}
