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

import { useCallback, useEffect, DependencyList } from 'react';
/* eslint camelcase: 0 */
import URI from 'urijs';
import {
  buildQueryContext,
  ensureIsArray,
  getChartBuildQueryRegistry,
  getChartMetadataRegistry,
  QueryFormData,
  SupersetClient,
  SetDataMaskHook,
  JsonObject,
} from '@superset-ui/core';
import { availableDomains } from 'src/utils/hostNamesConfig';
import { safeStringify } from 'src/utils/safeStringify';
import { optionLabel } from 'src/utils/common';
import { ensureAppRoot } from 'src/utils/pathUtils';
import { URL_PARAMS } from 'src/constants';
import {
  DISABLE_INPUT_OPERATORS,
  MULTI_OPERATORS,
  Operators,
  OPERATOR_ENUM_TO_OPERATOR_TYPE,
  UNSAVED_CHART_ID,
} from 'src/explore/constants';
import { DashboardStandaloneMode } from 'src/dashboard/util/constants';
import { Slice } from 'src/types/Chart';

// Type definitions
export type EndpointType =
  | 'base'
  | 'full'
  | 'json'
  | 'csv'
  | 'query'
  | 'results'
  | 'samples'
  | 'standalone';

interface ExploreState {
  slice?: Slice | null;
  form_data?: Partial<QueryFormData>;
}

interface ChartDataUriParams {
  path: string;
  qs?: Record<string, string>;
  allowDomainSharding?: boolean;
}

interface GetExploreUrlParams {
  formData: QueryFormData & { label_colors?: Record<string, string> };
  endpointType?: EndpointType | string;
  force?: boolean;
  curUrl?: string | null;
  requestParams?: Record<string, string>;
  allowDomainSharding?: boolean;
  method?: 'GET' | 'POST';
}

interface BuildV1ChartDataPayloadParams {
  formData: QueryFormData;
  force?: boolean;
  resultFormat?: string;
  resultType?: string;
  setDataMask?: SetDataMaskHook;
  ownState?: JsonObject;
}

interface ExportChartParams {
  formData: QueryFormData;
  resultFormat?: string;
  resultType?: string;
  force?: boolean;
  ownState?: JsonObject;
  onStartStreamingExport?: ((params: {
    url: string | null;
    payload: QueryFormData | ReturnType<typeof buildQueryContext>;
    exportType: string;
  }) => void) | null;
}

interface SubjectWithColumnName {
  column_name?: string;
}

type ComparatorValue = string | number | boolean | null;

export function getChartKey(explore: ExploreState): number {
  const { slice, form_data } = explore;
  return slice?.slice_id ?? form_data?.slice_id ?? UNSAVED_CHART_ID;
}

let requestCounter = 0;
export function getHostName(allowDomainSharding = false): string {
  let currentIndex = 0;
  if (allowDomainSharding) {
    currentIndex = requestCounter % availableDomains.length;
    requestCounter += 1;

    // if domain sharding is enabled, skip main domain for fetching chart API
    // leave main domain free for other calls like fav star, save change, etc.
    // to make dashboard be responsive when it's loading large number of charts
    if (currentIndex === 0) {
      currentIndex += 1;
      requestCounter += 1;
    }
  }
  return availableDomains[currentIndex];
}

export function getAnnotationJsonUrl(
  slice_id: number | null | undefined,
  force: boolean,
): string | null {
  if (slice_id === null || slice_id === undefined) {
    return null;
  }

  const uri = URI(window.location.search);
  return uri
    .pathname(ensureAppRoot('/api/v1/chart/data'))
    .search({
      form_data: safeStringify({ slice_id }),
      force,
    })
    .toString();
}

export function getURIDirectory(endpointType: EndpointType | string = 'base'): string {
  // Building the directory part of the URI
  if (
    ['full', 'json', 'csv', 'query', 'results', 'samples'].includes(
      endpointType,
    )
  ) {
    return ensureAppRoot('/superset/explore_json/');
  }
  return ensureAppRoot('/explore/');
}

export function mountExploreUrl(
  endpointType: EndpointType | string,
  extraSearch: Record<string, string | number> = {},
  force = false,
): string {
  const uri = new URI('/');
  const directory = getURIDirectory(endpointType);
  const search = uri.search(true) as Record<string, string | number>;
  Object.keys(extraSearch).forEach(key => {
    search[key] = extraSearch[key];
  });
  if (endpointType === URL_PARAMS.standalone.name) {
    if (force) {
      search.force = '1';
    }
    search.standalone = DashboardStandaloneMode.HideNav;
  }
  return uri.directory(directory).search(search).toString();
}

export function getChartDataUri({
  path,
  qs,
  allowDomainSharding = false,
}: ChartDataUriParams): URI {
  // The search params from the window.location are carried through,
  // but can be specified with curUrl (used for unit tests to spoof
  // the window.location).
  let uri = new URI({
    protocol: window.location.protocol.slice(0, -1),
    hostname: getHostName(allowDomainSharding),
    port: window.location.port ? window.location.port : '',
    path: ensureAppRoot(path),
  });
  if (qs) {
    uri = uri.search(qs);
  }
  return uri;
}

/**
 * This gets the minimal url for the given form data.
 * If there are dashboard overrides present in the form data,
 * they will not be included in the url.
 */
export function getExploreUrl({
  formData,
  endpointType = 'base',
  force = false,
  curUrl = null,
  requestParams = {},
  allowDomainSharding = false,
  method = 'POST',
}: GetExploreUrlParams): string | null {
  if (!formData.datasource) {
    return null;
  }

  // label_colors should not pollute the URL
  // eslint-disable-next-line no-param-reassign
  delete formData.label_colors;

  let uri = getChartDataUri({
    path: '/',
    allowDomainSharding,
  });
  if (curUrl) {
    uri = URI(URI(curUrl).search());
  }

  const directory = getURIDirectory(endpointType);

  // Building the querystring (search) part of the URI
  const search = uri.search(true) as Record<string, string>;
  const { slice_id, extra_filters, adhoc_filters, viz_type } = formData;
  if (slice_id) {
    const form_data: Record<string, unknown> = { slice_id };
    if (method === 'GET') {
      form_data.viz_type = viz_type;
      if (extra_filters && extra_filters.length) {
        form_data.extra_filters = extra_filters;
      }
      if (adhoc_filters && adhoc_filters.length) {
        form_data.adhoc_filters = adhoc_filters;
      }
    }
    search.form_data = safeStringify(form_data);
  }
  if (force) {
    search.force = 'true';
  }
  if (endpointType === 'csv') {
    search.csv = 'true';
  }
  if (endpointType === URL_PARAMS.standalone.name) {
    search.standalone = '1';
  }
  if (endpointType === 'query') {
    search.query = 'true';
  }
  if (endpointType === 'results') {
    search.results = 'true';
  }
  if (endpointType === 'samples') {
    search.samples = 'true';
  }
  const paramNames = Object.keys(requestParams);
  if (paramNames.length) {
    paramNames.forEach(name => {
      if (Object.hasOwn(requestParams, name)) {
        search[name] = requestParams[name];
      }
    });
  }
  return uri.search(search).directory(directory).toString();
}

export const getQuerySettings = (
  formData: Partial<QueryFormData>,
): [boolean, string] => {
  const vizMetadata = getChartMetadataRegistry().get(formData.viz_type);
  return [
    vizMetadata?.useLegacyApi ?? false,
    vizMetadata?.parseMethod ?? 'json-bigint',
  ];
};

export const buildV1ChartDataPayload = async ({
  formData,
  force,
  resultFormat,
  resultType,
  setDataMask,
  ownState,
}: BuildV1ChartDataPayloadParams): Promise<ReturnType<typeof buildQueryContext>> => {
  const buildQuery =
    getChartBuildQueryRegistry().get(formData.viz_type) ??
    ((buildQueryFormData: QueryFormData) =>
      buildQueryContext(buildQueryFormData, baseQueryObject => [
        {
          ...baseQueryObject,
        },
      ]));
  return buildQuery(
    {
      ...formData,
      force,
      result_format: resultFormat,
      result_type: resultType,
    } as QueryFormData,
    {
      ownState,
      hooks: {
        setDataMask,
      },
    },
  );
};

export const getLegacyEndpointType = ({
  resultType,
  resultFormat,
}: {
  resultType: string;
  resultFormat: string;
}): string => (resultFormat === 'csv' ? resultFormat : resultType);

export const exportChart = async ({
  formData,
  resultFormat = 'json',
  resultType = 'full',
  force = false,
  ownState = {},
  onStartStreamingExport = null,
}: ExportChartParams): Promise<void> => {
  let url: string | null;
  let payload: QueryFormData | ReturnType<typeof buildQueryContext>;
  const [useLegacyApi] = getQuerySettings(formData);
  if (useLegacyApi) {
    const endpointType = getLegacyEndpointType({ resultFormat, resultType });
    url = getExploreUrl({
      formData,
      endpointType,
      allowDomainSharding: false,
    });
    payload = formData;
  } else {
    url = ensureAppRoot('/api/v1/chart/data');
    payload = await buildV1ChartDataPayload({
      formData,
      force,
      resultFormat,
      resultType,
      ownState,
    });
  }

  // Check if streaming export handler is provided (from dashboard Chart.jsx)
  if (onStartStreamingExport) {
    // Streaming is handled by the caller - pass URL, payload, and export type
    onStartStreamingExport({
      url,
      payload,
      exportType: resultFormat,
    });
  } else {
    // Fallback to original behavior for non-streaming exports
    SupersetClient.postForm(url as string, { form_data: safeStringify(payload) });
  }
};

export const exploreChart = (
  formData: QueryFormData,
  requestParams?: Record<string, string>,
): void => {
  const url = getExploreUrl({
    formData,
    endpointType: 'base',
    allowDomainSharding: false,
    requestParams,
  });
  SupersetClient.postForm(url as string, { form_data: safeStringify(formData) });
};

export const useDebouncedEffect = (
  effect: () => void,
  delay: number,
  deps: DependencyList,
): void => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const callback = useCallback(effect, deps);

  useEffect(() => {
    const handler = setTimeout(() => {
      callback();
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [callback, delay]);
};

export const getSimpleSQLExpression = (
  subject?: string | SubjectWithColumnName,
  operator?: string,
  comparator?: ComparatorValue | ComparatorValue[],
): string => {
  const multiOperatorValues = [...MULTI_OPERATORS].map(
    (op: Operators) => OPERATOR_ENUM_TO_OPERATOR_TYPE[op].operation,
  );
  const isMulti = multiOperatorValues.indexOf(operator ?? '') >= 0;
  const disableInputOperatorValues = DISABLE_INPUT_OPERATORS.map(
    (op: Operators) => OPERATOR_ENUM_TO_OPERATOR_TYPE[op].operation,
  );
  const showComparator = disableInputOperatorValues.indexOf(operator ?? '') === -1;
  // If returned value is an object after changing dataset
  let expression: string =
    typeof subject === 'object'
      ? (subject?.column_name ?? '')
      : (subject ?? '');
  if (subject && operator) {
    expression += ` ${operator}`;
    const firstValue =
      isMulti && Array.isArray(comparator) ? comparator[0] : comparator;
    const comparatorArray = ensureIsArray(comparator);
    const isString =
      firstValue !== undefined && Number.isNaN(Number(firstValue));
    const quote = isString ? "'" : '';
    const [prefix, suffix] = isMulti ? ['(', ')'] : ['', ''];
    if (comparatorArray.length > 0 && showComparator) {
      const formattedComparators = comparatorArray
        .map(val => optionLabel(val))
        .map(
          val =>
            `${quote}${isString ? String(val).replace(/'/g, "''") : val}${quote}`,
        );
      expression += ` ${prefix}${formattedComparators.join(', ')}${suffix}`;
    }
  }
  return expression;
};

export function formatSelectOptions<T extends { toString(): string }>(
  options: T[],
): [T, string][] {
  return options.map(opt => [opt, opt.toString()]);
}
