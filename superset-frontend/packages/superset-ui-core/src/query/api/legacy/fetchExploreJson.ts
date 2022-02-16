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

import { SupersetClient, Method, Endpoint } from '../../../connection';
import { QueryFormData } from '../../types/QueryFormData';
import { LegacyChartDataResponse } from './types';
import { BaseParams } from '../types';

export interface Params extends BaseParams {
  method?: Method;
  endpoint?: Endpoint;
  formData: QueryFormData;
}

export default async function fetchExploreJson({
  client = SupersetClient,
  method = 'POST',
  requestConfig,
  endpoint = '/superset/explore_json/',
  formData,
}: Params) {
  const { json } = await client.request({
    ...requestConfig,
    method,
    endpoint,
    searchParams:
      method === 'GET'
        ? new URLSearchParams({ form_data: JSON.stringify(formData) })
        : undefined,
    postPayload: method === 'POST' ? { form_data: formData } : undefined,
  });
  return json as LegacyChartDataResponse;
}
