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
import { SupersetClient, JsonObject, JsonResponse } from '@superset-ui/core';
import { sanitizeFormData } from 'src/utils/sanitizeFormData';
import { URL_PARAMS } from 'src/constants';
import { mountExploreUrl } from './index';

type Payload = {
  datasource_id: number;
  datasource_type: string;
  form_data: string;
  chart_id?: number;
};

const assembleEndpoint = (key?: string, tabId?: string) => {
  let endpoint = 'api/v1/explore/form_data';

  if (key) endpoint = endpoint.concat(`/${key}`);
  if (tabId) endpoint = endpoint.concat(`?tab_id=${tabId}`);

  return endpoint;
};

const assemblePayload = (
  datasourceId: number,
  datasourceType: string,
  formData: JsonObject,
  chartId?: number,
): Payload => {
  const payload: Payload = {
    datasource_id: datasourceId,
    datasource_type: datasourceType,
    form_data: JSON.stringify(sanitizeFormData(formData)),
  };

  if (chartId) payload.chart_id = chartId;

  return payload;
};

export const postFormData = (
  datasourceId: number,
  datasourceType: string,
  formData: JsonObject,
  chartId?: number,
  tabId?: string,
): Promise<string> =>
  SupersetClient.post({
    endpoint: assembleEndpoint(undefined, tabId),
    jsonPayload: assemblePayload(
      datasourceId,
      datasourceType,
      formData,
      chartId,
    ),
  }).then((r: JsonResponse) => r.json.key);

export const putFormData = (
  datasourceId: number,
  datasourceType: string,
  key: string,
  formData: JsonObject,
  chartId?: number,
  tabId?: string,
): Promise<string> =>
  SupersetClient.put({
    endpoint: assembleEndpoint(key, tabId),
    jsonPayload: assemblePayload(
      datasourceId,
      datasourceType,
      formData,
      chartId,
    ),
  }).then((r: JsonResponse) => r.json.message);

/**
 * Generate explore URL by posting formData to server and creating URL with key.
 * This solves URL length limitations by storing complex formData server-side.
 *
 * @param datasourceId - The datasource ID
 * @param datasourceType - The datasource type (typically 'table' or 'query')
 * @param formData - The form data object to be posted
 * @param options - Optional parameters
 * @param options.chartId - Chart ID for the explore URL
 * @param options.tabId - Tab ID for multi-tab environments
 * @param options.dashboardPageId - Dashboard page ID to maintain context
 * @returns Promise that resolves to the complete explore URL
 */
export const generateExploreUrl = async (
  datasourceId: number,
  datasourceType: string,
  formData: JsonObject,
  options?: {
    chartId?: number;
    tabId?: string;
    dashboardPageId?: string;
  },
): Promise<string> => {
  // Post formData to server and get key
  const key = await postFormData(
    datasourceId,
    datasourceType,
    formData,
    options?.chartId,
    options?.tabId,
  );

  // Generate base explore URL with form_data_key
  const baseUrl = mountExploreUrl(null, {
    [URL_PARAMS.formDataKey.name]: key,
  });

  // Add dashboard_page_id if provided
  const finalUrl = options?.dashboardPageId
    ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}dashboard_page_id=${options.dashboardPageId}`
    : baseUrl;

  return finalUrl;
};
