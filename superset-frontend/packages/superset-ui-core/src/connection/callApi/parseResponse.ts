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
import JSONbig from 'json-bigint';
import { cloneDeepWith } from 'lodash';

import { ParseMethod, TextResponse, JsonResponse } from '../types';

export default async function parseResponse<T extends ParseMethod = 'json'>(
  apiPromise: Promise<Response>,
  parseMethod?: T,
) {
  type ReturnType = T extends 'raw' | null
    ? Response
    : T extends 'json' | 'json-bigint' | undefined
    ? JsonResponse
    : T extends 'text'
    ? TextResponse
    : never;
  const response = await apiPromise;
  // reject failed HTTP requests with the raw response
  if (!response.ok) {
    return Promise.reject(response);
  }
  if (parseMethod === null || parseMethod === 'raw') {
    return response as ReturnType;
  }
  if (parseMethod === 'text') {
    const text = await response.text();
    const result: TextResponse = {
      response,
      text,
    };
    return result as ReturnType;
  }
  if (parseMethod === 'json-bigint') {
    const rawData = await response.text();
    const json = JSONbig.parse(rawData);
    const result: JsonResponse = {
      response,
      // `json-bigint` could not handle floats well, see sidorares/json-bigint#62
      // TODO: clean up after json-bigint>1.0.1 is released
      json: cloneDeepWith(json, (value: any) =>
        value?.isInteger?.() === false ? Number(value) : undefined,
      ),
    };
    return result as ReturnType;
  }
  // by default treat this as json
  if (parseMethod === undefined || parseMethod === 'json') {
    const json = await response.json();
    const result: JsonResponse = {
      json,
      response,
    };
    return result as ReturnType;
  }
  throw new Error(
    `Expected parseResponse=json|json-bigint|text|raw|null, got '${parseMethod}'.`,
  );
}
