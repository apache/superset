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
import querystring from 'query-string';
import { JsonObject } from '@superset-ui/core';

const reservedQueryParams = new Set(['standalone', 'edit']);

export type UrlParamType = 'reserved' | 'regular' | 'all';

/**
 * Returns the url params that are used to customize queries
 */
export default function extractUrlParams(
  urlParamType: UrlParamType,
): JsonObject {
  const queryParams = querystring.parse(window.location.search);
  return Object.entries(queryParams).reduce((acc, [key, value]) => {
    if (
      (urlParamType === 'regular' && reservedQueryParams.has(key)) ||
      (urlParamType === 'reserved' && !reservedQueryParams.has(key))
    )
      return acc;
    // if multiple url params share the same key (?foo=bar&foo=baz), they will appear as an array.
    // Only one value can be used for a given query param, so we just take the first one.
    if (Array.isArray(value)) {
      return {
        ...acc,
        [key]: value[0],
      };
    }
    return { ...acc, [key]: value };
  }, {});
}
