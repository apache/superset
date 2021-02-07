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
import { URL_PARAMS } from 'src/constants';
import serializeActiveFilterValues from './serializeActiveFilterValues';

export default function getDashboardUrl(
  pathname: string,
  filters = {},
  hash = '',
  standalone?: number | null,
) {
  const newSearchParams = new URLSearchParams();

  // convert flattened { [id_column]: values } object
  // to nested filter object
  newSearchParams.set(
    URL_PARAMS.preselectFilters,
    JSON.stringify(serializeActiveFilterValues(filters)),
  );

  if (standalone) {
    newSearchParams.set(URL_PARAMS.standalone, standalone.toString());
  }

  const hashSection = hash ? `#${hash}` : '';

  return `${pathname}?${newSearchParams.toString()}${hashSection}`;
}

export type UrlParamType = 'string' | 'number' | 'boolean';
export function getUrlParam(paramName: string, type: 'string'): string;
export function getUrlParam(paramName: string, type: 'number'): number;
export function getUrlParam(paramName: string, type: 'boolean'): boolean;
export function getUrlParam(paramName: string, type: UrlParamType): unknown {
  const urlParam = new URLSearchParams(window.location.search.substring(1)).get(
    paramName,
  );
  switch (type) {
    case 'number':
      if (!urlParam) {
        return null;
      }
      if (urlParam === 'true') {
        return 1;
      }
      if (urlParam === 'false') {
        return 0;
      }
      // eslint-disable-next-line no-case-declarations
      const parsedNumber = parseInt(urlParam, 10);
      if (Number.isInteger(parsedNumber)) {
        return parsedNumber;
      }
      return null;
    // TODO: process other types when needed
    default:
      return urlParam;
  }
}
